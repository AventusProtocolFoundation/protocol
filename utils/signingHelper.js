// TODO: Consolidate all usages of testHelper.sign into here.

const merkleTreeHelper = require('./merkleTreeHelper.js');
const web3Tools = require('./web3Tools.js');

// TODO: Use web3Tools.hash directly.
function hash() {
  return web3Tools.hash(...arguments);
}

// TODO: Use web3Tools.hash directly.
async function sign(_data, _signer) {
  return web3Tools.sign(_data, _signer);
}

async function getCreateEventEventOwnerProof(_eventOwner, _eventDesc, _rules)
{
  const eventDescHash = hash(_eventDesc);
  const msgHash = hash(eventDescHash, _rules);
  return sign(msgHash, _eventOwner);
}

async function getRegisterRoleEventOwnerProof(_eventOwner, _eventId, _roleAddress, _role) {
  const msgHash = hash(_eventId, _roleAddress, _role);
  return sign(msgHash, _eventOwner);
}

async function getRevealVoteSignedMessage(_address, _proposalId, _optionId) {
  const hexString = convertToBytes32HexString(_proposalId * 10 + _optionId);
  const msgHash = hash('0x' + hexString);
  return sign(msgHash, _address);
}

async function getCastVoteSecretFromRevealVoteSignedMessage(_signedMessage) {
  return hash(_signedMessage);
}

// TODO: Use this method from test code too. Also, create and share similar methods for all other leaf provenance fields.
async function getTicketSaleProvenance(_eventId, _ticketRef, _properties, _vendor)
{
  const identityVendorProof = await getTicketSaleIdentityVendorProof(_eventId, _ticketRef, _vendor);
  const propertiesVendorProof = await getTicketSalePropertiesVendorProof(_properties, _vendor);
  return web3Tools.encodeParams(['bytes', 'bytes'], [identityVendorProof, propertiesVendorProof]);
}

async function getTicketSaleIdentityVendorProof(_eventId, _ticketRef, _vendor){
  const saleIdentityHash = hash(merkleTreeHelper.TransactionType.Sell, _eventId, _ticketRef);
  return sign(saleIdentityHash, _vendor);
}

async function getTicketSalePropertiesVendorProof(_properties, _vendor){
  const salePropertiesHash = hash(merkleTreeHelper.TransactionType.Sell, _properties);
  return sign(salePropertiesHash, _vendor);
}

async function getCastVoteSecret(_address, _proposalId, _optionId) {
  const signedMessage = await getRevealVoteSignedMessage(_address, _proposalId, _optionId);
  return getCastVoteSecretFromRevealVoteSignedMessage(signedMessage);
}

// convert a number to hex-64 zero-padded string
function convertToBytes32HexString(_num) {
  let n = _num.toString(16);
  return new Array(64 - n.length + 1).join('0') + n;
}

// Keep exports alphabetical.
module.exports = {
  getCastVoteSecret,
  getCastVoteSecretFromRevealVoteSignedMessage,
  getCreateEventEventOwnerProof,
  getRegisterRoleEventOwnerProof,
  getRevealVoteSignedMessage,
  getTicketSaleProvenance
};