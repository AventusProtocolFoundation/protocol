let testHelper, avtTestHelper, votingTestHelper;
let membersManager;

const BN = web3.utils.BN;

async function init(_testHelper, _avtTestHelper, _votingTestHelper) {
  testHelper = _testHelper;
  avtTestHelper  =_avtTestHelper;
  votingTestHelper = _votingTestHelper;

  membersManager = testHelper.getMembersManager();
}

async function challengeMemberAndMarkAsFraudulent(_memberAddress, _memberType, _challenger) {
  const challenge = await challengeMember(_memberAddress, _memberType, _challenger);

  await avtTestHelper.addAVTToFund(avtTestHelper.oneAVTTo18SigFig, _challenger, 'stake');
  await votingTestHelper.advanceTimeCastAndRevealVotes(challenge.proposalId, [{voter: _challenger, option: 1}]);
  await advanceTimeAndEndMemberChallenge(_memberAddress, _memberType, challenge.proposalId, _challenger);

  await withdrawSuccessfulChallengeWinnings(challenge.proposalId, _challenger, _challenger,
      _challenger, challenge.deposit);
  await avtTestHelper.withdrawAVTFromFund(avtTestHelper.oneAVTTo18SigFig, _challenger, 'stake');

  return challenge;
}

async function challengeMember(_memberAddress, _memberType, _challengeOwner) {
  const existingDeposit = await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
  await avtTestHelper.addAVTToFund(existingDeposit, _challengeOwner, 'deposit');
  await membersManager.challengeMember(_memberAddress, _memberType, {from: _challengeOwner});
  const logArgs = await testHelper.getLogArgs(membersManager, 'LogMemberChallenged');
  return {proposalId : logArgs.proposalId.toNumber(), deposit : existingDeposit};
}

async function advanceTimeAndEndMemberChallenge(_memberAddress, _memberType, _challengeProposalId, _challengeEnder) {
  await votingTestHelper.advanceTimeToEndOfProposal(_challengeProposalId);
  await membersManager.endMemberChallenge(_memberAddress, _memberType, {from: _challengeEnder});
}

async function withdrawSuccessfulChallengeWinnings(_challengeProposalId, _challengeOwner, _challengeEnder, _voter, _deposit) {
  const challengeOwnerAndEnderWinnings = _deposit.div(new BN(10));
  await avtTestHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeOwner, 'deposit');
  await avtTestHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeEnder, 'deposit');

  await votingTestHelper.claimVoterWinnings(_challengeProposalId, _voter);
  const totalVoterWinnings = _deposit.sub(challengeOwnerAndEnderWinnings).sub(challengeOwnerAndEnderWinnings);

  await avtTestHelper.withdrawAVTFromFund(totalVoterWinnings, _voter, 'deposit');
  await avtTestHelper.withdrawAVTFromFund(_deposit, _challengeOwner, 'deposit');
  return totalVoterWinnings.mod(new BN(2));
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeAndEndMemberChallenge,
  challengeMember,
  challengeMemberAndMarkAsFraudulent,
  init,
};