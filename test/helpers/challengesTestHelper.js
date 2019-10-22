let testHelper, avtTestHelper, votingTestHelper;
let validatorsManager;

const BN = web3.utils.BN;

async function init(_testHelper, _avtTestHelper, _votingTestHelper) {
  testHelper = _testHelper;
  avtTestHelper  =_avtTestHelper;
  votingTestHelper = _votingTestHelper;

  validatorsManager = testHelper.getValidatorsManager();
}

async function challengeValidatorAndMarkAsFraudulent(_validatorAddress, _challenger) {
  const challenge = await challengeValidator(_validatorAddress, _challenger);

  await avtTestHelper.addAVT(avtTestHelper.oneAVTInAttoAVTBN, _challenger);
  await votingTestHelper.advanceTimeCastAndRevealVotes(challenge.proposalId, [{voter: _challenger, option: 1}]);
  await advanceTimeAndEndValidatorChallenge(_validatorAddress, challenge.proposalId, _challenger);

  await withdrawSuccessfulChallengeWinnings(challenge.proposalId, _challenger, _challenger,
      _challenger, challenge.deposit);
  await avtTestHelper.withdrawAVT(avtTestHelper.oneAVTInAttoAVTBN, _challenger);

  return challenge;
}

async function challengeValidator(_validatorAddress, _challengeOwner) {
  const existingDeposit = await validatorsManager.getExistingValidatorDeposit(_validatorAddress);
  await avtTestHelper.addAVT(existingDeposit, _challengeOwner);
  await validatorsManager.challengeValidator(_validatorAddress, {from: _challengeOwner});
  const logArgs = await testHelper.getLogArgs(validatorsManager, 'LogValidatorChallenged');
  return {proposalId : logArgs.proposalId.toNumber(), deposit : existingDeposit};
}

async function advanceTimeAndEndValidatorChallenge(_validatorAddress, _challengeProposalId, _challengeEnder) {
  await votingTestHelper.advanceTimeToEndOfProposal(_challengeProposalId);
  await validatorsManager.endValidatorChallenge(_validatorAddress, {from: _challengeEnder});
}

async function withdrawSuccessfulChallengeWinnings(_challengeProposalId, _challengeOwner, _challengeEnder, _voter, _deposit) {
  const challengeOwnerAndEnderWinnings = _deposit.div(new BN(10));
  await avtTestHelper.withdrawAVT(challengeOwnerAndEnderWinnings, _challengeOwner);
  await avtTestHelper.withdrawAVT(challengeOwnerAndEnderWinnings, _challengeEnder);

  await votingTestHelper.claimVoterWinnings(_challengeProposalId, _voter);
  const totalVoterWinnings = _deposit.sub(challengeOwnerAndEnderWinnings).sub(challengeOwnerAndEnderWinnings);

  await avtTestHelper.withdrawAVT(totalVoterWinnings, _voter);
  await avtTestHelper.withdrawAVT(_deposit, _challengeOwner);
  return totalVoterWinnings.mod(new BN(2));
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeAndEndValidatorChallenge,
  challengeValidator,
  challengeValidatorAndMarkAsFraudulent,
  init,
};