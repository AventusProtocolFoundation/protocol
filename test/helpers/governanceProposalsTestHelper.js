const governanceProposalDescription = 'I think we should change something';

let testHelper, avtTestHelper, votingTestHelper;
let proposalsManager;
let accounts;
let governanceProposalDeposit = new web3.BigNumber(0);

async function init(_testHelper, _avtTestHelper, _votingTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  votingTestHelper = _votingTestHelper;
  proposalsManager = testHelper.getProposalsManager();
  accounts = testHelper.getAccounts('governanceProposalOwner');
  governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
}

async function depositAndCreateGovernanceProposal() {
  await avtTestHelper.addAVTToFund(governanceProposalDeposit, accounts.governanceProposalOwner, 'deposit');
  await proposalsManager.createGovernanceProposal(governanceProposalDescription, {from: accounts.governanceProposalOwner});
  const logArgs = await testHelper.getLogArgs(proposalsManager.LogGovernanceProposalCreated);
  return logArgs.proposalId;
}

async function advanceTimeEndGovernanceProposalAndWithdrawDeposit(_governanceProposalId) {
  await votingTestHelper.advanceTimeToEndOfProposal(_governanceProposalId);
  await proposalsManager.endGovernanceProposal(_governanceProposalId);
  await avtTestHelper.withdrawAVTFromFund(governanceProposalDeposit, accounts.governanceProposalOwner, 'deposit');
}

async function revealVoteEndProposalAndWithdrawDeposit(_votingAddress, _proposalId, _optionId) {
  await votingTestHelper.revealVote(_votingAddress, _proposalId, _optionId);
  await advanceTimeEndGovernanceProposalAndWithdrawDeposit(_proposalId);
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeEndGovernanceProposalAndWithdrawDeposit,
  depositAndCreateGovernanceProposal,
  init,
  revealVoteEndProposalAndWithdrawDeposit
};