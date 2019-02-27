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

  function createEvent(string calldata _eventDesc, uint _eventTime, uint _offSaleTime, bytes calldata _ownerProof,
      address _eventOwner)
    external
  {
    LEvents.createEvent(s, _eventDesc, _eventTime, _offSaleTime, _ownerProof, _eventOwner);
  }

  function takeEventOffSale(uint _eventId, bytes calldata _eventOwnerProof)
    external
  {
    LEvents.takeEventOffSale(s, _eventId, _eventOwnerProof);
  }

  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata, address _buyer)
    external
  {
    LEvents.sellTicket(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _buyer);
  }

  function cancelTicket(uint _eventId, uint _ticketId)
    external
  {
    LEvents.cancelTicket(s, _eventId, _ticketId);
  }

  function resellTicket(uint _eventId, uint _ticketId, bytes calldata _ticketOwnerPermission, address _newBuyer)
    external
  {
      LEvents.resellTicket(s, _eventId, _ticketId, _ticketOwnerPermission, _newBuyer);
  }

  function registerRoleOnEvent(uint _eventId, address _roleAddress, string calldata _role,
      bytes calldata _registerRoleEventOwnerProof)
    external
  {
    LEvents.registerRoleOnEvent(s, _eventId, _roleAddress, _role, _registerRoleEventOwnerProof);
  }
}
