pragma solidity ^0.4.24;

interface IEventsManager {
  /**
  * @dev Create an event
  * @param _eventDesc description or title of the event
  * @param _eventTime - the actual event time
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @param _eventSupportURL - verifiable official supporting url for the event
  * @return eventId_ - id of newly created event
  */
  function createEvent(
      string _eventDesc, uint _eventTime, uint _capacity,
      uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    external
    returns (uint eventId_);

  /**
  * @dev Create an event on behalf of a signer
  * @param _signedMessage a signed message
  * @param _eventDesc description or title of the event
  * @param _eventTime - the actual event time
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @param _eventSupportURL - verifiable official supporting url for the event
  * @param _owner - address of the event owner
  * @return uint eventId_ of newly created event
  */
  function signedCreateEvent(
      bytes _signedMessage,
      string _eventDesc, uint _eventTime,  uint _capacity,
      uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL,
      address _owner)
    external
    returns (uint eventId_);

  /**
  * @dev Cancel an event
  * @param _eventId - event id for the event to end
  */
  function cancelEvent(uint _eventId) external;

  /**
  * @dev Cancel an event on behalf of a signer
  * @param _signedMessage a signed message
  * @param _eventId - event id for the event to end
  */
  function signedCancelEvent(bytes _signedMessage, uint _eventId) external;

  /**
  * @dev Complete the process of event ending to balance the deposits
  * @param _eventId - event id for the event to end
  */
  function unlockEventDeposit(uint _eventId) external;

  /**
  * @dev Sell ticket
  * @param _eventId - event id for the event to end
  * @param _ticketDetails - ticket details
  * @param _buyer - address of the ticket buyer
  */
  function sellTicket(uint _eventId, string _ticketDetails, address _buyer) external;

  /**
  * @dev Sell ticket on behalf of a signer
  * @param _signedMessage a signed message
  * @param _eventId - event id for the event to end
  * @param _ticketDetails - ticket details
  * @param _buyer - address of the ticket buyer
  */
  function signedSellTicket(bytes _signedMessage, uint _eventId, string _ticketDetails, address _buyer) external;

  /**
  * @dev Refund sale of a ticket
  * @param _eventId - event id for the event in context
  * @param _ticketId - ticket Id for the ticket to be refunded
  */
  function refundTicket(uint _eventId, uint _ticketId) external;

  /**
  * @dev Refund sale of a ticket on behalf of a signer
  * @param _signedMessage a signed message
  * @param _eventId - event id for the event in context
  * @param _ticketId - ticket Id for the ticket to be refunded
  */
  function signedRefundTicket(bytes _signedMessage, uint _eventId, uint _ticketId) external;

  /**
  * @dev Register a delegate for an event
  * @param _eventId - ID of the event
  * @param _delegate - delegate address
  */
  function registerDelegate(uint _eventId, address _delegate) external;

  /**
  * @dev Deregister a delegate to an event
  * @param _eventId - ID of the event
  * @param _delegate - delegate of the event
  */
  function deregisterDelegate(uint _eventId, address _delegate) external;

  /**
   * Sell a ticket on the secondary market.
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _newBuyer address of the new buyer of the ticket.
   */
  function resellTicket(uint _ticketId, address _newBuyer)
    external
    pure;

  /**
   * Sell a ticket on the secondary market on behalf of a signer.
   * @param _signedMessage a signed message
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _newBuyer address of the new buyer of the ticket.
   */
  function signedResellTicket(bytes _signedMessage, uint _ticketId, address _newBuyer)
    external
    pure;

  /**
  * @dev Check if a delegate is registered for an event
  * @param _eventId - ID of the event
  * @param _delegate - Delegate to check
  * @return _registered - returns true if the supplied delegate is registered
  */
  function addressIsDelegate(uint _eventId, address _delegate)
    external
    view
    returns (bool registered_);

  /**
  * @dev Calculate the appropriate event deposit In USCents and in AVT
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @return uint depositInUSCents_ calculated deposit in US cents
  * @return uint depositInAVTDecimals_ calculated deposit in AVT Decimals
  */
  function getEventDeposit(uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVT_);
}
