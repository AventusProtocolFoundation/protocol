const avtTestHelper = require('./helpers/avtTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

contract('EventsManager - role management', async () => {
  let eventsManager, accounts,
      goodEventOwner, goodEventId, goodRoleAddress, goodRole, goodMember, goodValidatorMemberType, goodSender,
      goodRegisterRoleEventOwnerProof, badEventOwner, badEventId, badRole, badSender;

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
    goodValidatorRole = eventsTestHelper.roles.validator;
    goodValidatorMemberType = membersTestHelper.memberTypes.validator;
    goodSender = goodEventOwner;
    badEventOwner = accounts.invalid;
    badEventId = 999;
    badRole = eventsTestHelper.roles.invalid;
    badSender = accounts.invalid;
  });

  context('registerRoleOnEvent()', async () => {
    async function registerRoleOnEventSucceeds(_sender) {
      const registerRoleEventOwnerProof = await signingTestHelper.getRegisterRoleEventOwnerProof(goodEventOwner, goodEventId,
          goodRoleAddress, goodRole);
      await eventsManager.registerRoleOnEvent(goodEventId, goodRoleAddress, goodRole, registerRoleEventOwnerProof,
          {from: _sender});
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventRoleRegistered');
      assert.equal(logArgs.eventId.toNumber(), goodEventId.toNumber());
      assert.equal(logArgs.roleAddress, goodRoleAddress);
      assert.equal(logArgs.role, goodRole);
    }

    async function registerRoleOnEventFails(_eventId, _roleAddress, _role, _eventOwnerProof, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.registerRoleOnEvent(_eventId, _roleAddress, _role, _eventOwnerProof,
          {from: _sender}), _expectedError);
    }

    context('succeeds with good parameters', async () => {
      it('via event owner', async () => {
        goodEventId = await eventsTestHelper.createEvent(goodEventOwner);
        await registerRoleOnEventSucceeds(goodSender);
      });

      it('via validator', async () => {
        await membersTestHelper.depositAndRegisterMember(goodValidatorAddress, goodValidatorMemberType);
        goodEventId = await eventsTestHelper.createEvent(goodEventOwner, goodValidatorAddress);
        await registerRoleOnEventSucceeds(goodValidatorAddress);
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodValidatorAddress, goodValidatorMemberType);
      });
    });

    context('fails with', async () => {
      beforeEach(async () => {
        goodEventId = await eventsTestHelper.createEvent(goodEventOwner);
        goodRegisterRoleEventOwnerProof = await signingTestHelper.getRegisterRoleEventOwnerProof(goodEventOwner, goodEventId,
            goodRoleAddress, goodRole);
      });

      context('bad parameters', async () => {
        it('eventId', async () => {
          await registerRoleOnEventFails(badEventId, goodRoleAddress, goodRole, goodRegisterRoleEventOwnerProof, goodSender,
              'Event must exist');
        });

        it('role', async () => {
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, badRole, goodRegisterRoleEventOwnerProof, goodSender,
              'Role is not registrable: ' + badRole);
        });

        it('sender', async () => {
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, goodRole, goodRegisterRoleEventOwnerProof, badSender,
              'Sender must be owner or validator on event');
        });

        it('proof', async () => {
          const badRegisterRoleEventOwnerProof = await signingTestHelper.getRegisterRoleEventOwnerProof(badEventOwner,
              goodEventId, goodRoleAddress, goodRole);
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, goodRole, badRegisterRoleEventOwnerProof, goodSender,
              'Registration proof must be valid and signed by event owner');
        });
      });

      context('bad state', async () => {
        it('address is already registered for this role on event', async () => {
          await eventsManager.registerRoleOnEvent(goodEventId, goodRoleAddress, goodRole, goodRegisterRoleEventOwnerProof);
          await registerRoleOnEventFails(goodEventId, goodRoleAddress, goodRole, goodRegisterRoleEventOwnerProof, goodSender,
              'Role is already registered on event');
        });
      });
    });
  });
});