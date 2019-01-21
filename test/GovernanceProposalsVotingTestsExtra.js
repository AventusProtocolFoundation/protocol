const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');

// These tests are required to achieve 100% line and branch coverage and are based on GovernanceProposalsVotingTests
// The setup for these tests does not fit with our standard test structure so they have been split out in a new file
contract('Governance proposals voting - extra', async () => {
  let proposalsManager, accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('goodVoterAddress');
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  context('line coverage tests', async () => {
    let goodGovernanceProposalId, governanceProposalId2, governanceProposalId3;
    let governanceProposalDeposit;
    let goodPrevTime, goodCastVoteSecret, goodRevealVoteSignedMessage;

    const goodVoteOption = 2;

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodGovernanceProposalId, goodCastVoteSecret, goodPrevTime,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCast');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
      assert.equal(logArgs.prevTime.toNumber(), goodPrevTime.toNumber());
    }

    async function castVoteFails(_governanceProposalId, _prevTime, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_governanceProposalId, goodCastVoteSecret, _prevTime,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    async function revealVoteSucceeds() {
      await proposalsManager.revealVote(goodRevealVoteSignedMessage, goodGovernanceProposalId, goodVoteOption,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteRevealed');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.optId, goodVoteOption);
    }

    before(async () => {
      // We need to setup 3 proposals:
      //  - 2 with the same time periods
      //  - 1 starting after the other 2
      goodGovernanceProposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
      governanceProposalId2 = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
      await timeTestHelper.advanceToTime(timeTestHelper.now().add(timeTestHelper.oneDay));
      governanceProposalId3 = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();

      goodPrevTime = await proposalsManager.getPrevTimeParamForCastVote(goodGovernanceProposalId,
          {from: accounts.goodVoterAddress});
      goodCastVoteSecret = await signingTestHelper.getCastVoteSecret(accounts.goodVoterAddress, goodGovernanceProposalId, 
          goodVoteOption);
      goodRevealVoteSignedMessage = await signingTestHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodGovernanceProposalId, goodVoteOption);

      await votingTestHelper.advanceTimeToVotingStart(governanceProposalId3);
      await votingTestHelper.castVote(accounts.goodVoterAddress, governanceProposalId2, goodVoteOption);

      governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
    });

    after(async () => {
      await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(governanceProposalId3);
      await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
      await endGovernanceProposalAndWithdrawDeposit(governanceProposalId2);
    });

    async function endGovernanceProposalAndWithdrawDeposit(_governanceProposalId) {
      await proposalsManager.endGovernanceProposal(_governanceProposalId);
      await avtTestHelper.withdrawAVTFromFund(governanceProposalDeposit, accounts.goodVoterAddress, 'deposit');
    }

    it('cast vote succeeds when voting on more than 1 governance proposal', async () => {
      await castVoteSucceeds();
    });

    it('cast vote fails with bad parameter PrevTime (using PrevTime of a different proposal user voted on)', async () => {
      // badPrevTime must be a valid prevTime parameter of a previous vote on a proposal that started before the current one
      const badPrevTime = await proposalsManager.getPrevTimeParamForCastVote(governanceProposalId2);
      await castVoteFails(governanceProposalId3, badPrevTime, 'Invalid next time');
    });

    it('reveal vote succeeds when revealing vote after voting more than once', async () => {
      await votingTestHelper.advanceTimeToRevealingStart(governanceProposalId3);
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
      const governanceProposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
      await votingTestHelper.advanceTimeAndCastVote(voter, governanceProposalId, optionId);
      await votingTestHelper.advanceTimeToEndOfProposal(governanceProposalId);
      await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(voter, governanceProposalId, optionId);
    });

    it('successfully voting in a different order to proposal creation', async () => {
      const governanceProposalId_1 = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
      await timeTestHelper.advanceToTime(timeTestHelper.now().add(timeTestHelper.oneDay));
      const governanceProposalId_2 = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
      await votingTestHelper.advanceTimeToVotingStart(governanceProposalId_2);
      await votingTestHelper.castVote(voter, governanceProposalId_2, optionId);
      await votingTestHelper.castVote(voter, governanceProposalId_1, optionId);
      await votingTestHelper.advanceTimeToRevealingStart(governanceProposalId_2);
      await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(voter, governanceProposalId_1, optionId);
      await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(voter, governanceProposalId_2, optionId);
    });
  });
});