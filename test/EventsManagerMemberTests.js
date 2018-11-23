const avtTestHelper = require('./helpers/avtTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

contract('EventsManager - member management', async () => {
  const accounts = testHelper.getAccounts('eventOwner', 'secondary', 'notAMember');

  const goodEventOwner = accounts.eventOwner;
  const goodMemberAddress = accounts.secondary;
  const goodMemberType = membersTestHelper.memberTypes.secondary;
  const goodSender = goodEventOwner;

  const badEventId = 999;
  const badMemberAddress = accounts.notAMember;
  const badEventOwner = accounts.notAMember;
  const badMemberType = membersTestHelper.memberTypes.bad;
  const badSender = badEventOwner;

  let goodEventId, eventsManager;

  before( async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);

    eventsManager = testHelper.getEventsManager();

    goodEventId = await eventsTestHelper.depositAndCreateEvent(goodEventOwner);
    await membersTestHelper.depositAndRegisterMember(goodMemberAddress, goodMemberType);
  });

  after(async () => {
    await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEventOwner, goodEventId);
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMemberAddress, goodMemberType);
  });

  context('registerMemberOnEvent()', async () => {
    async function registerMemberOnEventSucceeds() {
      await eventsManager.registerMemberOnEvent(goodEventId, goodMemberAddress, goodMemberType, {from:goodSender});
      const logArgs = await testHelper.getLogArgs(eventsManager.LogMemberRegisteredOnEvent);
      assert.equal(logArgs.eventId.toNumber(), goodEventId.toNumber());
      assert.equal(logArgs.memberAddress, goodMemberAddress);
      assert.equal(logArgs.memberType, goodMemberType);
    }

    async function registerMemberOnEventFails(_eventId, _memberAddress, _memberType, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.registerMemberOnEvent(_eventId, _memberAddress, _memberType,
          {from: _sender}), _expectedError);
    }

    it('all good', async () => {
      await registerMemberOnEventSucceeds();
    });

    context('bad parameters', async () => {
      before(async () => {
        await eventsManager.deregisterMemberFromEvent(goodEventId, goodMemberAddress, goodMemberType, {from: goodSender});
      });

      it('eventId', async () => {
        await registerMemberOnEventFails(badEventId, goodMemberAddress, goodMemberType, goodSender, 'Event must exist');
      });

      it('memberAddress', async () => {
        await registerMemberOnEventFails(goodEventId, badMemberAddress, goodMemberType, goodSender,
            'Member must be registered on protocol');
      });

      it('memberType', async () => {
        await registerMemberOnEventFails(goodEventId, goodMemberAddress, badMemberType, goodSender,
            'Member type must be Primary, Secondary or Broker');
      });

      it('sender', async () => {
        await registerMemberOnEventFails(goodEventId, goodMemberAddress, goodMemberType, badSender,
            'Function must be called by owner');
      });
    });

    context('bad states', async () => {
      it('member is not registered on the protocol', async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMemberAddress, goodMemberType);
        await registerMemberOnEventFails(goodEventId, goodMemberAddress, goodMemberType, goodSender,
            'Member must be registered on protocol');
        await membersTestHelper.depositAndRegisterMember(goodMemberAddress, goodMemberType);
      });

      it('member is already registered on event', async () => {
        await eventsManager.registerMemberOnEvent(goodEventId, goodMemberAddress, goodMemberType);
        await registerMemberOnEventFails(goodEventId, goodMemberAddress, goodMemberType, goodSender,
            'Member is already registered on event');
        await eventsManager.deregisterMemberFromEvent(goodEventId, goodMemberAddress, goodMemberType);
      });
    });
  });

  context('deregisterMemberFromEvent()', async () => {
    before(async () => {
      await eventsManager.registerMemberOnEvent(goodEventId, goodMemberAddress, goodMemberType);
    });

    async function deregisterMemberFromEventSucceeds() {
      await eventsManager.deregisterMemberFromEvent(goodEventId, goodMemberAddress, goodMemberType, {from: goodSender});
      const logArgs = await testHelper.getLogArgs(eventsManager.LogMemberDeregisteredFromEvent);
      assert.equal(logArgs.eventId.toNumber(), goodEventId.toNumber());
      assert.equal(logArgs.memberAddress, goodMemberAddress);
      assert.equal(logArgs.memberType, goodMemberType);
    }

    async function deregisterMemberFromEventFails(_eventId, _memberAddress, _memberType, _sender, _expectedError) {
      await testHelper.expectRevert(
          () => eventsManager.deregisterMemberFromEvent(_eventId, _memberAddress, _memberType, {from: _sender}),
          _expectedError);
    }

    it('all good', async () => {
      await deregisterMemberFromEventSucceeds(goodEventId, goodMemberAddress, goodMemberType, goodEventOwner);
    });

    context('bad parameters', async () => {
      before(async () => {
        await eventsManager.registerMemberOnEvent(goodEventId, goodMemberAddress, goodMemberType);
      });

      it('eventId', async () => {
        await deregisterMemberFromEventFails(badEventId, goodMemberAddress, goodMemberType, goodSender, 'Event must exist');
      });

      it('memberAddress', async () => {
        await deregisterMemberFromEventFails(goodEventId, badMemberAddress, goodMemberType, goodSender,
            'Member is not registered on event');
      });

      it('memberType', async () => {
        await deregisterMemberFromEventFails(goodEventId, goodMemberAddress, badMemberType, goodSender,
            'Member type must be Primary, Secondary or Broker');
      });

      it('sender', async () => {
        await deregisterMemberFromEventFails(goodEventId, goodMemberAddress, goodMemberType, badSender,
            'Function must be called by owner');
      });
    });

    context('bad state', async () => {
      it('member is already deregistered from the event', async () => {
        await eventsManager.deregisterMemberFromEvent(goodEventId, goodMemberAddress, goodMemberType, {from: goodSender});
        await deregisterMemberFromEventFails(goodEventId, goodMemberAddress, goodMemberType, goodSender,
            'Member is not registered on event');
      });
    });
  });
});