const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

const BN = testHelper.BN;

// TODO: These tests could do with a refactor now events can be duplicated
contract('EventsManager - events', async () => {
  let eventsManager, accounts;

  const badEventId = 9999;

  before(async () => {
    await testHelper.init();
    await signingTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    eventsManager = testHelper.getEventsManager();
    accounts = testHelper.getAccounts('eventOwner', 'notEventOwner', 'validator');
    await membersTestHelper.depositAndRegisterMember(accounts.validator, membersTestHelper.memberTypes.validator);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.validator, membersTestHelper.memberTypes.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function generateGoodCreateEventParams() {
    const eventDesc = 'My unique event' + Date.now();
    const thirtyDays = timeTestHelper.oneDay.mul(new BN(30));
    const offSaleTime = timeTestHelper.now().add(thirtyDays);
    const eventTime = offSaleTime.add(thirtyDays);
    const eventOwner = accounts.eventOwner;
    const sender = accounts.validator;
    const eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(
        eventOwner, eventDesc, eventTime, offSaleTime, sender);
    return {
      eventDesc, eventTime, offSaleTime, eventOwner, eventOwnerProof, eventOwner, sender
    };
  }

  async function createEvent(_createEventParams) {
    await eventsManager.createEvent(
        _createEventParams.eventDesc,
        _createEventParams.eventTime,
        _createEventParams.offSaleTime,
        _createEventParams.eventOwnerProof,
        _createEventParams.eventOwner,
        {from: _createEventParams.sender}
    );
    const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
    return logArgs.eventId;
  }

  context('createEvent()', async () => {
    let goodCreateEventParams, goodEventId;

    beforeEach(async () => {
      // Set up the goodness for all tests.
      goodCreateEventParams = await generateGoodCreateEventParams();
    });

    async function createEventSucceeds() {
      if (goodCreateEventParams.eventOwnerProof === undefined) {
        goodCreateEventParams.eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(
            goodCreateEventParams.eventOwner, goodCreateEventParams.eventDesc, goodCreateEventParams.eventTime,
            goodCreateEventParams.offSaleTime, goodCreateEventParams.sender);
      }
      await eventsManager.createEvent(
          goodCreateEventParams.eventDesc,
          goodCreateEventParams.eventTime,
          goodCreateEventParams.offSaleTime,
          goodCreateEventParams.eventOwnerProof,
          goodCreateEventParams.eventOwner,
          {from: goodCreateEventParams.sender}
      );
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
      assert.equal(logArgs.eventDesc, goodCreateEventParams.eventDesc);
      testHelper.assertBNEquals(logArgs.eventTime, goodCreateEventParams.eventTime);
      assert.equal(logArgs.eventOwner, goodCreateEventParams.eventOwner);
      testHelper.assertBNEquals(logArgs.offSaleTime, goodCreateEventParams.offSaleTime);
      return goodEventId = logArgs.eventId;
    }

    async function createEventFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.createEvent(_params.eventDesc, _params.eventTime, _params.offSaleTime,
          _params.eventOwnerProof, _params.eventOwner, {from: _params.sender}), _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('via event owner', async () => {
          goodCreateEventParams.sender = accounts.eventOwner;
          goodCreateEventParams.eventOwnerProof = undefined; // Regenerate the proof with this sender.
          await createEventSucceeds();
        });

        it('via validator', async () => {
          await createEventSucceeds();
        });
      });

      context('good state', async () => {
        it('can create a duplicate event', async () => {
          const firstEventId = await createEventSucceeds();
          const secondEventId = await createEventSucceeds();
          assert.notEqual(firstEventId, secondEventId);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        let badParams;

        beforeEach(async () => {
          badParams = goodCreateEventParams;
          badParams.eventOwnerProof = undefined;  // Default to creating the proof.
        });

        async function createEventFailsWithBadParams(_errorString) {
          if (badParams.eventOwnerProof === undefined) {
            badParams.eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(badParams.eventOwner,
                badParams.eventDesc, badParams.eventTime, badParams.offSaleTime, badParams.sender);
          }
          return createEventFails(badParams, _errorString);
        }

        it('event description', async () => {
          badParams.eventDesc = '';
          await createEventFailsWithBadParams('Event requires a non-empty description');
        });

        it('event time', async () => {
          badParams.eventTime = badParams.offSaleTime - 1;
          await createEventFailsWithBadParams('Event time must be after off-sale time');
        });

        it('off sale time', async () => {
          badParams.offSaleTime = timeTestHelper.now().toNumber() - 1;
          await createEventFailsWithBadParams('Ticket off-sale time must be in the future');
        });

        it('event owner proof', async () => {
          badParams.eventOwnerProof = testHelper.randomBytes32();
          await createEventFailsWithBadParams('Creation proof must be valid and signed by event owner');
        });

        it('sender', async () => {
          badParams.sender = accounts.notEventOwner;
          await createEventFailsWithBadParams('Sender must be an active validator');
        });
      });
    });
  });

  context('takeEventOffSale()', async () => {
    let goodEventOwner, goodValidator, goodSender, goodEventId, goodOffSaleEventOwnerProof;

    beforeEach(async () => {
      const goodCreateEventParams = await generateGoodCreateEventParams();
      goodEventOwner = goodCreateEventParams.eventOwner;
      goodValidator = accounts.validator;
      goodSender = goodEventOwner;
      goodEventId = await createEvent(goodCreateEventParams);
      goodOffSaleEventOwnerProof = await signingTestHelper.getTakeEventOffSaleEventOwnerProof(goodEventOwner, goodEventId);
    });

    async function takeEventOffSaleSucceeds(_sender) {
      await eventsManager.takeEventOffSale(goodEventId, goodOffSaleEventOwnerProof, {from: _sender});
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventTakenOffSale');
      assert.equal(logArgs.eventId.toNumber(), goodEventId);
    }

    async function takeEventOffSaleFails(_eventId, _eventOwnerProof, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.takeEventOffSale(_eventId, _eventOwnerProof, {from: _sender}),
          _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('via event owner', async () => {
          await takeEventOffSaleSucceeds(goodEventOwner);
        });

        it('via validator', async () => {
          await takeEventOffSaleSucceeds(goodValidator);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('event id', async () => {
          // Update the proof otherwise we'd have two bad parameters.
          goodOffSaleEventOwnerProof = await signingTestHelper.getTakeEventOffSaleEventOwnerProof(goodEventOwner, badEventId);
          await takeEventOffSaleFails(badEventId, goodOffSaleEventOwnerProof, goodSender,
              'Event must be trading');
        });

        it('event owner proof', async () => {
          const badEventOwnerProof = testHelper.randomBytes32();
          await takeEventOffSaleFails(goodEventId, badEventOwnerProof, goodSender,
              'Offsale proof must be valid and signed by event owner');
        });

        it('sender', async () => {
          const badSender = accounts.notEventOwner;
          await takeEventOffSaleFails(goodEventId, goodOffSaleEventOwnerProof, badSender,
              'Sender must be owner or validator on event');
        });
      });
    });
  });
});
