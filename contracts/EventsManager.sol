pragma solidity ^0.5.2;

import "./interfaces/IAventusStorage.sol";
import "./interfaces/IEventsManager.sol";
import "./libraries/LEvents.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract EventsManager is IEventsManager, Owned, Versioned {

  IAventusStorage public s;

  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function createEvent(string calldata _eventDesc, uint _offSaleTime, bytes calldata _ownerProof)
    external
  {
    // TODO: Add new eventTime parameter instead of hard-coded zero - would be breaking change we don't want right now.
    LEvents.createEvent(s, _eventDesc, 0, _offSaleTime, _ownerProof);
  }

  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata, address _buyer) external {
    LEvents.sellTicket(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _buyer);
  }

  function cancelTicket(uint _eventId, uint _ticketId, bytes calldata _vendorProof) external {
    LEvents.cancelTicket(s, _eventId, _ticketId, _vendorProof);
  }

  function resellTicket(uint _eventId, uint _ticketId, bytes calldata _ticketOwnerPermission, address _newBuyer, bytes calldata _resellerProof,
    bytes calldata _doorData)
    external {
      LEvents.resellTicket(s, _eventId, _ticketId, _ticketOwnerPermission, _newBuyer, _resellerProof, _doorData);
  }

  function listTicket(uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata, bytes calldata _vendorProof,
      bytes calldata _doorData, bytes calldata _ticketOwnerProof, bytes32[] calldata _merklePath)
    external
  {
    LEvents.listTicketA(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData, _ticketOwnerProof);
    LEvents.listTicketB(s, _eventId, _vendorTicketRefHash, _merklePath);
    LEvents.listTicketC(s, _eventId, _vendorTicketRefHash, _vendorProof);
  }

  function registerRoleOnEvent(uint _eventId, address _roleAddress, string calldata _role) external {
    LEvents.registerRoleOnEvent(s, _eventId, _roleAddress, _role);
  }
}