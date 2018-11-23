pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsStorage.sol";

library LEventsTickets {

  modifier onlyActiveTicket(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(ticketIsActive(_storage, _eventId, _ticketId), "Ticket must be active");
    _;
  }

  modifier onlyVendorOrEventRegisteredBroker(IAventusStorage _storage, uint _eventId) {
    bool isActive = LEventsCommon.isActiveBrokerOnEvent(_storage, _eventId, msg.sender) ||
        LEventsCommon.isActiveVendorOnEvent(_storage, _eventId, msg.sender);
    require(isActive, "Must be vendor or registered broker on this event");
    _;
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _cancelTicketVendorProof)
    external
    onlyVendorOrEventRegisteredBroker(_storage, _eventId)
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    bytes32 cancelTicketHash = keccak256(abi.encodePacked(_eventId, _ticketId, ticketOwner));
    address vendor = LEventsCommon.getSignerFromProof(cancelTicketHash, _cancelTicketVendorProof);
    require(LEventsCommon.isActiveVendorOnEvent(_storage, _eventId, vendor), "Proof must be valid and signed by vendor");
    blockTicket(_storage, _eventId, _ticketId);  // Separate method: stack too deep.
    LEventsCommon.recordProtocolInteractions(_storage, vendor, "Primary");
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _resellTicketTicketOwnerProof,
      address _newBuyer, bytes _resellTicketResellerProof)
    external
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    address reseller = LEventsCommon.getSenderAndValidateResellerProof(_storage, _eventId, _ticketId,
        _resellTicketTicketOwnerProof, _newBuyer, _resellTicketResellerProof);
    LEventsCommon.resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof);
    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, _newBuyer);
    LEventsCommon.recordProtocolInteractions(_storage, reseller, "Secondary");
  }

  function addTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner,
        bytes _addTicketVendorProof)
    external
    returns (uint ticketId_)
  {
    address vendor = LEventsCommon.getSenderAndValidateVendorProof(_storage, _eventId, _vendorTicketRefHash,
        _ticketOwner, _addTicketVendorProof);
    // the vendor address is appended to ensure uniqueness if different vendors pass the same ticket ref
    ticketId_ = uint(keccak256(abi.encodePacked(_vendorTicketRefHash, vendor)));
    require(!ticketIsActive(_storage, _eventId, ticketId_), "Ticket must not already be active");
    LEventsStorage.setTicketOwner(_storage, _eventId, ticketId_, _ticketOwner);
    LEventsCommon.recordProtocolInteractions(_storage, vendor, "Primary");
  }

  function ticketIsActive(IAventusStorage _storage, uint _eventId, uint _ticketId) private view
    returns (bool isActive_)
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    isActive_ = ticketOwner != address(0);
  }

  function blockTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    private
  {
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    // Set the ticket owner to the event owner to 'block' the ticket if it exists on a merkle tree
    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, eventOwner);
  }
}