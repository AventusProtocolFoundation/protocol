const avtTestHelper = require('./helpers/avtTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

contract('EventsManager - role management', async () => {
  let eventsManager, accounts,
      goodEventOwner, goodEventId, goodRoleAddress, goodRole, goodMember, goodValidatorMemberType, goodSender,
      badEventOwner, badEventId, badRole, badSender;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await signingTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);

    eventsManager = testHelper.getEventsManager();
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'primary', 'invalid');
    goodEventOwner = accounts.eventOwner;
    goodRoleAddress = accounts.primary;
    goodRole = eventsTestHelper.roles.primary;
    goodValidatorAddress = accounts.validator;
    goodValidatorMemberType = membersTestHelper.memberTypes.validator;
    goodSender = goodEventOwner;
    badEventOwner = accounts.invalid;
    badEventId = 999;
    badRole = eventsTestHelper.roles.invalid;
    badSender = accounts.invalid;
  });

  beforeEach(async () => {
    goodEventId = await eventsTestHelper.createEvent(goodEventOwner);
  });

  context('registerRoleOnEvent()', async () => {
    async function registerRoleOnEventSucceeds(_roleAddress, _role) {
      await eventsManager.registerRoleOnEvent(goodEventId, _roleAddress, _role, {from:goodSender});
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogRoleRegisteredOnEvent');
      assert.equal(logArgs.eventId.toNumber(), goodEventId.toNumber());
      assert.equal(logArgs.roleAddress, _roleAddress);
      assert.equal(logArgs.role, _role);
    }

    async function registerRoleOnEventFails(_eventId, _roleAddress, _role, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.registerRoleOnEvent(_eventId, _roleAddress, _role, {from: _sender}),
          _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await registerRoleOnEventSucceeds(goodRoleAddress, goodRole);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('eventId', async () => {
          await registerRoleOnEventFails(badEventId, goodRoleAddress, goodRole, goodSender, 'Event must exist');
        });

        it('role', async () => {
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, badRole, goodSender,
              'Role must be Primary, Secondary or Validator');
        });

        it('sender', async () => {
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, goodRole, badSender,
              'Function must be called by owner');
        });
      });

      context('bad state', async () => {
        it('address is already registered for this role on event', async () => {
          await eventsManager.registerRoleOnEvent(goodEventId, goodRoleAddress, goodRole);
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, goodRole, goodSender,
              'Role is already registered on event');
        });
      });
    });
  });
});