const AventusVote = artifacts.require("AventusVote.sol");
const testHelper = require("./testHelper");
const web3Utils = require('web3-utils');

let aventusVote;

async function before() {
  aventusVote = await AventusVote.deployed();
}

// TODO: Share these methods with the events signing test code.

function getSignedMessage(proposalId, optionId, _address) {
  let hexString = convertToBytes32HexString(proposalId * 10 + optionId);
  let data = web3Utils.soliditySha3("0x" + hexString);
  let address = _address || testHelper.getAccount(0);
  let signedMessage = web3.eth.sign(address, data);
  return signedMessage;
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
  let prevTime = await aventusVote.getPrevTimeParamForCastVote(_proposalId, {from: address});
  await aventusVote.castVote(_proposalId, getSignatureSecret(signedMessage), prevTime, {from: address});
  return signedMessage;
}

async function revealVote(_signedMessage, _proposalId, _optionId, _address) {
  let address = _address || testHelper.getAccount(0);
  await aventusVote.revealVote(_signedMessage, _proposalId, _optionId, {from: address});
}

module.exports = {
  before,
  castVote,
  getSignatureSecret,
  getSignedMessage,
  revealVote,
}
