const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const challengesTestHelper = require('./helpers/challengesTestHelper');
const BN = testHelper.BN;

contract('Validator challenges', async () => {

  let accounts;
  const stake1 = avtTestHelper.oneAVTInAttoAVTBN;
  const stake2 = stake1.mul(new BN(2));

  let validatorsManager, proposalsManager;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await challengesTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    validatorsManager = testHelper.getValidatorsManager();
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('validator', 'challenger', 'otherValidator', 'voter1', 'voter2', 'claimant','challengeEnder');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function makeChallengeDeposit(_validatorAddress, _challenger) {
    let deposit = await validatorsTestHelper.getExistingValidatorDeposit(_validatorAddress);
    await avtTestHelper.addAVT(deposit, _challenger);
  }

  context('challengeValidator()', async () => {
    let goodValidator, goodChallenger;

    async function challengeValidatorSucceeds() {
      await validatorsManager.challengeValidator(goodValidator, {from: goodChallenger});
      const logArgs = await testHelper.getLogArgs(validatorsManager, 'LogValidatorChallenged');

      assert.equal(logArgs.validatorAddress, goodValidator);
      assert.notEqual(logArgs.proposalId.toNumber(), 0);
      return logArgs.proposalId.toNumber();
    }

    async function challengeValidatorFails(_validatorAddress, _challenger, _expectedError) {
      await testHelper.expectRevert(() => validatorsManager.challengeValidator(_validatorAddress, {from: _challenger}),
          _expectedError);
    }

    before(async () => {
      goodValidator = accounts.validator;
      goodChallenger = accounts.challenger;
    });

    context('good state', async () => {

      before(async () => {
        await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
        await makeChallengeDeposit(goodValidator, goodChallenger);
      });

      after(async () => {
        await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        // After the challenge has ended, winnings distribution means that the AVT deposits of the accounts
        // may be different from their value after setup.
        // At this level, we don't need to exactly calculate this distribution, as they'll be tested in a dedicated context.
        // So, we just clear whatever AVT remains in the accounts
        await avtTestHelper.clearAVTAccount(goodValidator);
        await avtTestHelper.clearAVTAccount(goodChallenger);
      });

      context('succeeds with', async () => {
        it('good parameters', async () => {
          let proposalId = await challengeValidatorSucceeds();
          await challengesTestHelper.advanceTimeAndEndValidatorChallenge(goodValidator, proposalId, goodChallenger);
        });
      });

      context('fails with bad parameters', async () => {
        it('validator address', async () => {
          await challengeValidatorFails(accounts.otherValidator, goodChallenger, 'Must be registered and not under challenge');
        });
      });
    });

    context('fails with bad state', async () => {

      before(async () => {
        await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
      });

      after(async () => {
        await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        // Clear remaining AVT resulting from challenge winnings
        await avtTestHelper.clearAVTAccount(goodValidator);
        await avtTestHelper.clearAVTAccount(goodChallenger);
      });

      it('validator is under challenge', async () => {
        let challenge = await challengesTestHelper.challengeValidator(goodValidator, goodChallenger);
        await challengeValidatorFails(goodValidator, goodChallenger, 'Must be registered and not under challenge');
        await challengesTestHelper.advanceTimeAndEndValidatorChallenge(goodValidator, challenge.proposalId, goodChallenger);
      });
    });
  });

  context('endValidatorChallenge()', async () => {
    let goodValidator, challengeEnder, goodProposalId;

    async function endValidatorChallengeSucceeds() {
      await validatorsManager.endValidatorChallenge(goodValidator, {from: challengeEnder});

      const logArgs = await testHelper.getLogArgs(validatorsManager, 'LogValidatorChallengeEnded');
      assert.equal(logArgs.validatorAddress, goodValidator);
      assert.equal(logArgs.proposalId.toNumber(), goodProposalId);
      assert.equal(logArgs.votesFor.toNumber(), 0);
      assert.equal(logArgs.votesAgainst.toNumber(), 0);
    }

    // Anyone can end a challenge, without needing a deposit or any specific setup.
    // Therefore, we don't test for a bad challenge ender
    async function endValidatorChallengeFails(_validatorAddress, _expectedError) {
      await testHelper.expectRevert(() => validatorsManager.endValidatorChallenge(_validatorAddress, {from: challengeEnder}),
          _expectedError);
    }

    before(async () => {
      goodValidator = accounts.validator;
      challengeEnder = accounts.challenger;
    });

    context('good state', async () => {
      before(async () => {
        await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
      });

      after(async () => {
        await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        // After the challenge has ended, winnings distribution means that the AVT deposits of the accounts
        // may be different from their value after setup.
        // At this level, we don't need to exactly calculate this distribution, as they'll be tested in a dedicated context.
        // So, we just clear whatever AVT remains in the accounts
        await avtTestHelper.clearAVTAccount(goodValidator);
      });

      beforeEach(async () => {
        const challenge = await challengesTestHelper.challengeValidator(goodValidator, challengeEnder);
        goodProposalId = challenge.proposalId;
        await votingTestHelper.advanceTimeToEndOfProposal(goodProposalId);
      });

      context('succeeds with', async () => {
        it('good parameters', async () => {
          await endValidatorChallengeSucceeds();
          await avtTestHelper.clearAVTAccount(challengeEnder);
        });
      });

      context('fails with bad parameters', async () => {
        afterEach(async () => {
          await validatorsManager.endValidatorChallenge(goodValidator, {from: challengeEnder});
          await avtTestHelper.clearAVTAccount(challengeEnder);
        });

        it('validator address', async () => {
          let badValidatorAddress = testHelper.zeroAddress;
          await endValidatorChallengeFails(badValidatorAddress, 'Challenge does not exist');
        });
      });
    });

    context('fails with bad state', async () => {
      it('validator is fraudulent', async () => {
        await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
        // The next action effectively deregisters goodValidator, so no tearDown will be done for this test
        await challengesTestHelper.challengeValidatorAndMarkAsFraudulent(goodValidator, challengeEnder);
        await endValidatorChallengeFails(goodValidator, 'Challenge does not exist');
        await avtTestHelper.clearAVTAccount(challengeEnder);
        await avtTestHelper.clearAVTAccount(goodValidator);
      });

      it('validator has no active challenge', async () => {
        await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
        await endValidatorChallengeFails(goodValidator, 'Challenge does not exist');
        await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
        await avtTestHelper.clearAVTAccount(goodValidator);
      });
    });
  });

  context('claimVoterWinnings()', async () => {
    let goodChallenge, challengedAddress, challenger, challengeEnder, badClaimant, voter1, voter2;
    let deposit, winnerWinnings, enderWinnings, voter1Winnings, voter2Winnings;

    async function claimWinningsForAllVoters() {
      await proposalsManager.claimVoterWinnings(goodChallenge.proposalId, {from: voter1});
      await proposalsManager.claimVoterWinnings(goodChallenge.proposalId, {from: voter2});
    }

    async function withdrawDepositsAfterWinningsDistribution() {
      await avtTestHelper.withdrawAVT(winnerWinnings, challengedAddress);
      await avtTestHelper.withdrawAVT(enderWinnings, challengeEnder);
      await avtTestHelper.withdrawAVT(voter1Winnings, voter1);
      await avtTestHelper.withdrawAVT(voter2Winnings, voter2);
    }

    async function claimVoterWinningsSucceeds(_voter) {
      await proposalsManager.claimVoterWinnings(goodChallenge.proposalId, {from: _voter});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoterWinningsClaimed');

      assert.equal(logArgs.proposalId, goodChallenge.proposalId);
    }

    async function claimVoterWinningsFails(_proposalId, _voter, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.claimVoterWinnings(_proposalId, {from: _voter}), _expectedError);
    }

    function depositAmountToWinner(_deposit) {
      // Winner currently gets 10%.
      return _deposit.div(new BN(10));
    }

    function depositAmountToChallengeEnder(_deposit) {
      // Challenge ender currently gets 10%
      return _deposit.div(new BN(10));
    }

    before(async () => {
      challengedAddress = accounts.otherValidator;
      challenger = accounts.challenger;
      challengeEnder = accounts.challengeEnder;
      badClaimant = accounts.claimant;
      voter1 = accounts.voter1;
      voter2 = accounts.voter2;
      await validatorsTestHelper.depositAndRegisterValidator(challengedAddress);

      await avtTestHelper.addAVT(stake1, voter1);
      await avtTestHelper.addAVT(stake2, voter2);
    });

    after(async () => {
      await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(challengedAddress);

      await avtTestHelper.withdrawAVT(stake1, voter1);
      await avtTestHelper.withdrawAVT(stake2, voter2);
    });

    beforeEach(async () => {
      goodChallenge = await challengesTestHelper.challengeValidator(challengedAddress, challenger);
      deposit = goodChallenge.deposit;
      winnerWinnings = depositAmountToWinner(deposit);
      enderWinnings = depositAmountToChallengeEnder(deposit);
      voter1Winnings = (deposit.sub(winnerWinnings).sub(enderWinnings)).div(new BN(3));
      voter2Winnings = voter1Winnings.mul(new BN(2));

      await votingTestHelper.advanceTimeCastAndRevealVotes(goodChallenge.proposalId,
          [{voter: voter1, option: 2}, {voter: voter2, option: 2}]);

      await challengesTestHelper.advanceTimeAndEndValidatorChallenge(challengedAddress, goodChallenge.proposalId, challengeEnder);
    });

    afterEach(async() => {
      // Voter2 has been given the remainder; clear it out.
      await avtTestHelper.withdrawAVT(1, voter2);
    });

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await claimVoterWinningsSucceeds(voter1);
        await claimVoterWinningsSucceeds(voter2);

        await withdrawDepositsAfterWinningsDistribution();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await claimWinningsForAllVoters();
          await withdrawDepositsAfterWinningsDistribution();
        });

        it('proposalId', async () => {
          let badProposalId = 9999;

          await claimVoterWinningsFails(badProposalId, voter1, 'Voter has no winnings for this proposal');
          await claimVoterWinningsFails(badProposalId, voter2, 'Voter has no winnings for this proposal');
        });

        it('claimant', async () => {
          await claimVoterWinningsFails(goodChallenge.proposalId, badClaimant, 'Voter has no winnings for this proposal');
        });
      });

      context('bad state', async () => {
        // Must be beforeEach, and not before, because this depends on a beforeEach of an outer context
        beforeEach(async () => {
          await claimWinningsForAllVoters();
        });

        afterEach(async () => {
          await withdrawDepositsAfterWinningsDistribution();
        });

        it('claimant has already claimed winnings', async () => {
          await claimVoterWinningsFails(goodChallenge.proposalId, voter1, 'Voter has no winnings for this proposal');
          await claimVoterWinningsFails(goodChallenge.proposalId, voter2, 'Voter has no winnings for this proposal');
        });
      });
    });
  });
});