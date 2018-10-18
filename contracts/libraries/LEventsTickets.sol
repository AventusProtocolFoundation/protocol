pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsStorage.sol";

library LEventsTickets {

  modifier onlyActiveTicket(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(ticketIsActive(_storage, _eventId, _ticketId), "Ticket must be active");
    _;
  }

  modifier onlyVendorOrEventRegisteredBroker(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.isActiveBrokerOnEvent(_storage, msg.sender, _eventId) ||
      LEventsCommon.isActiveVendorOnEvent(_storage, _eventId, msg.sender),
      "Must be vendor or registered broker on this event"
    );
    _;
  }

  modifier onlyValidVendorProof(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _vendorProof) {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId));
    address vendor = LEventsCommon.getSignerFromProof(msgHash, _vendorProof);
    require(LEventsCommon.isActiveVendorOnEvent(_storage, _eventId, vendor), "Proof must be signed by a registered vendor");
    _;
  }

  function returnTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _vendorProof)
    external
    onlyVendorOrEventRegisteredBroker(_storage, _eventId)
    onlyValidVendorProof(_storage, _eventId, _ticketId, _vendorProof)
  {
    blockTicket(_storage, _eventId, _ticketId);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ticketOwnerPermission,
      address _newBuyer, bytes _resellerProof, bytes _doorData)
    external
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    LEventsCommon.validateResellerProofAndSender(_storage, _eventId, _ticketId, _ticketOwnerPermission, _newBuyer,
        _resellerProof);
    LEventsCommon.resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _ticketOwnerPermission);
    setTicketOwnershipDetails(_storage, _eventId, _ticketId, _doorData, _newBuyer);
  }

  function sendTicketToFriend(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ticketOwnerPermission,
        bytes _newDoorData)
    external
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    address currentOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);

    if (msg.sender != currentOwner) {
      bool authorisedSender = LEventsCommon.isActiveBrokerOnEvent(_storage, msg.sender, _eventId);
      require(authorisedSender, "Sender should be an authorised broker");
    }

    LEventsCommon.resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _ticketOwnerPermission);
    LEventsStorage.setTicketDoorData(_storage, _eventId, _ticketId, _newDoorData);
  }

  function addTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner,
        bytes _vendorProof, bytes _doorData)
    external
    returns (uint ticketId_)
  {
    address vendor = LEventsCommon.getSenderAndValidateVendorProof(_storage, _eventId, _vendorTicketRefHash,
        _ticketOwner, _vendorProof);
    // the vendor address is appended to ensure uniqueness if different vendors pass the same ticket ref
    ticketId_ = uint(keccak256(abi.encodePacked(_vendorTicketRefHash, vendor)));
    require(!ticketIsActive(_storage, _eventId, ticketId_), "ticket must not already be active");
    setTicketOwnershipDetails(_storage, _eventId, ticketId_, _doorData, _ticketOwner);
  }

  function setTicketOwnershipDetails(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _doorData,
      address _ticketOwner)
    private
  {
    LEventsStorage.setTicketDoorData(_storage, _eventId, _ticketId, _doorData);
    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, _ticketOwner);
  }

  function ticketIsActive(IAventusStorage _storage, uint _eventId, uint _ticketId) private view
    returns (bool isActive_)
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    isActive_ = ticketOwner != address(0);
  }

  function blockTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    private
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    bytes memory emptyDoorData;
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    // Set the ticket owner to the event owner and clear the doorData to 'block' the ticket if it exists on a merkle tree
    setTicketOwnershipDetails(_storage, _eventId, _ticketId, emptyDoorData, eventOwner);
  }
}