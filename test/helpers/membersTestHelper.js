const MembersManager = artifacts.require("MembersManager");
const votingTestHelper = require("./votingTestHelper");
const web3Utils = require('web3-utils');

let testHelper, membersManager;

async function before(_testHelper) {
  testHelper = _testHelper;
  votingTestHelper.before(testHelper);

  membersManager = await MembersManager.deployed();
  membersManager = testHelper.profilingHelper.profileContract(membersManager, "membersManager");
};

async function depositAndRegisterMember(_memberAddress, _memberType, _evidenceUrl, _desc) {
  let amount = await membersManager.getNewMemberDeposit(_memberType);
  await testHelper.addAVTToFund(amount, _memberAddress, "deposit");
  await membersManager.registerMember(_memberAddress, _memberType, _evidenceUrl, _desc);
}

async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
  await membersManager.deregisterMember(_memberAddress, _memberType);
  let deposit = await membersManager.getNewMemberDeposit(_memberType);
  await testHelper.withdrawAVTFromFund(deposit, _memberAddress, "deposit");
}

async function challengeMember(_memberAddress, _memberType, _challengeOwner) {
  const existingDeposit = await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
  await testHelper.addAVTToFund(existingDeposit, _challengeOwner, "deposit");
  await membersManager.challengeMember(_memberAddress, _memberType, {from: _challengeOwner});
  const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberChallenged);
  return {challengeProposalId : eventArgs.proposalId.toNumber(), deposit : existingDeposit};
}

async function endMemberChallenge(_memberAddress, _memberType, _challengeProposalId, _challengeEnder) {
  await testHelper.advanceTimeToEndOfProposal(_challengeProposalId);
  await membersManager.endMemberChallenge(_memberAddress, _memberType, {from: _challengeEnder});
  const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberChallengeEnded);
  assert.equal(_challengeProposalId, eventArgs.proposalId.toNumber());
}

async function withdrawSuccessfulChallengeWinnings(_challengeProposalId, _challengeOwner, _challengeEnder, _voter, _deposit) {
  const challengeOwnerAndEnderWinnings = _deposit.dividedToIntegerBy(10);
  await testHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeOwner, 'deposit');
  await testHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeEnder, 'deposit');

  await votingTestHelper.claimVoterWinnings(_challengeProposalId, _voter);
  const totalVoterWinnings = _deposit.minus(challengeOwnerAndEnderWinnings).minus(challengeOwnerAndEnderWinnings);

  await testHelper.withdrawAVTFromFund(totalVoterWinnings, _voter, 'deposit');
  await testHelper.withdrawAVTFromFund(_deposit, _challengeOwner, 'deposit');
  return totalVoterWinnings.mod(2).toNumber();
}

async function challengeMemberAndMarkAsFraudulent(_memberAddress, _memberType, _challengeOwner, _challengeEnder, _voter) {
  const challenge = await challengeMember(_memberAddress, _memberType, _challengeOwner);

  await testHelper.addAVTToFund(testHelper.oneAVT, _voter, 'stake');
  await votingTestHelper.advanceTimeCastAndRevealVotes(challenge.challengeProposalId, [{voter: _voter, option: 1}]);

  await endMemberChallenge(_memberAddress, _memberType, challenge.challengeProposalId, _challengeEnder);

  const remainder = await withdrawSuccessfulChallengeWinnings(challenge.challengeProposalId, _challengeOwner, _challengeEnder, _voter, challenge.deposit);
  await testHelper.withdrawAVTFromFund(testHelper.oneAVT, _voter, 'stake');

  if (remainder > 0) {
    console.log(`TODO: Deal with challenge (Id: ${challenge.challengeProposalId}) remainder of ${remainder} AVT`);
  }
}

module.exports = {
  getMembersManager: () => membersManager,

  before,
  depositAndRegisterMember,
  deregisterMemberAndWithdrawDeposit,
  challengeMemberAndMarkAsFraudulent
}