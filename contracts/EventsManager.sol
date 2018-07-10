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

  function createEvent(string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    external
    returns (uint eventId_)
  {
    eventId_ = LEvents.createEvent(s, _eventDesc, _eventTime, _capacity,
      _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL);
  }

  function signedCreateEvent(bytes _signedMessage, string _eventDesc, uint _eventTime,
    uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    external
    returns (uint eventId_)
  {
    eventId_ = LEvents.signedCreateEvent(s, _signedMessage, _eventDesc, _eventTime, _capacity,
      _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL, _owner);
  }

  function cancelEvent(uint _eventId) external {
    LEvents.cancelEvent(s, _eventId);
  }

  function signedCancelEvent(bytes _signedMessage, uint _eventId) external {
    LEvents.signedCancelEvent(s, _signedMessage, _eventId);
  }

  function unlockEventDeposit(uint _eventId) external {
    LEvents.unlockEventDeposit(s, _eventId);
  }

  function sellTicket(uint _eventId, string _ticketDetails, address _buyer) external {
    LEvents.sellTicket(s, _eventId, _ticketDetails, _buyer);
  }

  function signedSellTicket(bytes _signedMessage, uint _eventId, string _ticketDetails, address _buyer) external {
    LEvents.signedSellTicket(s, _signedMessage, _eventId, _ticketDetails, _buyer);
  }

  function refundTicket(uint _eventId, uint _ticketId) external {
    LEvents.refundTicket(s, _eventId, _ticketId);
  }

  function signedRefundTicket(bytes _signedMessage, uint _eventId, uint _ticketId) external {
    LEvents.signedRefundTicket(s, _signedMessage, _eventId, _ticketId);
  }

  function resellTicket(uint _eventId, uint _ticketId, bytes _ownerPermission, address _newBuyer)
    external {
      LEvents.resellTicket(s, _eventId, _ticketId, _ownerPermission, _newBuyer);
  }

  function signedResellTicket(bytes _signedMessage, uint _eventId, uint _ticketId,
    bytes _ownerPermission, address _newBuyer)
    external {
    LEvents.signedResellTicket(s, _signedMessage, _eventId, _ticketId, _ownerPermission, _newBuyer);
  }

  function registerDelegate(uint _eventId, string _role, address _delegate) external {
    LEvents.registerDelegate(s, _eventId, _role, _delegate);
  }

  function deregisterDelegate(uint _eventId, string _role, address _delegate) external {
    LEvents.deregisterDelegate(s, _eventId, _role, _delegate);
  }

  function addressIsDelegate(uint _eventId, string _role, address _delegate)
    external
    view
    returns (bool registered_)
  {
    registered_ = LEvents.addressIsDelegate(s, _eventId, _role, _delegate);
  }

  function getEventDeposit(uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVT_)
  {
    (depositInUSCents_, depositInAVT_) = LEvents.getEventDeposit(s, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);
  }
}
