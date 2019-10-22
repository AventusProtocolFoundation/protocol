const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingHelper = require('../utils/signingHelper');
const proposalsTestHelper = require('./helpers/proposalsTestHelper');

// These tests are required to achieve 100% line and branch coverage and are based on CommunityProposalsVotingTests
// The setup for these tests does not fit with our standard test structure so they have been split out in a new file
contract('Community proposals voting - extra', async () => {
  let proposalsManager, accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await proposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('communityProposalOwner', 'goodVoterAddress');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('line coverage tests', async () => {
    let goodCommunityProposalId, communityProposalId2, communityProposalId3;
    let communityProposalDeposit;
    let goodCastVoteSecret, goodRevealVoteSignedMessage;

    const goodVoteOption = 2;

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodCommunityProposalId, goodCastVoteSecret, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCast');
      assert.equal(logArgs.proposalId.toNumber(), goodCommunityProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
    }

    async function castVoteFails(_communityProposalId, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_communityProposalId, goodCastVoteSecret,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    async function revealVoteSucceeds() {
      await proposalsManager.revealVote(goodRevealVoteSignedMessage, goodCommunityProposalId, goodVoteOption,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteRevealed');
      assert.equal(logArgs.proposalId.toNumber(), goodCommunityProposalId.toNumber());
      assert.equal(logArgs.optId, goodVoteOption);
    }

    before(async () => {
      // We need to setup 3 proposals:
      //  - 2 with the same time periods
      //  - 1 starting after the other 2
      goodCommunityProposalId =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);

      communityProposalId2 =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);

      await timeTestHelper.advanceByOneMinute();

      communityProposalId3 =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);

      goodCastVoteSecret = await signingHelper.getCastVoteSecret(accounts.goodVoterAddress, goodCommunityProposalId,
          goodVoteOption);

      goodRevealVoteSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodCommunityProposalId, goodVoteOption);

      await votingTestHelper.advanceTimeToVotingStart(communityProposalId3);
      await votingTestHelper.castVote(accounts.goodVoterAddress, communityProposalId2, goodVoteOption);

      communityProposalDeposit = await proposalsManager.getCommunityProposalDeposit();
    });

    after(async () => {
      await proposalsTestHelper.advanceTimeEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner,
          communityProposalId3);
      await endCommunityProposalAndWithdrawDeposit(goodCommunityProposalId);
      await endCommunityProposalAndWithdrawDeposit(communityProposalId2);
    });

    async function endCommunityProposalAndWithdrawDeposit(_communityProposalId) {
      await proposalsManager.endCommunityProposal(_communityProposalId);
      await avtTestHelper.withdrawAVT(communityProposalDeposit, accounts.communityProposalOwner);
    }

    it('cast vote succeeds when voting on more than 1 community proposal with the same end time', async () => {
      await castVoteSucceeds();
    });

    it('reveal vote succeeds when revealing vote after voting more than once', async () => {
      await votingTestHelper.advanceTimeToRevealingStart(communityProposalId3);
      await revealVoteSucceeds();
    });
  });

  context('branch coverage tests', async () => {
    let voter;
    const optionId = 2;

    before(async () => {
      voter = accounts.goodVoterAddress;
    });

    it('successfully revealing outside the revealing period', async () => {
      const communityProposalId =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);
      await votingTestHelper.advanceTimeAndCastVote(voter, communityProposalId, optionId);
      await votingTestHelper.advanceTimeToEndOfProposal(communityProposalId);
      await proposalsTestHelper.revealVoteEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner, voter,
          communityProposalId, optionId);
    });

    it('successfully voting in a different order to proposal creation', async () => {
      const communityProposalId_1 =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);
      await timeTestHelper.advanceByOneMinute();
      const communityProposalId_2 =
          await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);
      await votingTestHelper.advanceTimeToVotingStart(communityProposalId_2);
      await votingTestHelper.castVote(voter, communityProposalId_2, optionId);
      await votingTestHelper.castVote(voter, communityProposalId_1, optionId);
      await votingTestHelper.advanceTimeToRevealingStart(communityProposalId_2);
      await proposalsTestHelper.revealVoteEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner, voter,
          communityProposalId_1, optionId);
      await proposalsTestHelper.revealVoteEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner, voter,
          communityProposalId_2, optionId);
    });
  });
});