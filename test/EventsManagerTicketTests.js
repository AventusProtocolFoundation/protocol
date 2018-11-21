const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

let eventsManager;

contract('Events manager - tickets', async () => {

  const accounts = testHelper.getAccounts('eventOwner', 'broker', 'buyer', 'newBuyer', 'nobody');
  const ticketMetadata = 'Some metadata';
  const doorData = '0x';
  const baseVendorTicketRef = 'Vendor ref ';

  let vendorTicketNumber = 0;
  let goodEventId, vendorTicketRefHash, goodSellTicketVendorProof;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);

    eventsManager = await testHelper.getEventsManager();
    goodEventId = await eventsTestHelper.depositAndCreateEvent(accounts.eventOwner);
    await eventsTestHelper.advanceTimeToOnSaleTime(goodEventId);
    await membersTestHelper.depositAndRegisterMember(accounts.broker, membersTestHelper.memberTypes.broker);
  });

  after(async () => {
    await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(accounts.eventOwner, goodEventId);
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.broker, membersTestHelper.memberTypes.broker);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  beforeEach(async () => {
    const vendorTicketRef = baseVendorTicketRef + vendorTicketNumber;
    vendorTicketRefHash = testHelper.hash(vendorTicketRef);
    vendorTicketNumber++;
    goodSellTicketVendorProof = signingTestHelper.getSellTicketVendorProof(accounts.eventOwner, goodEventId,
        vendorTicketRefHash, accounts.buyer);
  });

  async function doSellTicket(_params) {
    eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata, accounts.buyer, _params.vendorProof,
        doorData, {from: _params.sender});

    const logArgs = await testHelper.getLogArgs(eventsManager.LogTicketSold);
    return logArgs.ticketId;
  }

  async function doResellTicket(_params) {
    await eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof, accounts.newBuyer,
        _params.resellerProof, doorData, {from: _params.sender});
  }

  async function doCancelTicket(_params) {
    await eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
        {from: _params.sender});
  }

  context('sellTicket()', async () => {
    async function sellTicketSucceeds(_params) {
      eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata, accounts.buyer, _params.vendorProof,
          doorData, {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager.LogTicketSold);
      assert.equal(logArgs.eventId.toNumber(), _params.eventId);
      assert.equal(logArgs.vendorTicketRefHash, vendorTicketRefHash);
      assert.equal(logArgs.ticketMetadata, ticketMetadata);
      assert.equal(logArgs.vendorProof, _params.vendorProof);
      assert.equal(logArgs.doorData, doorData);
      assert.equal(logArgs.buyer, accounts.buyer);
    }

    async function sellTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata,
          accounts.buyer, _params.vendorProof, doorData, {from: _params.sender}), _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        goodParams = {
          eventId: goodEventId,
          vendorProof: goodSellTicketVendorProof,
          sender: accounts.eventOwner
        };
      });

      context('all-good', async () => {
        it('primary integrated via event owner', async () => {
          await sellTicketSucceeds(goodParams);
        });

        it('primary not integrated via event owner', async () => {
          goodParams.vendorProof = signingTestHelper.getSellTicketVendorProof(accounts.eventOwner, goodEventId,
              vendorTicketRefHash);

          await sellTicketSucceeds(goodParams);
        });
      });

      it('bad state: ticket has already been sold', async () => {
        await doSellTicket(goodParams);
        await sellTicketFails(goodParams, 'Ticket must not already be active');
      });
    });

    context('bad parameters', async () => {
      let badParams;

      beforeEach(async () => {
        badParams = {
          eventId: goodEventId,
          sender: accounts.eventOwner
        };
      });

      async function sellTicketFailsWithBadParams(_expectedError) {
        if (badParams.vendorProof === undefined) {
          badParams.vendorProof = signingTestHelper.getSellTicketVendorProof(accounts.eventOwner, badParams.eventId,
              vendorTicketRefHash, accounts.buyer);
        }

        await sellTicketFails(badParams, _expectedError);
      }

      it('event id (does not exist)', async () => {
        badParams.eventId = 9999;

        await sellTicketFailsWithBadParams('Event must be trading');
      });

      it('vendor proof (not provided)', async () => {
        badParams.vendorProof = '0x';

        await sellTicketFailsWithBadParams('Invalid Primary proof');
      });

      it('sender (not a registered vendor or broker)', async () => {
        badParams.sender = accounts.nobody;

        await sellTicketFailsWithBadParams('Primary or protocol active broker only');
      });

      it('sender (protocol registered broker for a non-integrated primary)', async () => {
        badParams.vendorProof = signingTestHelper.getSellTicketVendorProof(accounts.eventOwner, goodEventId,
            vendorTicketRefHash);
        badParams.sender = accounts.broker;

        await sellTicketFailsWithBadParams('Primary or event active broker only');
      });
    });
  });

  context('resellTicket()', async () => {
    let goodTicketId;

    beforeEach(async () => {
      goodTicketId = await doSellTicket({eventId: goodEventId, vendorProof: goodSellTicketVendorProof,
          sender: accounts.eventOwner}); //eslint-disable-line indent
    });

    async function resellTicketSucceeds(_params) {
      await eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof, accounts.newBuyer,
          _params.resellerProof, doorData, {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager.LogTicketResold);
      assert.equal(logArgs.eventId.toNumber(), _params.eventId);
      assert.equal(logArgs.ticketId.toNumber(), _params.ticketId);
      assert.equal(logArgs.resellerProof, _params.resellerProof);
      assert.equal(logArgs.doorData, doorData);
      assert.equal(logArgs.newBuyer, accounts.newBuyer);
    }

    async function resellTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof
          , accounts.newBuyer, _params.resellerProof, doorData, {from: _params.sender}), _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        const ticketOwnerProof = signingTestHelper.getResellTicketTicketOwnerProof(accounts.buyer, goodEventId, goodTicketId);
        const resellerProof = signingTestHelper.getResellTicketResellerProof(accounts.eventOwner, goodEventId, goodTicketId,
            ticketOwnerProof, accounts.newBuyer);

        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          ticketOwnerProof: ticketOwnerProof,
          resellerProof: resellerProof,
          sender: accounts.eventOwner
        };
      });

      it('all-good: via event owner', async () => {
        await resellTicketSucceeds(goodParams);
      });

      it('bad state: ticket has already been resold', async () => {
        await doResellTicket(goodParams);
        await resellTicketFails(goodParams, 'Resale must be signed by current owner');
      });
    });

    context('bad parameters', async () => {
      let badParams;

      async function resellTicketFailsWithBadParams(_expectedError) {
        if (badParams.ticketOwnerProof === undefined) {
          badParams.ticketOwnerProof = signingTestHelper.getResellTicketTicketOwnerProof(accounts.buyer, badParams.eventId,
              badParams.ticketId);
        }

        if (badParams.resellerProof === undefined) {
          badParams.resellerProof = signingTestHelper.getResellTicketResellerProof(accounts.eventOwner, badParams.eventId,
              badParams.ticketId, badParams.ticketOwnerProof, accounts.newBuyer);
        }

        await resellTicketFails(badParams, _expectedError);
      }

      beforeEach(async () => {
        badParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          sender: accounts.eventOwner
        };
      });

      it('event id (does not exist)', async () => {
        badParams.eventId = 9999;

        await resellTicketFailsWithBadParams('Event must be trading');
      });

      it('ticket id (does not exist)', async () => {
        badParams.ticketId = 9999;

        await resellTicketFailsWithBadParams('Ticket must be active');
      });

      it('ticket owner proof (not provided)', async () => {
        badParams.ticketOwnerProof = '0x';

        await resellTicketFailsWithBadParams('Resale must be signed by current owner');
      });

      it('reseller proof (not provided)', async () => {
        badParams.resellerProof = '0x';

        await resellTicketFailsWithBadParams('Invalid Secondary proof');
      });

      it('sender (not a registered reseller or broker)', async () => {
        badParams.sender = accounts.nobody;

        await resellTicketFailsWithBadParams('Secondary or protocol active broker only');
      });
    });
  });

  context('cancelTicket()', async () => {
    let goodTicketId;

    beforeEach(async () => {
      goodTicketId = await doSellTicket({eventId: goodEventId, vendorProof: goodSellTicketVendorProof,
          sender: accounts.eventOwner}); //eslint-disable-line indent
    });

    async function cancelTicketSucceeds(_params) {
      await eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
          {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager.LogTicketCancelled);
      assert.equal(logArgs.eventId.toNumber(), _params.eventId);
      assert.equal(logArgs.ticketId.toNumber(), _params.ticketId);
      assert.equal(logArgs.vendorProof, _params.vendorProof);
    }

    async function cancelTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
          {from: _params.sender}), _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        const vendorProof = signingTestHelper.getCancelTicketVendorProof(accounts.eventOwner, goodEventId, goodTicketId,
            accounts.buyer);

        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          vendorProof: vendorProof,
          sender: accounts.eventOwner
        };
      });

      it('all-good: via event owner', async () => {
        await cancelTicketSucceeds(goodParams);
      });

      it('bad state: ticket has already been cancelled', async () => {
        await doCancelTicket(goodParams);
        await cancelTicketFails(goodParams, 'Proof must be valid and signed by vendor');
      });
    });

    context('bad parameters', async () => {
      let badParams;

      beforeEach(async () => {
        badParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          sender: accounts.eventOwner
        };
      });

      async function cancelTicketFailsWithBadParams(_expectedError) {
        if (badParams.vendorProof === undefined) {
          badParams.vendorProof = signingTestHelper.getCancelTicketVendorProof(accounts.eventOwner, badParams.eventId,
              badParams.ticketId, accounts.buyer);
        }

        await cancelTicketFails(badParams, _expectedError);
      }

      it('event id (does not exist)', async () => {
        badParams.eventId = 9999;

        await cancelTicketFailsWithBadParams('Event must be trading');
      });

      it('ticket id (does not exist)', async () => {
        badParams.ticketId = 9999;

        await cancelTicketFailsWithBadParams('Ticket must be active');
      });

      it('vendor proof (not provided)', async () => {
        badParams.vendorProof = '0x';

        await cancelTicketFailsWithBadParams('Proof must be valid and signed by vendor');
      });

      it('sender (not registered vendor or broker)', async () => {
        badParams.sender = accounts.nobody;

        await cancelTicketFailsWithBadParams('Must be vendor or registered broker on this event');
      });
    });
  });
});