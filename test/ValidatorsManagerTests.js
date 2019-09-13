const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const BN = testHelper.BN;

contract('ValidatorsManager', async () => {
  let validatorsManager, accounts, goodValidator;

  const goodEvidenceURL = testHelper.validEvidenceURL;
  const goodValidatorDescription = 'Some validator to be registered';
  const badValidatorAddress = testHelper.zeroAddress;
  const validatorDepositInAVTDecimals = avtTestHelper.toNat(new BN(5000)); // From ParameterRegistry


  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    validatorsManager = testHelper.getValidatorsManager();
    accounts = testHelper.getAccounts('validator', 'otherValidator', 'validator');
    goodValidator = accounts.validator;
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function makeDepositForNewValidator(_account) {
    let deposit = validatorDepositInAVTDecimals;
    await avtTestHelper.addAVT(deposit, _account);
    return deposit;
  }

  async function withdrawDepositForNewValidator(_account) {
    let deposit = validatorDepositInAVTDecimals;
    await avtTestHelper.withdrawAVT(deposit, _account);
  }

  context('registerValidator()', async () => {
    let goodValidatorDeposit;

    async function registerValidatorSucceeds(_expectedDeposit) {
      await validatorsManager.registerValidator(accounts.validator, goodEvidenceURL, goodValidatorDescription);

      const logArgs = await testHelper.getLogArgs(validatorsManager, 'LogValidatorRegistered');
      assert.equal(logArgs.validatorAddress, accounts.validator);
      assert.equal(logArgs.evidenceUrl, goodEvidenceURL);
      assert.equal(logArgs.desc, goodValidatorDescription);
      testHelper.assertBNEquals(logArgs.deposit, _expectedDeposit);
    }

    async function registerValidatorFails(_validatorAddress, _evidenceURL, _description, _expectedError) {
      await testHelper.expectRevert(() => validatorsManager.registerValidator(_validatorAddress, _evidenceURL, _description),
          _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        goodValidatorDeposit = await makeDepositForNewValidator(goodValidator);
        await registerValidatorSucceeds(goodValidatorDeposit);
        await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        beforeEach(async () => {
          goodValidatorDeposit = await makeDepositForNewValidator(goodValidator);
        });

        afterEach(async () => {
          await avtTestHelper.withdrawAVT(goodValidatorDeposit, goodValidator);
        });

        it('evidenceURL', async () => {
          await registerValidatorFails(goodValidator, '', goodValidatorDescription,
              'Validator requires a non-empty evidence URL');
        });

        it('desc', async () => {
          await registerValidatorFails(goodValidator, goodEvidenceURL, '', 'Validator requires a non-empty description');
        });
      });

      context('bad state', async () => {
        it('validator has already been registered', async () => {
          await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
          await registerValidatorFails(goodValidator, goodEvidenceURL, goodValidatorDescription,
              'Validator must not be registered');
          await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        });

        it('insufficient deposit', async () => {
          let badDeposit = validatorDepositInAVTDecimals.div(new BN(2));
          await avtTestHelper.addAVT(badDeposit, goodValidator);
          await registerValidatorFails(goodValidator, goodEvidenceURL, goodValidatorDescription,
              'Insufficient balance to cover deposits');
          await avtTestHelper.withdrawAVT(badDeposit, goodValidator);
        });
      });
    });
  });

  context('deregisterValidator()', async () => {
    async function deregisterValidatorSucceeds() {
      await validatorsManager.deregisterValidator(goodValidator);

      const logArgs = await testHelper.getLogArgs(validatorsManager, 'LogValidatorDeregistered');
      assert.equal(logArgs.validatorAddress, goodValidator);
    }

    async function deregisterValidatorFails(_validatorAddress, _expectedError) {
      await testHelper.expectRevert(() => validatorsManager.deregisterValidator(_validatorAddress), _expectedError);
    }

    beforeEach(async () => {
      await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
    });

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await deregisterValidatorSucceeds();
        await withdrawDepositForNewValidator(goodValidator);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        });

        it('validatorAddress', async () => {
          await deregisterValidatorFails(badValidatorAddress, 'Must be registered and not under challenge');
        });
      });

      context('bad state', async () => {
        it('validator has already been deregistered', async () => {
          await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
          await deregisterValidatorFails(goodValidator, 'Must be registered and not under challenge');
        });

        it('validator has interacted and tries to deregister before the end of the cooling off period', async () => {
          const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(goodValidator);
          await deregisterValidatorFails(goodValidator, 'Validator cannot be deregistered yet');

          await merkleRootsTestHelper.advanceTimeAndDeregisterMerkleRoot(root.rootHash);
          await deregisterValidatorFails(goodValidator, 'Validator cannot be deregistered yet');

          // Tear down
          await validatorsTestHelper.advanceToDeregistrationTime(goodValidator);
          await avtTestHelper.withdrawAVT(root.deposit, goodValidator);
          await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        });
      });
    });
  });

  context('getNewValidatorDeposit()', async () => {
    async function getNewValidatorDepositSucceeds(_expectedDeposit) {
      const newValidatorDeposit = await validatorsManager.getNewValidatorDeposit();
      testHelper.assertBNEquals(newValidatorDeposit, _expectedDeposit);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await getNewValidatorDepositSucceeds(validatorDepositInAVTDecimals);
      });
    });

    // getNewValidatorDeposit cannot fail
  });

  context('getExistingValidatorDeposit()', async () => {
    async function getExistingValidatorDepositSucceeds(_expectedDeposit) {
      const existingValidatorDeposit = await validatorsManager.getExistingValidatorDeposit(goodValidator);
      testHelper.assertBNEquals(existingValidatorDeposit, _expectedDeposit);
    }

    async function getExistingValidatorDepositFails(_validatorAddress, _expectedError) {
      await testHelper.expectRevert(() => validatorsManager.getExistingValidatorDeposit(_validatorAddress), _expectedError);
    }

    before(async () => {
      await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
    });

    after(async () => {
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
    });

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await getExistingValidatorDepositSucceeds(validatorDepositInAVTDecimals);
      });
    });

    context('fails with', async () => {
      context('bad state', async () => {
        it('validator is not registered', async () => {
          await getExistingValidatorDepositFails(accounts.otherValidator, 'Validator is not registered');
        });
      });
    });
  });

  // NOTE: See merkle tree testing for proper deregistration time tests.
  context('getDeregistrationTime() - branch coverage', async () => {
    it('succeeds with non-existent validator', async () => {
      const deregistrationTime = await validatorsManager.getDeregistrationTime(accounts.otherValidator);
      assert.equal(deregistrationTime, 0);
    });
  });

  context('extra tests for special cases', async () => {
    const treeDepth = 3;

    let validator, tree, rootExpiryTime, timeToRootExpiry, rootDeposit;
    let coolingOffNoPenalties, coolingOffOnePenalty;

    before(() => {
      validator = accounts.validator;
      timeToRootExpiry = timeTestHelper.oneWeek.mul(new testHelper.BN(100));
      coolingOffNoPenalties = timeTestHelper.oneWeek.mul(new testHelper.BN(3));
      coolingOffOnePenalty = timeTestHelper.oneWeek.mul(new testHelper.BN(15));
    });

    async function registerValidatorAndBadRoot() {
      await validatorsTestHelper.depositAndRegisterValidator(validator);
      const deregistrationTimeBefore = await validatorsTestHelper.getDeregistrationTime(validator, 'Validator');
      assert.equal(deregistrationTimeBefore, 0);

      tree = merkleTreeHelper.createRandomTree(treeDepth);
      rootExpiryTime = timeTestHelper.now().add(timeToRootExpiry);
      const retVal = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(validator, tree.rootHash,
          treeDepth - 1, rootExpiryTime);
      rootDeposit = retVal.deposit;
      const deregistrationTimeAfter = await validatorsTestHelper.getDeregistrationTime(validator, 'Validator');

      testHelper.assertBNEquals(deregistrationTimeAfter, rootExpiryTime.add(coolingOffNoPenalties));
    }

    it('Ensure that validator deregister after merkle leaf challenge clears expiry time and penalties', async () => {
      await registerValidatorAndBadRoot();

      await merkleRootsTestHelper.autoChallengeTreeDepth(tree.leafHash, tree.merklePath, validator);
      await avtTestHelper.withdrawAVT(rootDeposit, validator);
      const deregistrationTimeAfterChallenge = await validatorsTestHelper.getDeregistrationTime(validator, 'Validator');
      testHelper.assertBNEquals(deregistrationTimeAfterChallenge, rootExpiryTime.add(coolingOffOnePenalty));

      await validatorsTestHelper.advanceToDeregistrationTime(validator, 'Validator');
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(validator);

      await registerValidatorAndBadRoot();

      // TIDY UP
      await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(tree.rootHash, validator, rootDeposit);

      await validatorsTestHelper.advanceToDeregistrationTime(validator, 'Validator');
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(validator);
    });
  });
});