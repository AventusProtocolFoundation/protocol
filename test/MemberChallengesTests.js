const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const challengesTestHelper = require('./helpers/challengesTestHelper');
const BN = testHelper.BN;

contract('Member challenges', async () => {

  let accounts;
  const goodType = membersTestHelper.memberTypes.validator;
  const badType = membersTestHelper.memberTypes.bad;
  const stake1 = avtTestHelper.oneAVTTo18SigFig;
  const stake2 = stake1.mul(new BN(2));

  let membersManager, proposalsManager;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await challengesTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    membersManager = testHelper.getMembersManager();
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('member', 'challenger', 'otherMember', 'voter1', 'voter2', 'claimant','challengeEnder');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function makeChallengeDeposit(_memberAddress, _memberType, _challenger) {
    let deposit = await membersTestHelper.getExistingMemberDeposit(_memberAddress, _memberType);
    await avtTestHelper.addAVT(deposit, _challenger);
  }

  context('challengeMember()', async () => {
    let goodMember, goodChallenger;

    async function challengeMemberSucceeds() {
      await membersManager.challengeMember(goodMember, goodType, {from: goodChallenger});
      const logArgs = await testHelper.getLogArgs(membersManager, 'LogMemberChallenged');

      assert.equal(logArgs.memberAddress, goodMember);
      assert.equal(logArgs.memberType, goodType);
      assert.notEqual(logArgs.proposalId.toNumber(), 0);
      return logArgs.proposalId.toNumber();
    }

    async function challengeMemberFails(_memberAddress, _memberType, _challenger, _expectedError) {
      await testHelper.expectRevert(() => membersManager.challengeMember(_memberAddress, _memberType, {from: _challenger}),
          _expectedError);
    }

    before(async () => {
      goodMember = accounts.member;
      goodChallenger = accounts.challenger;
    });

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
        // So, we just clear whatever AVT remains in the accounts
        await avtTestHelper.clearAVTAccount(goodMember);
        await avtTestHelper.clearAVTAccount(goodChallenger);
      });

      context('succeeds with', async () => {
        it('good parameters', async () => {
          let proposalId = await challengeMemberSucceeds();
          await challengesTestHelper.advanceTimeAndEndMemberChallenge(goodMember, goodType, proposalId, goodChallenger);
        });
      });

      context('fails with bad parameters', async () => {
        it('member address', async () => {
          await challengeMemberFails(accounts.otherMember, goodType, goodChallenger,
              'Must be valid and not under challenge');
        });

        it('member type', async () => {
          await challengeMemberFails(goodMember, badType, goodChallenger, 'Must be valid and not under challenge');
        });
      });
    });

    context('fails with bad state', async () => {

      before(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
      });

      after(async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        // Clear remaining AVT resulting from challenge winnings
        await avtTestHelper.clearAVTAccount(goodMember);
        await avtTestHelper.clearAVTAccount(goodChallenger);
      });

      it('member is under challenge', async () => {
        let challenge = await challengesTestHelper.challengeMember(goodMember, goodType, goodChallenger);
        await challengeMemberFails(goodMember, goodType, goodChallenger, 'Must be valid and not under challenge');
        await challengesTestHelper.advanceTimeAndEndMemberChallenge(goodMember, goodType, challenge.proposalId, goodChallenger);
      });
    });
  });

  context('endMemberChallenge()', async () => {
    let goodMember, challengeEnder, goodProposalId;

    async function endMemberChallengeSucceeds() {
      await membersManager.endMemberChallenge(goodMember, goodType, {from: challengeEnder});

      const logArgs = await testHelper.getLogArgs(membersManager, 'LogMemberChallengeEnded');
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

    before(async () => {
      goodMember = accounts.member;
      challengeEnder = accounts.challenger;
    });

    context('good state', async () => {
      before(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
      });

      after(async () => {
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        // After the challenge has ended, winnings distribution means that the AVT deposits of the accounts
        // may be different from their value after setup.
        // At this level, we don't need to exactly calculate this distribution, as they'll be tested in a dedicated context.
        // So, we just clear whatever AVT remains in the accounts
        await avtTestHelper.clearAVTAccount(goodMember);
      });

      beforeEach(async () => {
        const challenge = await challengesTestHelper.challengeMember(goodMember, goodType, challengeEnder);
        goodProposalId = challenge.proposalId;
        await votingTestHelper.advanceTimeToEndOfProposal(goodProposalId);
      });

      context('succeeds with', async () => {
        it('good parameters', async () => {
          await endMemberChallengeSucceeds();
          await avtTestHelper.clearAVTAccount(challengeEnder);
        });
      });

      context('fails with bad parameters', async () => {
        afterEach(async () => {
          await membersManager.endMemberChallenge(goodMember, goodType, {from: challengeEnder});
          await avtTestHelper.clearAVTAccount(challengeEnder);
        });

        it('member address', async () => {
          let badMemberAddress = testHelper.zeroAddress;
          await endMemberChallengeFails(badMemberAddress, goodType, 'Member is not registered');
        });

        it('member type', async () => {
          await endMemberChallengeFails(goodMember, badType, 'Member is not registered');
        });
      });
    });

    context('fails with bad state', async () => {
      it('member is fraudulent', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
        // The next action effectively deregisters goodMember, so no tearDown will be done for this test
        await challengesTestHelper.challengeMemberAndMarkAsFraudulent(goodMember, goodType, challengeEnder);
        await endMemberChallengeFails(goodMember, goodType, 'Member is not registered');
        await avtTestHelper.clearAVTAccount(challengeEnder);
        await avtTestHelper.clearAVTAccount(goodMember);
      });

      it('member has no active challenge', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodType);
        await endMemberChallengeFails(goodMember, goodType, 'Challenge does not exist');
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodType);
        await avtTestHelper.clearAVTAccount(goodMember);
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
      challengedAddress = accounts.otherMember;
      challenger = accounts.challenger;
      challengeEnder = accounts.challengeEnder;
      badClaimant = accounts.claimant;
      voter1 = accounts.voter1;
      voter2 = accounts.voter2;
      await membersTestHelper.depositAndRegisterMember(challengedAddress, goodType);

      await avtTestHelper.addAVT(stake1, voter1);
      await avtTestHelper.addAVT(stake2, voter2);
    });

    after(async () => {
      await membersTestHelper.deregisterMemberAndWithdrawDeposit(challengedAddress, goodType);

      await avtTestHelper.withdrawAVT(stake1, voter1);
      await avtTestHelper.withdrawAVT(stake2, voter2);
    });

    beforeEach(async () => {
      goodChallenge = await challengesTestHelper.challengeMember(challengedAddress, goodType, challenger);
      deposit = goodChallenge.deposit;
      winnerWinnings = depositAmountToWinner(deposit);
      enderWinnings = depositAmountToChallengeEnder(deposit);
      voter1Winnings = (deposit.sub(winnerWinnings).sub(enderWinnings)).div(new BN(3));
      voter2Winnings = voter1Winnings.mul(new BN(2));

      await votingTestHelper.advanceTimeCastAndRevealVotes(goodChallenge.proposalId,
          [{voter: voter1, option: 2}, {voter: voter2, option: 2}]);

      await challengesTestHelper.advanceTimeAndEndMemberChallenge(challengedAddress, goodType, goodChallenge.proposalId,
          challengeEnder);
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