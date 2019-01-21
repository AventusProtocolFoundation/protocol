pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsRoles.sol";
import "./LEventsStorage.sol";
import "./LMembers.sol";
import "./zeppelin/LECRecovery.sol";

library LEventsTickets {
  modifier onlyActiveTicket(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(ticketIsActive(_storage, _eventId, _ticketId), "Ticket must be active");
    _;
  }

  modifier onlyValidatorOrVendorOnEvent(IAventusStorage _storage, uint _eventId) {
    require(LEventsRoles.isValidatorOrVendorOnEvent(_storage, _eventId, msg.sender),
        "Sender must be validator or vendor on event");
    _;
  }

  modifier onlyValidatorOrResellerOnEvent(IAventusStorage _storage, uint _eventId) {
    require(LEventsRoles.isValidatorOrResellerOnEvent(_storage, _eventId, msg.sender),
        "Sender must be validator or reseller on event");
    _;
  }

  modifier onlyVendorOnEvent(IAventusStorage _storage, uint _eventId) {
    require(LEventsRoles.isVendorOnEvent(_storage, _eventId, msg.sender), "Sender must be vendor on event");
    _;
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _cancelTicketVendorProof)
    external
    onlyValidatorOrVendorOnEvent(_storage, _eventId)
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    address ticketOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    bytes32 cancelTicketHash = keccak256(abi.encodePacked(_eventId, _ticketId, ticketOwner));
    address vendor = LECRecovery.recover(cancelTicketHash, _cancelTicketVendorProof);
    require(LEventsRoles.isVendorOnEvent(_storage, _eventId, vendor), "Proof must be valid and signed by vendor");
    blockTicket(_storage, _eventId, _ticketId);  // Separate method: stack too deep.

    if (!LEventsRoles.isVendorOnEvent(_storage, _eventId, msg.sender)) {
      LMembers.checkValidatorActiveAndRecordInteraction(_storage);
    }
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _resellTicketTicketOwnerProof,
      address _newBuyer, bytes calldata _resellTicketResellerProof)
    external
    onlyValidatorOrResellerOnEvent(_storage, _eventId)
    onlyActiveTicket(_storage, _eventId, _ticketId)
  {
    doResellTicket(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof, _newBuyer, _resellTicketResellerProof);

    if (!LEventsRoles.isResellerOnEvent(_storage, _eventId, msg.sender)) {
      LMembers.checkValidatorActiveAndRecordInteraction(_storage);
    }
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner)
    external
    onlyVendorOnEvent(_storage, _eventId)
    returns (uint ticketId_)
  {
    ticketId_ = addTicket(_storage, _eventId, _vendorTicketRefHash, _ticketOwner, msg.sender);
  }

  function listTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _ticketOwner,
      bytes calldata _vendorProof)
    external
    onlyValidatorOrVendorOnEvent(_storage, _eventId)
    returns (uint ticketId_)
  {
    bytes32 blankHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash));
    bytes32 integratedHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _ticketOwner));
    address vendor = getSignerAndValidateProof(_storage, _eventId, "Primary", _vendorProof, blankHash, integratedHash);

    ticketId_ = addTicket(_storage, _eventId, _vendorTicketRefHash, _ticketOwner, vendor);

    if (!LEventsRoles.isVendorOnEvent(_storage, _eventId, msg.sender)) {
      LMembers.checkValidatorActiveAndRecordInteraction(_storage);
    }
  }

  function doResellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes memory _resellTicketTicketOwnerProof,
      address _newBuyer, bytes memory _resellTicketResellerProof)
    private
  {
    resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof);

    bytes32 blankHash = keccak256(abi.encodePacked(_eventId, _ticketId, _resellTicketTicketOwnerProof));
    bytes32 integratedHash = keccak256(abi.encodePacked(_eventId, _ticketId, _resellTicketTicketOwnerProof,_newBuyer));
    getSignerAndValidateProof(_storage, _eventId, "Secondary", _resellTicketResellerProof, blankHash, integratedHash);

    LEventsStorage.setTicketOwner(_storage, _eventId, _ticketId, _newBuyer);
  }

  function getSignerAndValidateProof(IAventusStorage _storage, uint _eventId, string memory _role, bytes memory _proof,
      bytes32 _blankHash, bytes32 _integratedHash)
    private
    view
    returns (address signer_)
  {
    signer_ = LECRecovery.recover(_blankHash, _proof);
    if (!LEventsRoles.isTraderOnEvent(_storage, _eventId, signer_, _role)) {
      signer_ = LECRecovery.recover(_integratedHash, _proof);
    }

    require(LEventsRoles.isTraderOnEvent(_storage, _eventId, signer_, _role),
        string(abi.encodePacked("Invalid ", _role, " proof")));
  }

  function resellTicketOwnerPermissionCheck(IAventusStorage _storage, uint _eventId, uint _ticketId,
      bytes memory _ticketOwnerPermission)
   private
   view {
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