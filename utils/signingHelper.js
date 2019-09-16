// TODO: Consolidate all usages of testHelper.sign into here.

function hash() {
  return web3.utils.soliditySha3(...arguments);
}

async function sign(_data, _signer) {
  return web3.eth.sign(_data, _signer);
}

async function getCreateEventEventOwnerProof(_eventOwner, _eventDesc, _eventTime, _rules, _sender)
{
  const eventDescHash = hash(_eventDesc);
  const msgHash = hash(eventDescHash, _eventTime, _rules, _sender);
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
};