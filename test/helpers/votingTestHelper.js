let testHelper, timeTestHelper, signingTestHelper, aventusStorage;
let proposalsManager;

async function init(_testHelper, _timeTestHelper, _signingTestHelper) {
  testHelper = _testHelper;
  timeTestHelper = _timeTestHelper;
  signingTestHelper = _signingTestHelper;

  aventusStorage = testHelper.getAventusStorage();
  proposalsManager = testHelper.getProposalsManager();
}

async function advanceToProposalPeriod(_proposalId, _period) {
  const periodKey = testHelper.hash('Proposal', _proposalId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await timeTestHelper.advanceToTime(parseInt(period));
}

async function advanceTimeToVotingStart(_proposalId) {
  await advanceToProposalPeriod(_proposalId, 'votingStart');
}

async function advanceTimeToRevealingStart(_proposalId) {
  await advanceToProposalPeriod(_proposalId, 'revealingStart');
}

async function advanceTimeToEndOfProposal(_proposalId) {
  await advanceToProposalPeriod(_proposalId, 'revealingEnd');
}

async function advanceTimeCastAndRevealVotes(_proposalId, _votes) {
  await advanceTimeToVotingStart(_proposalId);
  _votes.forEach(async vote => await castVote(vote.voter, _proposalId, vote.option));
  await advanceTimeToRevealingStart(_proposalId);
  _votes.forEach(async vote => await revealVote(vote.voter, _proposalId, vote.option));
}

async function castVote(_voter, _proposalId, _optionId) {
  const voteSecret = await signingTestHelper.getCastVoteSecret(_voter, _proposalId, _optionId);
  let prevTime = await proposalsManager.getPrevTimeParamForCastVote(_proposalId, {from: _voter});
  await proposalsManager.castVote(_proposalId, voteSecret, prevTime, {from: _voter});
}

async function revealVote(_voter, _proposalId, _optionId) {
  const signedMessage = await signingTestHelper.getRevealVoteSignedMessage(_voter, _proposalId, _optionId);
  await proposalsManager.revealVote(signedMessage, _proposalId, _optionId, {from: _voter});
}

async function advanceTimeAndRevealVote(_voter, _proposalId, _optionId) {
  await advanceTimeToRevealingStart(_proposalId);
  const signedMessage = await signingTestHelper.getRevealVoteSignedMessage(_voter, _proposalId, _optionId);
  await proposalsManager.revealVote(signedMessage, _proposalId, _optionId, {from: _voter});
}

async function advanceTimeAndCastVote(_voter, _proposalId, _optionId) {
  await advanceTimeToVotingStart(_proposalId);
  await castVote(_voter, _proposalId, _optionId);
}

async function claimVoterWinnings(_proposalId, _voterAddress) {
  await proposalsManager.claimVoterWinnings(_proposalId, {from: _voterAddress});
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeAndCastVote,
  advanceTimeAndRevealVote,
  advanceTimeCastAndRevealVotes,
  advanceTimeToEndOfProposal,
  advanceTimeToRevealingStart,
  advanceTimeToVotingStart,
  castVote,
  claimVoterWinnings,
  init,
  revealVote
};