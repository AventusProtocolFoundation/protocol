// TODO: Rename this file to proposalsTestHelper.js

const ProposalsManager = artifacts.require("ProposalsManager.sol");
const web3Utils = require('web3-utils');

let testHelper, proposalsManager;

async function before(_testHelper) {
  testHelper = _testHelper;

  proposalsManager = testHelper.getProposalsManager();
}

function getSignedMessage(proposalId, optionId, _address) {
  let hexString = convertToBytes32HexString(proposalId * 10 + optionId);
  let data = web3Utils.soliditySha3("0x" + hexString);
  let address = _address || testHelper.getAccount(0);
  return testHelper.createSignedMessage(address, data);
}

// convert a number to hex-64 zero-padded string
function convertToBytes32HexString(num) {
    let n = num.toString(16);
    return new Array(64 - n.length + 1).join('0') + n;
}

function getSignatureSecret(_signedMessage) {
  return web3Utils.soliditySha3(_signedMessage);
}

async function castVote(_proposalId, _optionId, _address) {
  let address = _address || testHelper.getAccount(0);
  const signedMessage = await getSignedMessage(_proposalId, _optionId, _address);
  let prevTime = await proposalsManager.getPrevTimeParamForCastVote(_proposalId, {from: address});
  await proposalsManager.castVote(_proposalId, getSignatureSecret(signedMessage), prevTime, {from: address});
  return signedMessage;
}

async function cancelVote(_proposalId, _address) {
  let address = _address || testHelper.getAccount(0);
  await proposalsManager.cancelVote(_proposalId, {from: address});
}

async function revealVote(_signedMessage, _proposalId, _optionId, _address) {
  let address = _address || testHelper.getAccount(0);
  await proposalsManager.revealVote(_signedMessage, _proposalId, _optionId, {from: address});
}

async function advanceTimeCastAndRevealVotes(_proposalId, _votes) {
  await testHelper.advanceTimeToVotingStart(_proposalId);
  let signedMessages = {};
  _votes.forEach(async vote => {
    let signedMessage = await castVote(_proposalId, vote.option, vote.voter);
    signedMessages[vote.voter+vote.option] = signedMessage;
  });

  await testHelper.advanceTimeToRevealingStart(_proposalId);

  _votes.forEach(async vote => await revealVote(signedMessages[vote.voter+vote.option], _proposalId, vote.option, vote.voter));
}

async function claimVoterWinnings(proposalId_, voterAddress_) {
  await proposalsManager.claimVoterWinnings(proposalId_, {from: voterAddress_});
}

/**
 * Returns the current blockchain time on the main net or the mock time on a test network
 */
async function getAventusTime() {
  return await proposalsManager.getAventusTime();
}

module.exports = {
  before,
  castVote,
  cancelVote,
  getSignatureSecret,
  getSignedMessage,
  revealVote,
  getAventusTime,
  advanceTimeCastAndRevealVotes,
  claimVoterWinnings
}
