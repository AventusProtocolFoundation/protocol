let testHelper;

async function init(_testHelper) {
  testHelper = _testHelper;
}

async function getCreateEventEventOwnerProof(_eventOwner, _eventDesc, _offSaleTime)
{
  const eventDescHash = testHelper.hash(_eventDesc);
  const msgHash = testHelper.hash(eventDescHash, _offSaleTime);
  return testHelper.sign(_eventOwner, msgHash);
}

async function getCancelTicketVendorProof(_vendor, _eventId, _ticketId, _ticketOwner) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _ticketOwner);
  return testHelper.sign(_vendor, msgHash);
}

async function getResellTicketTicketOwnerProof(_currentOwner, _eventId, _ticketId) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _currentOwner);
  return testHelper.sign(_currentOwner, msgHash);
}

async function getResellTicketResellerProof(_reseller, _eventId, _ticketId, _ticketOwnerProof, _newBuyer) {
  const msgHash = (_newBuyer !== undefined)
      ? testHelper.hash(_eventId, _ticketId, _ticketOwnerProof, _newBuyer)
      : testHelper.hash(_eventId, _ticketId, _ticketOwnerProof);
  return testHelper.sign(_reseller, msgHash);
}

async function getListTicketTicketOwnerProof(_ticketOwner, _vendorTicketRefHash) {
  return testHelper.sign(_ticketOwner, _vendorTicketRefHash);
}

async function getListTicketVendorProof(_vendor, _eventId, _vendorTicketRefHash, _buyer) {
  const msgHash = (_buyer !== undefined)
      ? testHelper.hash(_eventId, _vendorTicketRefHash, _buyer)
      : testHelper.hash(_eventId, _vendorTicketRefHash);
  return testHelper.sign(_vendor, msgHash);
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
  getCancelTicketVendorProof,
  getCastVoteSecret,
  getCreateEventEventOwnerProof,
  getListTicketTicketOwnerProof,
  getListTicketVendorProof,
  getResellTicketResellerProof,
  getResellTicketTicketOwnerProof,
  getRevealVoteSignedMessage,
  init,
};