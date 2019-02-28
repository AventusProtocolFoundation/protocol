let testHelper;

async function init(_testHelper) {
  testHelper = _testHelper;
}

async function getCreateEventEventOwnerProof(_eventOwner, _eventDesc, _eventTime, _offSaleTime, _sender)
{
  const eventDescHash = testHelper.hash(_eventDesc);
  const msgHash = testHelper.hash(eventDescHash, _eventTime, _offSaleTime, _sender);
  return testHelper.sign(_eventOwner, msgHash);
}

async function getTakeEventOffSaleEventOwnerProof(_eventOwner, _eventId) {
  return testHelper.sign(_eventOwner, testHelper.hash(_eventId));
}

async function getRegisterRoleEventOwnerProof(_eventOwner, _eventId, _roleAddress, _role) {
  const msgHash = testHelper.hash(_eventId, _roleAddress, _role);
  return testHelper.sign(_eventOwner, msgHash);
}

async function getResellTicketTicketOwnerProof(_currentOwner, _eventId, _ticketId) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _currentOwner);
  return testHelper.sign(_currentOwner, msgHash);
}

async function getRevealVoteSignedMessage(_address, _proposalId, _optionId) {
  const hexString = convertToBytes32HexString(_proposalId * 10 + _optionId);
  const data = testHelper.hash('0x' + hexString);
  return testHelper.sign(_address, data);
}

async function getCastVoteSecret(_address, _proposalId, _optionId) {
  const signedMessage = await getRevealVoteSignedMessage(_address, _proposalId, _optionId);
  return testHelper.hash(signedMessage);
}

// convert a number to hex-64 zero-padded string
function convertToBytes32HexString(_num) {
  let n = _num.toString(16);
  return new Array(64 - n.length + 1).join('0') + n;
}

// Keep exports alphabetical.
module.exports = {
  getCastVoteSecret,
  getCreateEventEventOwnerProof,
  getRegisterRoleEventOwnerProof,
  getResellTicketTicketOwnerProof,
  getRevealVoteSignedMessage,
  getTakeEventOffSaleEventOwnerProof,
  init,
};