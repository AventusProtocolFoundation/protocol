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

function assertValidECDSA(signedMessage) {
  assert.equal(signedMessage.length, 132, 'signedMessage is wrong length: ' + signedMessage.length);
}

function getECDSAfieldV(signedMessage) {
  return parseInt(signedMessage.substring(130, 132)) + 27;
}

function getECDSAfields(signedMessage) {
  assertValidECDSA(signedMessage);
  const r = signedMessage.substring(0, 66);
  const s = '0x' + signedMessage.substring(66, 130);
  const v = getECDSAfieldV(signedMessage);
  return { v, r, s };
}

function getECDSAsecret(signedMessage) {
  assertValidECDSA(signedMessage);
  let v = getECDSAfieldV(signedMessage);
  v = convertToBytes32HexString(v);

  return web3Utils.soliditySha3("0x" + v + signedMessage.substring(2, 130));
}

async function castVote(_proposalId, _optionId, _address) {
  let address = _address || testHelper.getAccount(0);
  const signedMessage = await getSignedMessage(_proposalId, _optionId, _address);
  let prevTime = await aventusVote.getPrevTimeParamForCastVote(_proposalId, {from: address});
  await aventusVote.castVote(_proposalId, getECDSAsecret(signedMessage), prevTime, {from: address});
  return signedMessage;
}

async function revealVote(_proposalId, _optionId, _signedMessage, _address) {
  let address = _address || testHelper.getAccount(0);
  const ecdsaFields = getECDSAfields(_signedMessage);
  await aventusVote.revealVote(_proposalId, _optionId, ecdsaFields.v, ecdsaFields.r, ecdsaFields.s, {from: address});
}

module.exports = {
  before,
  castVote,
  getECDSAsecret,
  getSignedMessage,
  revealVote,
}
