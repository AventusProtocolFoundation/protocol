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
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  // Use old (still in use) style by default.
  async function generateGoodCreateEventParams() {
    const eventDesc = 'My unique event' + Date.now();
    const thirtyDays = timeTestHelper.oneDay.mul(new BN(30));
    const offSaleTime = timeTestHelper.now().add(thirtyDays);
    const eventOwner = accounts.eventOwner;
    const eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(eventOwner, eventDesc, offSaleTime);
    const sender = accounts.eventOwner;

    return {
      eventDesc, offSaleTime, eventOwner, eventOwnerProof, sender
    };
  }

  // Use old (still in use) style by default.
  async function createEvent(_createEventParams) {
    await eventsManager.createEvent(
        _createEventParams.eventDesc,
        _createEventParams.offSaleTime,
        _createEventParams.eventOwnerProof,
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
      await eventsManager.createEvent(
          goodCreateEventParams.eventDesc,
          goodCreateEventParams.offSaleTime,
          goodCreateEventParams.eventOwnerProof,
          {from: goodCreateEventParams.sender}
      );
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
      assert.equal(logArgs.eventDesc, goodCreateEventParams.eventDesc);
      assert.equal(logArgs.eventOwner, goodCreateEventParams.eventOwner);
      testHelper.assertBNEquals(logArgs.offSaleTime, goodCreateEventParams.offSaleTime);
      return goodEventId = logArgs.eventId;
    }

    async function createEventFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.createEvent(_params.eventDesc, _params.offSaleTime,
          _params.eventOwnerProof, {from: _params.sender}), _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('via event owner', async () => {
          await createEventSucceeds();
        });

        it('via validator', async () => {
          goodCreateEventParams.sender = accounts.validator;
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
                badParams.eventDesc, badParams.offSaleTime);
          }
          return createEventFails(badParams, _errorString);
        }

        it('event description', async () => {
          badParams.eventDesc = '';
          await createEventFailsWithBadParams('Event requires a non-empty description');
        });

        it('off sale time', async () => {
          badParams.offSaleTime = timeTestHelper.now().toNumber() - 1;
          await createEventFailsWithBadParams('Ticket off-sale time must be in the future');
        });

        it('event owner proof', async () => {
          badParams.eventOwnerProof = testHelper.randomBytes32();
          await createEventFailsWithBadParams('Sender must be an active validator');
        });

        it('sender', async () => {
          badParams.sender = accounts.notEventOwner;
          await createEventFailsWithBadParams('Sender must be an active validator');
        });
      });
    });
  });
});