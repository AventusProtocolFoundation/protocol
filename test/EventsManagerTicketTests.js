const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

let eventsManager;

contract('Events manager - tickets', async () => {

  let accounts;
  const ticketMetadata = 'Some metadata';
  const baseVendorTicketRef = 'Vendor ref ';

  let vendorTicketNumber = 0;
  let goodEventId, vendorTicketRefHash;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    eventsManager = await testHelper.getEventsManager();

    accounts = testHelper.getAccounts('eventOwner', 'validator', 'buyer', 'newBuyer', 'nobody');
    await membersTestHelper.depositAndRegisterMember(accounts.validator, membersTestHelper.memberTypes.validator);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.validator, membersTestHelper.memberTypes.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  beforeEach(async () => {
    goodEventId = await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator);
    const vendorTicketRef = baseVendorTicketRef + vendorTicketNumber;
    vendorTicketRefHash = testHelper.hash(vendorTicketRef);
    vendorTicketNumber++;
  });

  async function doSellTicket(_params) {
    await eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata, accounts.buyer,
        {from: _params.sender});

    const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketSold');
    return logArgs.ticketId;
  }

  async function doResellTicket(_params) {
    await eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof, accounts.newBuyer,
        {from: _params.sender});
  }

  async function doCancelTicket(_params) {
    await eventsManager.cancelTicket(_params.eventId, _params.ticketId, {from: _params.sender});
  }

  async function sellTicketFails(_params, _expectedError) {
    await testHelper.expectRevert(() => eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata,
        accounts.buyer, {from: _params.sender}), _expectedError);
  }

  context('sellTicket()', async () => {
    async function sellTicketSucceeds(_params) {
      await eventsManager.sellTicket(_params.eventId, vendorTicketRefHash, ticketMetadata, accounts.buyer,
          {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketSold');
      testHelper.assertBNEquals(logArgs.eventId, _params.eventId);
      assert.equal(logArgs.vendorTicketRefHash, vendorTicketRefHash);
      assert.equal(logArgs.ticketMetadata, ticketMetadata);
      assert.equal(logArgs.buyer, accounts.buyer);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        goodParams = {
          eventId: goodEventId,
          sender: accounts.eventOwner
        };
      });

      context('succeeds with good state', async () => {
        it('via event owner', async () => {
          await sellTicketSucceeds(goodParams);
        });
      });

      context('fails with bad state', async () => {
        it('ticket has already been sold', async () => {
          await doSellTicket(goodParams);
          await sellTicketFails(goodParams, 'Ticket must not already be active');
        });

        it('event has gone off sale', async () => {
          await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
          await sellTicketFails(goodParams, 'Event must be trading');
        });
      });
    });

    context('fails with bad parameters', async () => {
      let badParams;

      beforeEach(async () => {
        badParams = {
          eventId: goodEventId,
          sender: accounts.eventOwner
        };
      });

      async function sellTicketFailsWithBadParams(_expectedError) {
        await sellTicketFails(badParams, _expectedError);
      }

      it('event id', async () => {
        badParams.eventId = 9999;

        await sellTicketFailsWithBadParams('Event must be trading');
      });

      it('sender', async () => {
        badParams.sender = accounts.nobody;

        await sellTicketFailsWithBadParams('Sender must be vendor on event');
      });
    });
  });

  context('resellTicket()', async () => {
    let goodTicketId;

    beforeEach(async () => {
      goodTicketId = await doSellTicket({eventId: goodEventId, sender: accounts.eventOwner});
    });

    async function resellTicketSucceeds(_params) {
      await eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof, accounts.newBuyer,
          {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketResold');
      testHelper.assertBNEquals(logArgs.eventId, _params.eventId);
      testHelper.assertBNEquals(logArgs.ticketId, _params.ticketId);
      assert.equal(logArgs.newBuyer, accounts.newBuyer);
    }

    async function resellTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.resellTicket(_params.eventId, _params.ticketId, _params.ticketOwnerProof
          , accounts.newBuyer, {from: _params.sender}), _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        const ticketOwnerProof = await signingTestHelper.getResellTicketTicketOwnerProof(accounts.buyer, goodEventId,
            goodTicketId);

        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          ticketOwnerProof: ticketOwnerProof,
          sender: accounts.eventOwner
        };
      });

      context('succeeds with good state', async () => {
        it('via event owner', async () => {
          await resellTicketSucceeds(goodParams);
        });
      });

      context('fails with bad state', async () => {
        it('ticket has already been resold', async () => {
          await doResellTicket(goodParams);
          await resellTicketFails(goodParams, 'Resale must be signed by current owner');
        });
      });
    });

    context('fails with bad parameters', async () => {
      let badParams;

      async function resellTicketFailsWithBadParams(_expectedError) {
        if (badParams.ticketOwnerProof === undefined) {
          badParams.ticketOwnerProof = await signingTestHelper.getResellTicketTicketOwnerProof(accounts.buyer,
              badParams.eventId, badParams.ticketId);
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

      it('event id', async () => {
        badParams.eventId = 9999;

        await resellTicketFailsWithBadParams('Event must be trading');
      });

      it('ticket id', async () => {
        badParams.ticketId = 9999;

        await resellTicketFailsWithBadParams('Ticket must be active');
      });

      it('ticket owner proof', async () => {
        badParams.ticketOwnerProof = '0x';

        await resellTicketFailsWithBadParams('Resale must be signed by current owner');
      });

      it('sender', async () => {
        badParams.sender = accounts.nobody;

        await resellTicketFailsWithBadParams('Sender must be reseller on event');
      });
    });
  });

  context('cancelTicket()', async () => {
    let goodTicketId;

    beforeEach(async () => {
      goodTicketId = await doSellTicket({eventId: goodEventId, sender: accounts.eventOwner});
    });

    async function cancelTicketSucceeds(_params) {
      await eventsManager.cancelTicket(_params.eventId, _params.ticketId, {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketCancelled');
      testHelper.assertBNEquals(logArgs.eventId, _params.eventId);
      testHelper.assertBNEquals(logArgs.ticketId, _params.ticketId);
    }

    async function cancelTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.cancelTicket(_params.eventId, _params.ticketId, {from: _params.sender}),
          _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          sender: accounts.eventOwner
        };
      });

      context('succeeds with good state', async () => {
        it('via event owner', async () => {
          await cancelTicketSucceeds(goodParams);
        });
      });
    });

    context('fails with bad parameters', async () => {
      let badParams;

      beforeEach(async () => {
        badParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          sender: accounts.eventOwner
        };
      });

      async function cancelTicketFailsWithBadParams(_expectedError) {
        await cancelTicketFails(badParams, _expectedError);
      }

      it('event id', async () => {
        badParams.eventId = 9999;

        await cancelTicketFailsWithBadParams('Event must be trading');
      });

      it('ticket id', async () => {
        badParams.ticketId = 9999;

        await cancelTicketFailsWithBadParams('Ticket must be active');
      });

      it('sender', async () => {
        badParams.sender = accounts.nobody;

        await cancelTicketFailsWithBadParams('Sender must be vendor on event');
      });
    });
  });
});