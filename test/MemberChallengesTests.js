const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const challengesTestHelper = require('./helpers/challengesTestHelper');

contract('Member challenges', async () => {

  const accounts = testHelper.getAccounts('member', 'challenger', 'otherMember',
      'voter', 'claimant', 'challengeEnder');
  const goodType = membersTestHelper.memberTypes.primary;
  const badType = membersTestHelper.memberTypes.bad;
  const stake = avtTestHelper.oneAVTTo18SigFig;
  const checkStakes = true;

  let membersManager, proposalsManager;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await challengesTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    membersManager = testHelper.getMembersManager();
    proposalsManager = testHelper.getProposalsManager();
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts, checkStakes);
  });

  async function makeChallengeDeposit(_memberAddress, _memberType, _challenger) {
    let deposit = await membersTestHelper.getExistingMemberDeposit(_memberAddress, _memberType);
    await avtTestHelper.addAVTToFund(deposit, _challenger, 'deposit');
  }

  context('challengeMember()', async () => {

    const goodMember = accounts.member;
    const goodChallenger = accounts.challenger;

    async function challengeMemberSucceeds() {
      await membersManager.challengeMember(goodMember, goodType, {from: goodChallenger});
      const logArgs = await testHelper.getLogArgs(membersManager.LogMemberChallenged);

      assert.equal(logArgs.memberAddress, goodMember);
      assert.equal(logArgs.memberType, goodType);
      assert.notEqual(logArgs.proposalId.toNumber(), 0);
      return logArgs.proposalId.toNumber();
    }
    async function challengeMemberFails(_memberAddress, _memberType, _challenger, _expectedError) {
      await testHelper.expectRevert(() => membersManager.challengeMember(_memberAddress, _memberType, {from: _challenger}),
          _expectedError);
    }

    context('good state', async () => {

      before(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
        await makeChallengeDeposit(goodMember, goodType, goodChallenger);
      });

      after(async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        // After the challenge has ended, winnings distribution means that the AVT deposits of the accounts
        // may be different from their value after setup.
        // At this level, we don't need to exactly calculate this distribution, as they'll be tested in a dedicated context.
        // So, we just clear whatever AVT remains in the accounts funds
        await avtTestHelper.clearAVTFund(goodMember, 'deposit');
        await avtTestHelper.clearAVTFund(goodChallenger, 'deposit');
      });

      it('good parameters', async () => {
        let proposalId = await challengeMemberSucceeds();
        await challengesTestHelper.advanceTimeAndEndMemberChallenge(goodMember, goodType, proposalId, goodChallenger);
      });

      context('with bad parameters', async () => {
        it('member does not exist', async () => {
          await challengeMemberFails(accounts.otherMember, goodType, goodChallenger,
              'Aventity must be valid and not under challenge');
        });

        it('member type is invalid', async () => {
          await challengeMemberFails(goodMember, badType, goodChallenger, 'Member type is not valid');
        });
      });
    });

    context('bad state', async () => {

      before(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
      });

      after(async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        // Clear remaining AVT resulting from challenge winnings
        await avtTestHelper.clearAVTFund(goodMember, 'deposit');
        await avtTestHelper.clearAVTFund(goodChallenger, 'deposit');
      });

      it('member is being challenged', async () => {
        let challenge = await challengesTestHelper.challengeMember(goodMember, goodType, goodChallenger);
        await challengeMemberFails(goodMember, goodType, goodChallenger, 'Aventity must be valid and not under challenge');
        await challengesTestHelper.advanceTimeAndEndMemberChallenge(goodMember, goodType, challenge.proposalId, goodChallenger);
      });
    });
  });

  context('endMemberChallenge()', async () => {
    const goodMember = accounts.member;
    const challengeEnder = accounts.challenger;
    let goodProposalId;

    async function endMemberChallengeSucceeds() {
      await membersManager.endMemberChallenge(goodMember, goodType, {from: challengeEnder});

      const logArgs = await testHelper.getLogArgs(membersManager.LogMemberChallengeEnded);
      assert.equal(logArgs.memberAddress, goodMember);
      assert.equal(logArgs.memberType, goodType);
      assert.equal(logArgs.proposalId.toNumber(), goodProposalId);
      assert.equal(logArgs.votesFor.toNumber(), 0);
      assert.equal(logArgs.votesAgainst.toNumber(), 0);
    }

    // Anyone can end a challenge, without needing a deposit or any specific setup.
    // Therefore, we don't test for a bad challenge ender
    async function endMemberChallengeFails(_memberAddress, _memberType, _expectedError) {
      await testHelper.expectRevert(() => membersManager.endMemberChallenge(_memberAddress, _memberType,
          {from: challengeEnder}), _expectedError);
    }

    context('good state: proposal is ready to be ended', async () => {
      before(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
      });

      after(async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        // After the challenge has ended, winnings distribution means that the AVT deposits of the accounts
        // may be different from their value after setup.
        // At this level, we don't need to exactly calculate this distribution, as they'll be tested in a dedicated context.
        // So, we just clear whatever AVT remains in the accounts funds
        await avtTestHelper.clearAVTFund(goodMember, 'deposit');
      });

      beforeEach(async () => {
        const challenge = await challengesTestHelper.challengeMember(goodMember, goodType, challengeEnder);
        goodProposalId = challenge.proposalId;
        await votingTestHelper.advanceTimeToEndOfProposal(goodProposalId);
      });

      it('succeeds with good state and good parameters', async () => {
        await endMemberChallengeSucceeds();
        await avtTestHelper.clearAVTFund(challengeEnder, 'deposit');
      });

      context('fails with bad parameters', async () => {
        afterEach(async () => {
          await membersManager.endMemberChallenge(goodMember, goodType, {from: challengeEnder});
          await avtTestHelper.clearAVTFund(challengeEnder, 'deposit');
        });

        it('member does not exist', async () => {
          let badMemberAddress = 0;
          await endMemberChallengeFails(badMemberAddress, goodType, 'Member is not registered');
        });

        it('member type is invalid', async () => {
          await endMemberChallengeFails(goodMember, badType, 'Member type is not valid');
        });
      });
    });

    context('fails if bad state', async () => {
      it('member is fraudulent', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
        // The next action effectively deregisters goodMember, so no tearDown will be done for this test
        await challengesTestHelper.challengeMemberAndMarkAsFraudulent(goodMember, goodType, challengeEnder);
        await endMemberChallengeFails(goodMember, goodType, 'Member is not registered');
        await avtTestHelper.clearAVTFund(challengeEnder, 'deposit');
        await avtTestHelper.clearAVTFund(goodMember, 'deposit');
      });

      it('member has no active challenge', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
        await endMemberChallengeFails(goodMember, goodType, 'Challenge does not exist');
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        await avtTestHelper.clearAVTFund(goodMember, 'deposit');
      });
    });
  });

  context('claimVoterWinnings', async () => {
    let goodChallenge;
    const challengedAddress = accounts.otherMember;
    const challenger = accounts.challenger;
    const challengeEnder = accounts.challengeEnder;
    const badClaimant = accounts.claimant;
    const voter = accounts.voter;

    let deposit, winnerWinnings, enderWinnings, voterWinnings;

    async function claimWinningsForAllVoters() {
      await proposalsManager.claimVoterWinnings(goodChallenge.proposalId, {from: voter});
    }

    async function withdrawDepositsAfterWinningsDistribution() {
      await avtTestHelper.withdrawAVTFromFund(winnerWinnings, challengedAddress, 'deposit');
      await avtTestHelper.withdrawAVTFromFund(enderWinnings, challengeEnder, 'deposit');
      await avtTestHelper.withdrawAVTFromFund(voterWinnings, voter, 'deposit');
    }

    async function claimVoterWinningsSucceeds(_voter) {
      await proposalsManager.claimVoterWinnings(goodChallenge.proposalId, {from: _voter});
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogVoterWinningsClaimed);

      assert.equal(logArgs.proposalId, goodChallenge.proposalId);
    }

    async function claimVoterWinningsFails(_proposalId, _voter, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.claimVoterWinnings(_proposalId, {from: _voter}), _expectedError);
    }

    function depositAmountToWinner(_deposit) {
      // Winner currently gets 10%.
      return _deposit.dividedToIntegerBy(10);
    }

    function depositAmountToChallengeEnder(_deposit) {
      // Challenge ender currently gets 10%
      return _deposit.dividedToIntegerBy(10);
    }

    before(async () => {
      await membersTestHelper.depositAndRegisterMember(challengedAddress, goodType);

      await avtTestHelper.addAVTToFund(stake, voter, 'stake');
    });

    after(async () => {
      await membersTestHelper.deregisterMemberAndWithdrawDeposit(challengedAddress, goodType);

      await avtTestHelper.withdrawAVTFromFund(stake, voter, 'stake');
    });

    beforeEach(async () => {
      goodChallenge = await challengesTestHelper.challengeMember(challengedAddress, goodType, challenger);

      // TODO: Test this in the overnight tests instead. Here, just test we can clear up the AVT funds correctly
      deposit = goodChallenge.deposit;
      winnerWinnings = depositAmountToWinner(deposit);
      enderWinnings = depositAmountToChallengeEnder(deposit);
      voterWinnings = deposit.minus(winnerWinnings).minus(enderWinnings);

      await votingTestHelper.advanceTimeCastAndRevealVotes(goodChallenge.proposalId,
          [{voter: voter, option: 2}]);

      await challengesTestHelper.advanceTimeAndEndMemberChallenge(challengedAddress, goodType, goodChallenge.proposalId,
          challengeEnder);
    });

    it('winnings are correctly distributed for different voter, challenger and challengee', async () => {
      await claimVoterWinningsSucceeds(voter);

      await withdrawDepositsAfterWinningsDistribution();
    });

    context('fails', async () => {

      afterEach(async () => {
        await claimWinningsForAllVoters();

        await withdrawDepositsAfterWinningsDistribution();
      });

      it('bad parameter proposalId', async () => {
        let badProposalId = 9999;

        await claimVoterWinningsFails(badProposalId, voter, 'Voter has no winnings for this proposal');
      });

      it('bad parameter: claimant has not voted for this proposal', async () => {
        await claimVoterWinningsFails(goodChallenge.proposalId, badClaimant, 'Voter has no winnings for this proposal');
      });

    });

    context('if bad state', async () => {

      // Must be beforeEach, and not before, because this depends on a beforeEach of an outer context
      beforeEach(async () => {
        await claimWinningsForAllVoters();
      });

      afterEach(async () => {
        await withdrawDepositsAfterWinningsDistribution();
      });

      it('voter claims twice', async () => {
        await claimVoterWinningsFails(goodChallenge.proposalId, voter, 'Voter has no winnings for this proposal');
      });

    });
  });
});