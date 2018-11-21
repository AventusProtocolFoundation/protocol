let testHelper;

async function init(_testHelper) {
  testHelper = _testHelper;
}

function getCreateEventEventOwnerProof(_eventOwner, _eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime,
    _averageTicketPriceInUSCents)
{
  const eventDescHash = testHelper.hash(_eventDesc);
  const urlHash = testHelper.hash(_eventSupportURL);
  const msgHash = testHelper.hash(eventDescHash, urlHash, _onSaleTime, _offSaleTime, _averageTicketPriceInUSCents);
  return testHelper.sign(_eventOwner, msgHash);
}

function getCancelEventEventOwnerProof(_eventOwner, _eventId) {
  const msgHash = testHelper.hash(_eventId);
  return testHelper.sign(_eventOwner, msgHash);
}

function getSellTicketVendorProof(_vendor, _eventId, _vendorTicketRefHash, _buyer) {
  const msgHash = (_buyer !== undefined)
      ? testHelper.hash(_eventId, _vendorTicketRefHash, _buyer)
      : testHelper.hash(_eventId, _vendorTicketRefHash);
  return testHelper.sign(_vendor, msgHash);
}

function getCancelTicketVendorProof(_vendor, _eventId, _ticketId, _ticketOwner) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _ticketOwner);
  return testHelper.sign(_vendor, msgHash);
}

function getResellTicketTicketOwnerProof(_currentOwner, _eventId, _ticketId) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _currentOwner);
  return testHelper.sign(_currentOwner, msgHash);
}

function getResellTicketResellerProof(_reseller, _eventId, _ticketId, _ticketOwnerProof, _newBuyer) {
  const msgHash = (_newBuyer !== undefined)
      ? testHelper.hash(_eventId, _ticketId, _ticketOwnerProof, _newBuyer)
      : testHelper.hash(_eventId, _ticketId, _ticketOwnerProof);
  return testHelper.sign(_reseller, msgHash);
}

function getListTicketTicketOwnerProof(_ticketOwner, _vendorTicketRefHash) {
  return testHelper.sign(_ticketOwner, _vendorTicketRefHash);
}

function getListTicketVendorProof(_vendor, _eventId, _vendorTicketRefHash, _buyer) {
  return getSellTicketVendorProof(_vendor, _eventId, _vendorTicketRefHash, _buyer);
}

function getSendToFriendTicketOwnerProof(_ticketOwner, _eventId, _ticketId) {
  const msgHash = testHelper.hash(_eventId, _ticketId, _ticketOwner);
  return testHelper.sign(_ticketOwner, msgHash);
}

function getRevealVoteSignedMessage(_address, _proposalId, _optionId) {
  const hexString = convertToBytes32HexString(_proposalId * 10 + _optionId);
  const data = testHelper.hash('0x' + hexString);
  return testHelper.sign(_address, data);
}

function getCastVoteSecret(_address, _proposalId, _optionId) {
  const signedMessage = getRevealVoteSignedMessage(_address, _proposalId, _optionId);
  return testHelper.hash(signedMessage);
}

// convert a number to hex-64 zero-padded string
function convertToBytes32HexString(_num) {
  let n = _num.toString(16);
  return new Array(64 - n.length + 1).join('0') + n;
}

// Keep exports alphabetical.
module.exports = {
  getCancelEventEventOwnerProof,
  getCancelTicketVendorProof,
  getCastVoteSecret,
  getCreateEventEventOwnerProof,
  getListTicketTicketOwnerProof,
  getListTicketVendorProof,
  getResellTicketResellerProof,
  getResellTicketTicketOwnerProof,
  getRevealVoteSignedMessage,
  getSellTicketVendorProof,
  getSendToFriendTicketOwnerProof,
  init,
};