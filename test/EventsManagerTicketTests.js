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
  const doorData = testHelper.randomBytes32();
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
    goodEventId = await eventsTestHelper.createEvent(accounts.eventOwner);
    await membersTestHelper.depositAndRegisterMember(accounts.validator, membersTestHelper.memberTypes.validator);
    await eventsManager.registerRoleOnEvent(goodEventId, accounts.validator, eventsTestHelper.roles.validator,
      {from: accounts.eventOwner});
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.validator, membersTestHelper.memberTypes.validator);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  beforeEach(async () => {
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
        _params.resellerProof, doorData, {from: _params.sender});
  }

  async function doCancelTicket(_params) {
    await eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
        {from: _params.sender});
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
          _params.resellerProof, doorData, {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketResold');
      testHelper.assertBNEquals(logArgs.eventId, _params.eventId);
      testHelper.assertBNEquals(logArgs.ticketId, _params.ticketId);
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
        const ticketOwnerProof = await signingTestHelper.getResellTicketTicketOwnerProof(accounts.buyer, goodEventId,
            goodTicketId);
        const resellerProof = await signingTestHelper.getResellTicketResellerProof(accounts.eventOwner, goodEventId,
            goodTicketId, ticketOwnerProof, accounts.newBuyer);

        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          ticketOwnerProof: ticketOwnerProof,
          resellerProof: resellerProof,
          sender: accounts.eventOwner
        };
      });

      context('succeeds with good state', async () => {
        it('via event owner', async () => {
          await resellTicketSucceeds(goodParams);
        });

        it('via non-integrated event owner', async () => {
          goodParams.resellerProof = await signingTestHelper.getResellTicketResellerProof(goodParams.sender,
              goodParams.eventId, goodParams.ticketId, goodParams.ticketOwnerProof);

          await resellTicketSucceeds(goodParams);
        });

        it('via validator', async () => {
          goodParams.sender = accounts.validator;
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

        if (badParams.resellerProof === undefined) {
          badParams.resellerProof = await signingTestHelper.getResellTicketResellerProof(accounts.eventOwner, badParams.eventId,
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

      it('reseller proof', async () => {
        badParams.resellerProof = '0x';

        await resellTicketFailsWithBadParams('Invalid Secondary proof');
      });

      it('sender', async () => {
        badParams.sender = accounts.nobody;

        await resellTicketFailsWithBadParams('Sender must be validator or reseller on event');
      });
    });
  });

  context('cancelTicket()', async () => {
    let goodTicketId;

    beforeEach(async () => {
      goodTicketId = await doSellTicket({eventId: goodEventId, sender: accounts.eventOwner});
    });

    async function cancelTicketSucceeds(_params) {
      await eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
          {from: _params.sender});

      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketCancelled');
      testHelper.assertBNEquals(logArgs.eventId, _params.eventId);
      testHelper.assertBNEquals(logArgs.ticketId, _params.ticketId);
      assert.equal(logArgs.vendorProof, _params.vendorProof);
    }

    async function cancelTicketFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.cancelTicket(_params.eventId, _params.ticketId, _params.vendorProof,
          {from: _params.sender}), _expectedError);
    }

    context('good parameters', async () => {
      let goodParams;

      beforeEach(async () => {
        const vendorProof = await signingTestHelper.getCancelTicketVendorProof(accounts.eventOwner, goodEventId, goodTicketId,
            accounts.buyer);

        goodParams = {
          eventId: goodEventId,
          ticketId: goodTicketId,
          vendorProof: vendorProof,
          sender: accounts.eventOwner
        };
      });

      context('succeeds with good state', async () => {
        it('via event owner', async () => {
          await cancelTicketSucceeds(goodParams);
        });

        it('via validator', async () => {
          goodParams.sender = accounts.validator;
          await cancelTicketSucceeds(goodParams);
        });
      });

      context('fails with bad state', async () => {
        it('ticket has already been cancelled', async () => {
          await doCancelTicket(goodParams);
          await cancelTicketFails(goodParams, 'Proof must be valid and signed by vendor');
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
        if (badParams.vendorProof === undefined) {
          badParams.vendorProof = await signingTestHelper.getCancelTicketVendorProof(accounts.eventOwner, badParams.eventId,
              badParams.ticketId, accounts.buyer);
        }

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

      it('vendor proof', async () => {
        badParams.vendorProof = '0x';

        await cancelTicketFailsWithBadParams('Proof must be valid and signed by vendor');
      });

      it('sender', async () => {
        badParams.sender = accounts.nobody;

        await cancelTicketFailsWithBadParams('Sender must be validator or vendor on event');
      });
    });
  });

  // TODO: This has to be done last because all the tests use the same event which must always be in the correct state.
  // This is BAD! We should not be sharing such state between contexts as it means we can't have ANY bad event state tests :(
  // Refactor this file so they don't share this state then move this into the sellTicket context.
  context('extra tests for coverage', async () => {
    it ('sellTicket bad state', async () => {
      const goodParams = {
        eventId: goodEventId,
        sender: accounts.eventOwner
      };

      await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
      await sellTicketFails(goodParams, 'Event must be trading');
    });
  });
});