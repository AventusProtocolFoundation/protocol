const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

contract('MembersManager - activity', async () => {
  const accounts = testHelper.getAccounts('goodMember', 'badMember');
  const goodMemberType = membersTestHelper.memberTypes.broker;
  const badMemberType = membersTestHelper.memberTypes.bad;

  let membersManager;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);

    membersManager = testHelper.getMembersManager();
    await membersTestHelper.depositAndRegisterMember(accounts.goodMember, goodMemberType);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.goodMember, goodMemberType);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  context('memberIsActive()', async () => {
    async function assertMemberActive() {
      const isActive = await membersManager.memberIsActive(accounts.goodMember, goodMemberType);
      assert(isActive);
    }

    async function assertMemberInactive(_memberAddress, _memberType) {
      const isActive = await membersManager.memberIsActive(_memberAddress, _memberType);
      assert(!isActive);
    }

    it('returns true for active member and correct member type', async () => {
      assertMemberActive();
    });

    context('returns false', async () => {
      it('for an address that has not been registered as a member', async () => {
        assertMemberInactive(accounts.badMember, goodMemberType);
      });

      it('for incorrect member type', async () => {
        assertMemberInactive(accounts.goodMember, badMemberType);
      });
    });

    // NOTE: memberIsActive() cannot revert: there is no bad state etc.
  });
});