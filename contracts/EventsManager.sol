pragma solidity ^0.4.24;

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

  function createEvent(string _eventDesc, string _eventSupportURL, uint _onSaleTime, uint _offSaleTime,
    uint _averageTicketPriceInUSCents, bytes _ownerProof)
    external
  {
    LEvents.createEvent(s, _eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime, _averageTicketPriceInUSCents, _ownerProof);
  }

  function cancelEvent(uint _eventId, bytes _ownerProof) external {
    LEvents.cancelEvent(s, _eventId, _ownerProof);
  }

  function endEvent(uint _eventId) external {
    LEvents.endEvent(s, _eventId);
  }

  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, address _buyer, bytes _vendorProof,
    bytes _doorData) external {
    LEvents.sellTicket(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _vendorProof, _doorData);
  }

  function cancelTicket(uint _eventId, uint _ticketId, bytes _vendorProof) external {
    LEvents.cancelTicket(s, _eventId, _ticketId, _vendorProof);
  }

  function resellTicket(uint _eventId, uint _ticketId, bytes _ticketOwnerPermission, address _newBuyer, bytes _resellerProof,
    bytes _doorData)
    external {
      LEvents.resellTicket(s, _eventId, _ticketId, _ticketOwnerPermission, _newBuyer, _resellerProof, _doorData);
  }

  function listTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, bytes _vendorProof,
    bytes _doorData, bytes _ticketOwnerProof, bytes32[] _merklePath)
    external {
      LEvents.listTicketA(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData, _ticketOwnerProof);
      LEvents.listTicketB(s, _eventId, _vendorTicketRefHash, _merklePath);
      LEvents.listTicketC(s, _eventId, _vendorTicketRefHash, _vendorProof);
  }

  function registerMemberOnEvent(uint _eventId, address _memberAddress, string _memberType) external {
    LEvents.registerMemberOnEvent(s, _eventId, _memberAddress, _memberType);
  }

  function deregisterMemberFromEvent(uint _eventId, address _memberAddress, string _memberType) external {
    LEvents.deregisterMemberFromEvent(s, _eventId, _memberAddress, _memberType);
  }

  function getNewEventDeposit(uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVT_)
  {
    (depositInUSCents_, depositInAVT_) = LEvents.getNewEventDeposit(s, _averageTicketPriceInUSCents);
  }

  function getExistingEventDeposit(uint _eventId) external view returns(uint eventDeposit_) {
    eventDeposit_ = LEvents.getExistingEventDeposit(s, _eventId);
  }

}