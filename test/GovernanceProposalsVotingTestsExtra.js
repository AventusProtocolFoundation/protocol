const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingHelper = require('../utils/signingHelper');
const proposalsTestHelper = require('./helpers/proposalsTestHelper');

const BN = testHelper.BN;

// These tests are required to achieve 100% line and branch coverage and are based on GovernanceProposalsVotingTests
// The setup for these tests does not fit with our standard test structure so they have been split out in a new file
contract('Governance proposals voting - extra', async () => {
  let proposalsManager, accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await proposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('governanceProposalOwner', 'goodVoterAddress');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('line coverage tests', async () => {
    let goodGovernanceProposalId, governanceProposalId2, governanceProposalId3;
    let governanceProposalDeposit;
    let goodCastVoteSecret, goodRevealVoteSignedMessage;

    const goodVoteOption = 2;

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodGovernanceProposalId, goodCastVoteSecret, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCast');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
    }

    async function castVoteFails(_governanceProposalId, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_governanceProposalId, goodCastVoteSecret,
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
      goodGovernanceProposalId =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);

      governanceProposalId2 =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);

      await timeTestHelper.advanceByOneMinute();

      governanceProposalId3 =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);

      goodCastVoteSecret = await signingHelper.getCastVoteSecret(accounts.goodVoterAddress, goodGovernanceProposalId,
          goodVoteOption);

      goodRevealVoteSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodGovernanceProposalId, goodVoteOption);

      await votingTestHelper.advanceTimeToVotingStart(governanceProposalId3);
      await votingTestHelper.castVote(accounts.goodVoterAddress, governanceProposalId2, goodVoteOption);

      governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
    });

    after(async () => {
      await proposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
          governanceProposalId3);
      await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
      await endGovernanceProposalAndWithdrawDeposit(governanceProposalId2);
    });

    async function endGovernanceProposalAndWithdrawDeposit(_governanceProposalId) {
      await proposalsManager.endGovernanceProposal(_governanceProposalId);
      await avtTestHelper.withdrawAVT(governanceProposalDeposit, accounts.governanceProposalOwner);
    }

    it('cast vote succeeds when voting on more than 1 governance proposal with the same end time', async () => {
      await castVoteSucceeds();
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
      const governanceProposalId =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
      await votingTestHelper.advanceTimeAndCastVote(voter, governanceProposalId, optionId);
      await votingTestHelper.advanceTimeToEndOfProposal(governanceProposalId);
      await proposalsTestHelper.revealVoteEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner, voter,
          governanceProposalId, optionId);
    });

    it('successfully voting in a different order to proposal creation', async () => {
      const governanceProposalId_1 =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
      await timeTestHelper.advanceByOneMinute();
      const governanceProposalId_2 =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
      await votingTestHelper.advanceTimeToVotingStart(governanceProposalId_2);
      await votingTestHelper.castVote(voter, governanceProposalId_2, optionId);
      await votingTestHelper.castVote(voter, governanceProposalId_1, optionId);
      await votingTestHelper.advanceTimeToRevealingStart(governanceProposalId_2);
      await proposalsTestHelper.revealVoteEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner, voter,
          governanceProposalId_1, optionId);
      await proposalsTestHelper.revealVoteEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner, voter,
          governanceProposalId_2, optionId);
    });
  });

  context('governance proposal bytecode', async () => {

    async function runProposal(_newGovernanceDeposit, _newCommunityDeposit, _badMiddle) {
      let bytecode = await proposalsTestHelper.generateBytecode(_newGovernanceDeposit,'GovernanceProposalFixedDeposit');

      if (_badMiddle) {
        bytecode = (_badMiddle === 1) ?
            testHelper.randomBytes32() : // to revert at decode stage
            testHelper.encodeParams(['address', 'bytes', 'bytes'], [testHelper.getAventusStorage().address,
                testHelper.randomBytes32(), bytecode]); // to revert at call stage
      }

      bytecode = await proposalsTestHelper.generateBytecode(_newCommunityDeposit, 'CommunityProposalFixedDeposit', bytecode);

      const governanceProposalId =
          await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner, bytecode);

      const stake = avtTestHelper.oneAVTInAttoAVTBN;
      await avtTestHelper.addAVT(stake, accounts.goodVoterAddress);
      await votingTestHelper.advanceTimeCastAndRevealVotes(governanceProposalId,
          [{voter: accounts.goodVoterAddress, option: 1}]); // vote in favour of the proposal
      await proposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
          governanceProposalId);
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalEnded');
      await avtTestHelper.withdrawAVT(stake, accounts.goodVoterAddress);
      return logArgs.implemented;
    }

    it('two storage value changes are implemented automatically after a successful vote', async () => {
      const startGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const startCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      const newGovernanceDeposit = startGovernanceDeposit.mul(new BN(2));
      const newCommunityDeposit = startCommunityDeposit.mul(new BN(3));

      const wasImplemented = await runProposal(newGovernanceDeposit, newCommunityDeposit);
      assert.equal(wasImplemented, true);

      const endGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const endCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      testHelper.assertBNEquals(newGovernanceDeposit, endGovernanceDeposit);
      testHelper.assertBNEquals(newCommunityDeposit, endCommunityDeposit);
    });

    it('three changes are attempted with the middle change being un-decodable causing none to be implemented', async () => {
      const startGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const startCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      const newGovernanceDeposit = startGovernanceDeposit.mul(new BN(2));
      const newCommunityDeposit = startCommunityDeposit.mul(new BN(3));

      const badMiddle = 1;
      const wasImplemented = await runProposal(newGovernanceDeposit, newCommunityDeposit, badMiddle);
      assert.equal(wasImplemented, false);

      const endGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const endCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      testHelper.assertBNEquals(startGovernanceDeposit, endGovernanceDeposit);
      testHelper.assertBNEquals(startCommunityDeposit, endCommunityDeposit);
    });

    it('three changes are attempted with the middle change being un-callable causing none to be implemented', async () => {
      const startGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const startCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      const newGovernanceDeposit = startGovernanceDeposit.mul(new BN(2));
      const newCommunityDeposit = startCommunityDeposit.mul(new BN(3));

      const badMiddle = 2;
      const wasImplemented = await runProposal(newGovernanceDeposit, newCommunityDeposit, badMiddle);
      assert.equal(wasImplemented, false);

      const endGovernanceDeposit = await proposalsManager.getGovernanceProposalDeposit();
      const endCommunityDeposit = await proposalsManager.getCommunityProposalDeposit();
      testHelper.assertBNEquals(startGovernanceDeposit, endGovernanceDeposit);
      testHelper.assertBNEquals(startCommunityDeposit, endCommunityDeposit);
    });
  });
});