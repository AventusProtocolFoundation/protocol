const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const BN = testHelper.BN;

contract('ValidatorsManager', async () => {
  let validatorsManager, merkleLeafChallenges, accounts, goodValidator, coolingOffPeriods;

  const goodEvidenceURL = testHelper.validEvidenceURL;
  const goodValidatorDescription = 'Some validator to be registered';
  const badValidatorAddress = testHelper.zeroAddress;
  const validatorDepositInAVTDecimals = avtTestHelper.toAttoAVT(new BN(5000)); // From ParameterRegistry

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    validatorsManager = testHelper.getValidatorsManager();
    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    accounts = testHelper.getAccounts('validator', 'otherValidator', 'challenger');
    goodValidator = accounts.validator;

    // Mirrors values in parameter registry
    coolingOffPeriods = [
     timeTestHelper.oneDay.mul(new testHelper.BN(2)),
     timeTestHelper.oneWeek.mul(new testHelper.BN(15)),
     timeTestHelper.oneWeek.mul(new testHelper.BN(41)),
     timeTestHelper.oneWeek.mul(new testHelper.BN(80))
    ];
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

          await merkleRootsTestHelper.advanceTimeAndUnlockMerkleRootDeposit(root.rootHash);
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

// TODO: Refactor these tests - bad mix of globals and locals and repeated code
  context('validator deregistration special cases', async () => {
    let tree, encodedLeaf, rootRegistrationTime, rootDeposit;
    let coolingOffNoPenalties, coolingOffOnePenalty;

    before(() => {
      coolingOffNoPenalties = coolingOffPeriods[0];
      coolingOffOnePenalty = coolingOffPeriods[1];
    });

    async function registerValidatorAndBadRoot() {
      await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
      const deregistrationTimeBefore = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');
      assert.equal(deregistrationTimeBefore, 0);

      const leaf = merkleTreeHelper.getBaseLeaf(0);
      encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
      const leaves = [encodedLeaf, testHelper.randomBytes32()];
      tree = await merkleRootsTestHelper.createAndRegisterMerkleTree(leaves, goodValidator);
      rootRegistrationTime = timeTestHelper.now();
      rootDeposit = tree.deposit;
      const deregistrationTimeAfter = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');

      testHelper.assertBNEquals(deregistrationTimeAfter, rootRegistrationTime.add(coolingOffNoPenalties));
    }

    it('deregistration time and penalties are cleared', async () => {
      await registerValidatorAndBadRoot();

      await merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, tree.merklePath, {from: accounts.challenger});
      await avtTestHelper.withdrawAVT(rootDeposit, accounts.challenger);
      const deregistrationTimeAfterChallenge = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');
      testHelper.assertBNEquals(deregistrationTimeAfterChallenge, rootRegistrationTime.add(coolingOffOnePenalty));
      await validatorsTestHelper.advanceToDeregistrationTime(goodValidator, 'Validator');
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
      await registerValidatorAndBadRoot();

      // TIDY UP
      await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(tree.rootHash, goodValidator, rootDeposit);
      await validatorsTestHelper.advanceToDeregistrationTime(goodValidator, 'Validator');
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
    });

    it('safely challenge the same leaf more than once', async () => {
      await registerValidatorAndBadRoot();

      // Challenge leaf once
      await merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, tree.merklePath, {from: accounts.challenger});
      let logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
      assert.equal(logArgs.leafHash, tree.leafHash);
      const challengerBalanceFirstChallenge = await avtTestHelper.balanceOf(accounts.challenger);
      const deregistrationTimeFirstChallenge = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');

      // And again - nothing should change
      await merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, tree.merklePath, {from: accounts.challenger});
      logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
      assert.equal(logArgs.leafHash, tree.leafHash);
      const challengerBalanceSecondChallenge = await avtTestHelper.balanceOf(accounts.challenger);
      testHelper.assertBNEquals(challengerBalanceFirstChallenge, challengerBalanceSecondChallenge);
      const deregistrationTimeSecondChallenge = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');
      testHelper.assertBNEquals(deregistrationTimeFirstChallenge, deregistrationTimeSecondChallenge);

      // TIDY UP
      await avtTestHelper.withdrawAVT(rootDeposit, accounts.challenger);
      await validatorsTestHelper.advanceToDeregistrationTime(goodValidator, 'Validator');
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
    });

    async function registerRootAndRunSuccessfulChallenge(expectNoPenaltyIncrease){
      const deregistrationTimeBefore = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');

      const leaf = merkleTreeHelper.getBaseLeaf(0);
      const encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
      const leaves = [encodedLeaf, testHelper.randomBytes32()];
      const merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(leaves, goodValidator);
      await merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, merkleTree.merklePath, {from: accounts.challenger});
      await avtTestHelper.withdrawAVT(merkleTree.deposit, accounts.challenger);
      const deregistrationTimeAfter = await validatorsTestHelper.getDeregistrationTime(goodValidator, 'Validator');

      if (expectNoPenaltyIncrease) {
        testHelper.assertBNEquals(deregistrationTimeAfter, deregistrationTimeBefore);
      } else {
        testHelper.assertBNNotEquals(deregistrationTimeAfter, deregistrationTimeBefore);
      }
    }

    it('time penalties after multiple challenges are correct', async () => {
      await validatorsTestHelper.depositAndRegisterValidator(goodValidator);

      // Up to the number of cooling off period penalties, check that the cooling off period is further penalised every time a
      // root is challenged.
      for (let i = 1; i < coolingOffPeriods.length; i++) {
        await registerRootAndRunSuccessfulChallenge(false);
      }

      // Check that subsequent challenges do not change the cooling off penalty.
      await registerRootAndRunSuccessfulChallenge(true);
      await registerRootAndRunSuccessfulChallenge(true);
      await registerRootAndRunSuccessfulChallenge(true);

      await validatorsTestHelper.advanceToDeregistrationTime(goodValidator);
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
    });
  });
});