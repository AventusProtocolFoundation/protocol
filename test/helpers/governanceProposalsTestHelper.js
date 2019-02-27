const governanceProposalDescription = 'I think we should change something';

let testHelper, avtTestHelper, votingTestHelper;
let proposalsManager;
let accounts;
let governanceProposalDeposit = new web3.utils.BN(0);

async function init(_testHelper, _avtTestHelper, _votingTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  votingTestHelper = _votingTestHelper;
  proposalsManager = testHelper.getProposalsManager();
  governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
}

async function depositAndCreateGovernanceProposal(_governanceProposalOwner) {
  await avtTestHelper.addAVT(governanceProposalDeposit, _governanceProposalOwner);
  await proposalsManager.createGovernanceProposal(governanceProposalDescription, {from: _governanceProposalOwner});
  const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalCreated');
  return logArgs.proposalId;
}

async function advanceTimeEndGovernanceProposalAndWithdrawDeposit(_governanceProposalOwner, _governanceProposalId) {
  await votingTestHelper.advanceTimeToEndOfProposal(_governanceProposalId);
  await proposalsManager.endGovernanceProposal(_governanceProposalId);
  await avtTestHelper.withdrawAVT(governanceProposalDeposit, _governanceProposalOwner);
}

async function revealVoteEndProposalAndWithdrawDeposit(_governanceProposalOwner, _votingAddress, _proposalId, _optionId) {
  await votingTestHelper.revealVote(_votingAddress, _proposalId, _optionId);
  await advanceTimeEndGovernanceProposalAndWithdrawDeposit(_governanceProposalOwner, _proposalId);
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeEndGovernanceProposalAndWithdrawDeposit,
  depositAndCreateGovernanceProposal,
  init,
  revealVoteEndProposalAndWithdrawDeposit
};