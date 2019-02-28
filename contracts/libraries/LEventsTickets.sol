pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsRoles.sol";
import "./LEventsStorage.sol";
import "./LMembers.sol";
import "./LMerkleRoots.sol";
import "./zeppelin/LECRecovery.sol";

library LEventsTickets {

  modifier onlyActiveTicket(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(ticketIsActive(_storage, _eventId, _ticketId), "Ticket must be active");
    _;
  }

  modifier onlyResellerOnEvent(IAventusStorage _storage, uint _eventId) {
    require(LEventsRoles.isResellerOnEvent(_storage, _eventId, msg.sender),
        "Sender must be reseller on event");
    _;
  }

  modifier onlyVendorOnEvent(IAventusStorage _storage, uint _eventId) {
    require(LEventsRoles.isVendorOnEvent(_storage, _eventId, msg.sender), "Sender must be vendor on event");
    _;
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    external
    onlyVendorOnEvent(_storage, _eventId)
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, eventOwner);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _resellTicketTicketOwnerProof,
      address _newBuyer)
    external
    onlyResellerOnEvent(_storage, _eventId)
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof);
    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, _newBuyer);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner)
    external
    onlyVendorOnEvent(_storage, _eventId)
    returns (uint ticketId_)
  {
    ticketId_ = addTicket(_storage, _eventId, _vendorTicketRefHash, _ticketOwner, msg.sender);
  }

  function resellTicketOwnerPermissionCheck(IAventusStorage _storage, uint _eventId, uint _ticketId,
      bytes memory _ticketOwnerPermission)
   private
   view
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, ticketOwner));
    address signer = LECRecovery.recover(msgHash, _ticketOwnerPermission);
    require(signer == ticketOwner, "Resale must be signed by current owner");
  }

  function addTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner,
      address _vendor)
    private
    returns (uint ticketId_)
  {
    // the vendor address is appended to ensure uniqueness if different vendors pass the same ticket ref
    ticketId_ = uint(keccak256(abi.encodePacked(_vendorTicketRefHash, _vendor)));
    require(!ticketIsActive(_storage, _eventId, ticketId_), "Ticket must not already be active");
    LEventsStorage.setTicketOwner(_storage, _eventId, ticketId_, _ticketOwner);
  }

  function ticketIsActive(IAventusStorage _storage, uint _eventId, uint _ticketId)
    private
    view
    returns (bool isActive_)
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    isActive_ = ticketOwner != address(0);
  }
}