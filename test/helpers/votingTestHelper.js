const signingHelper = require('../../utils/signingHelper');

let testHelper, timeTestHelper;
let proposalsManager;

async function init(_testHelper, _timeTestHelper) {
  testHelper = _testHelper;
  timeTestHelper = _timeTestHelper;
  proposalsManager = testHelper.getProposalsManager();
}

async function advanceTimeToVotingStart(_proposalId) {
  const votingStart = await proposalsManager.getVotingStartTime(_proposalId);
  await timeTestHelper.advanceToTime(votingStart);
}

async function advanceTimeToRevealingStart(_proposalId) {
  const revealingStart = await proposalsManager.getVotingRevealStartTime(_proposalId);
  await timeTestHelper.advanceToTime(revealingStart);
}

async function advanceTimeToEndOfProposal(_proposalId) {
  const revealingEnd = await proposalsManager.getVotingRevealEndTime(_proposalId);
  await timeTestHelper.advanceToTime(revealingEnd);
}

async function advanceTimeCastAndRevealVotes(_proposalId, _votes) {
  await advanceTimeToVotingStart(_proposalId);
  _votes.forEach(async vote => await castVote(vote.voter, _proposalId, vote.option));
  await advanceTimeToRevealingStart(_proposalId);
  _votes.forEach(async vote => await revealVote(vote.voter, _proposalId, vote.option));
}

async function castVote(_voter, _proposalId, _optionId) {
  const voteSecret = await signingHelper.getCastVoteSecret(_voter, _proposalId, _optionId);
  await proposalsManager.castVote(_proposalId, voteSecret, {from: _voter});
}

async function revealVote(_voter, _proposalId, _optionId) {
  const signedMessage = await signingHelper.getRevealVoteSignedMessage(_voter, _proposalId, _optionId);
  await proposalsManager.revealVote(signedMessage, _proposalId, _optionId, {from: _voter});
}

async function advanceTimeAndRevealVote(_voter, _proposalId, _optionId) {
  await advanceTimeToRevealingStart(_proposalId);
  const signedMessage = await signingHelper.getRevealVoteSignedMessage(_voter, _proposalId, _optionId);
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