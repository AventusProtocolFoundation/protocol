const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');

contract('ValidatorsManager - activity', async () => {
  let accounts;

  let validatorsManager;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    validatorsManager = testHelper.getValidatorsManager();
    accounts = testHelper.getAccounts('goodValidator', 'badValidator');
    await validatorsTestHelper.depositAndRegisterValidator(accounts.goodValidator);
  });

  after(async () => {
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.goodValidator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('validatorIsRegistered()', async () => {
    async function assertValidatorRegistered() {
      const isRegistered = await validatorsManager.validatorIsRegistered(accounts.goodValidator);
      assert(isRegistered);
    }

    async function assertValidatorUnregistered(_validatorAddress) {
      const isRegistered = await validatorsManager.validatorIsRegistered(_validatorAddress);
      assert(!isRegistered);
    }

    it('returns true for registered validator and correct validator type', async () => {
      assertValidatorRegistered();
    });

    context('returns false', async () => {
      it('for an address that has not been registered as a validator', async () => {
        assertValidatorUnregistered(accounts.badValidator);
      });
    });

    // NOTE: validatorIsRegistered() cannot revert: there is no bad state etc.
  });
});