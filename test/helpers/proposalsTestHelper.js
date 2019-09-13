const communityProposalDescription = 'I think we should do something';
const governanceProposalDescription = 'I think we should change something';
const EMPTY_BYTES = '0x';

let testHelper, avtTestHelper, votingTestHelper;
let proposalsManager;
let accounts;
let communityProposalDeposit = new web3.utils.BN(0);
let governanceProposalDeposit = new web3.utils.BN(0);

async function init(_testHelper, _avtTestHelper, _votingTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  votingTestHelper = _votingTestHelper;
  proposalsManager = testHelper.getProposalsManager();
  communityProposalDeposit = await proposalsManager.getCommunityProposalDeposit();
  governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
}

function generateBytecode(_value, _key, _bytecode) {
  const bytecode = _bytecode || EMPTY_BYTES;
  const storageAddress = testHelper.getAventusStorage().address;
  const record = testHelper.hash('Proposals', _key);

  const encodedFunctionCall = web3.eth.abi.encodeFunctionCall(
    {
      name: 'setUInt',
      type: 'function',
      inputs: [
        {
          type: 'bytes32',
          name: '_record'
        },
        {
          type: 'uint256',
          name: '_value'
        }
      ]
    },
    [record, _value.toString()]
  );

  return web3.eth.abi.encodeParameters(['address', 'bytes', 'bytes'], [storageAddress, encodedFunctionCall, bytecode]);
}

async function getDoNothingBytecode() {
  governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
  return generateBytecode(governanceProposalDeposit, 'GovernanceProposalFixedDeposit');
}

async function depositAndCreateCommunityProposal(_communityProposalOwner) {
  await avtTestHelper.addAVT(communityProposalDeposit, _communityProposalOwner);
  await proposalsManager.createCommunityProposal(communityProposalDescription, {from: _communityProposalOwner});
  const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogCommunityProposalCreated');
  return logArgs.proposalId;
}

async function depositAndCreateGovernanceProposal(_governanceProposalOwner, _proposalBytecode) {
  governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
  const proposalBytecode = _proposalBytecode || await getDoNothingBytecode();
  await avtTestHelper.addAVT(governanceProposalDeposit, _governanceProposalOwner);
  await proposalsManager.createGovernanceProposal(governanceProposalDescription, proposalBytecode,
      {from: _governanceProposalOwner});
  const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalCreated');
  return logArgs.proposalId;
}

async function advanceTimeEndCommunityProposalAndWithdrawDeposit(_communityProposalOwner, _communityProposalId) {
  await votingTestHelper.advanceTimeToEndOfProposal(_communityProposalId);
  await proposalsManager.endCommunityProposal(_communityProposalId);
  await avtTestHelper.withdrawAVT(communityProposalDeposit, _communityProposalOwner);
}

async function advanceTimeEndGovernanceProposalAndWithdrawDeposit(_governanceProposalOwner, _governanceProposalId) {
  await votingTestHelper.advanceTimeToEndOfProposal(_governanceProposalId);
  await proposalsManager.endGovernanceProposal(_governanceProposalId);
  await avtTestHelper.withdrawAVT(governanceProposalDeposit, _governanceProposalOwner);
}

async function revealVoteEndCommunityProposalAndWithdrawDeposit(_communityProposalOwner, _votingAddress, _proposalId, _optionId) {
  await votingTestHelper.revealVote(_votingAddress, _proposalId, _optionId);
  await advanceTimeEndCommunityProposalAndWithdrawDeposit(_communityProposalOwner, _proposalId);
}

async function revealVoteEndGovernanceProposalAndWithdrawDeposit(_governanceProposalOwner, _votingAddress, _proposalId, _optionId) {
  await votingTestHelper.revealVote(_votingAddress, _proposalId, _optionId);
  await advanceTimeEndGovernanceProposalAndWithdrawDeposit(_governanceProposalOwner, _proposalId);
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeEndCommunityProposalAndWithdrawDeposit,
  advanceTimeEndGovernanceProposalAndWithdrawDeposit,
  depositAndCreateCommunityProposal,
  depositAndCreateGovernanceProposal,
  generateBytecode,
  getDoNothingBytecode,
  init,
  revealVoteEndCommunityProposalAndWithdrawDeposit,
  revealVoteEndGovernanceProposalAndWithdrawDeposit
};