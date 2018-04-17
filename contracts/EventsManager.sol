pragma solidity ^0.4.19;

import './interfaces/IAventusStorage.sol';
import './interfaces/IEventsManager.sol';
import './libraries/LEvents.sol';
import './Owned.sol';

contract EventsManager is IEventsManager, Owned {
  event LogEventCreated(uint eventId, string eventDesc);
  event LogSignedEventCreated(uint eventId, string eventDesc);
  event LogUnlockEventDeposit(uint eventId);
  event LogEventCancellation(uint eventId);
  event LogSignedEventCancellation(uint eventId);
  event LogTicketSale(uint eventId, uint ticketId, address buyer);
  event LogSignedTicketSale(uint eventId, uint ticketId, address buyer);
  event LogTicketRefund(uint eventId, uint ticketId);
  event LogSignedTicketRefund(uint eventId, uint ticketId);
  event LogRegisterDelegate(uint eventId, address delegate);
  event LogDeregisterDelegate(uint eventId, address delegate);

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param s_ Persistent storage contract
  */
  function EventsManager(IAventusStorage s_) public {
    s = s_;
  }

  function createEvent(string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    external
    returns (uint eventId)
  {
    eventId = LEvents.createEvent(s, _eventDesc, _eventTime, _capacity,
      _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL);
    emit LogEventCreated(eventId, _eventDesc);
  }

  function signedCreateEvent(uint8 _v, bytes32 _r, bytes32 _s, string _eventDesc, uint _eventTime,
    uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    external
    returns (uint eventId)
  {
    eventId = LEvents.signedCreateEvent(s, _v, _r, _s, _eventDesc, _eventTime, _capacity,
      _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL, _owner);
    emit LogSignedEventCreated(eventId, _eventDesc);
  }

  function cancelEvent(uint _eventId) external {
    LEvents.cancelEvent(s, _eventId);
    emit LogEventCancellation(_eventId);
  }

  function signedCancelEvent(uint8 _v, bytes32 _r, bytes32 _s, uint _eventId) external {
    LEvents.signedCancelEvent(s, _v, _r, _s, _eventId);
    emit LogSignedEventCancellation(_eventId);
  }

  function unlockEventDeposit(uint _eventId) external {
    LEvents.unlockEventDeposit(s, _eventId);
    emit LogUnlockEventDeposit(_eventId);
  }

  function sellTicket(uint _eventId, string _ticketDetails, address _buyer) external {
    uint ticketId = LEvents.sellTicket(s, _eventId, _ticketDetails, _buyer);
    emit LogTicketSale(_eventId, ticketId, _buyer);
  }

  function signedSellTicket(uint8 _v, bytes32 _r, bytes32 _s, uint _eventId, string _ticketDetails, address _buyer) external {
    uint ticketId = LEvents.signedSellTicket(s, _v, _r, _s, _eventId, _ticketDetails, _buyer);
    emit LogSignedTicketSale(_eventId, ticketId, _buyer);
  }

  function refundTicket(uint _eventId, uint _ticketId) external {
    LEvents.refundTicket(s, _eventId, _ticketId);
    emit LogTicketRefund(_eventId, _ticketId);
  }

  function signedRefundTicket(uint8 _v, bytes32 _r, bytes32 _s, uint _eventId, uint _ticketId) external {
    LEvents.signedRefundTicket(s, _v, _r, _s, _eventId, _ticketId);
    emit LogSignedTicketRefund(_eventId, _ticketId);
  }

  function resellTicket(uint /* ticketId */, address /* newBuyer */)
    pure
    external {
    // TODO: Support secondary market sales.
  }

  function signedResellTicket(uint8 /*_v*/, bytes32 /*_r*/, bytes32 /*_s*/,
      uint /* ticketId */, address /* newBuyer */)
    pure
    external {
    // TODO: Support secondary market sales.
  }

  function registerDelegate(uint _eventId, address _delegate) external {
    LEvents.registerDelegate(s, _eventId, _delegate);
    emit LogRegisterDelegate(_eventId, _delegate);
  }

  function deregisterDelegate(uint _eventId, address _delegate) external {
    LEvents.deregisterDelegate(s, _eventId, _delegate);
    emit LogDeregisterDelegate(_eventId, _delegate);
  }

  function addressIsDelegate(uint _eventId, address _delegate)
    external
    view
    returns (bool _registered)
  {
    return LEvents.addressIsDelegate(s, _eventId, _delegate);
  }

  function getEventDeposit(uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    external
    view
    returns (uint depositInUSCents, uint depositInAVT)
  {
    return LEvents.getEventDeposit(s, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);
  }
}