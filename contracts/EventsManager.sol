pragma solidity ^0.4.24;

import './interfaces/IAventusStorage.sol';
import './interfaces/IEventsManager.sol';
import './libraries/LEvents.sol';
import './Owned.sol';
import './Versioned.sol';

contract EventsManager is IEventsManager, Owned, Versioned {

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param _s Persistent storage contract
  */
  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function createEvent(string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime, uint _eventTime, uint _capacity,
      uint _averageTicketPriceInUSCents, bytes _ownerProof)
    external
    returns (uint eventId_)
  {
    eventId_ = LEvents.createEvent(s, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
        _averageTicketPriceInUSCents, _ownerProof);
  }

  function cancelEvent(uint _eventId, bytes _ownerProof) external {
    LEvents.cancelEvent(s, _eventId, _ownerProof);
  }

  function unlockEventDeposit(uint _eventId) external {
    LEvents.unlockEventDeposit(s, _eventId);
  }

  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, address _buyer, bytes _sellerProof, bytes _doorData) external {
    LEvents.sellTicket(s, _eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _sellerProof, _doorData);
  }

  function refundTicket(uint _eventId, uint _ticketId, bytes _vendorProof) external {
    LEvents.refundTicket(s, _eventId, _ticketId, _vendorProof);
  }

  function resellTicket(uint _eventId, uint _ticketId, bytes _ownerPermission, address _newBuyer, bytes _sellerProof)
    external {
      LEvents.resellTicket(s, _eventId, _ticketId, _ownerPermission, _newBuyer, _sellerProof);
  }

  function registerRole(uint _eventId, string _role, address _address) external {
    LEvents.registerRole(s, _eventId, _role, _address);
  }

  function deregisterRole(uint _eventId, string _role, address _address) external {
    LEvents.deregisterRole(s, _eventId, _role, _address);
  }

  function roleIsRegistered(uint _eventId, string _role, address _address)
    external
    view
    returns (bool registered_)
  {
    registered_ = LEvents.roleIsRegistered(s, _eventId, _role, _address);
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

  function challengeEvent(uint _eventId) external returns (uint proposalId_) {
    proposalId_ = LEvents.challengeEvent(s, _eventId);
  }
}