pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsCommon.sol";

library LEventsEnact {
  bytes32 constant minimumEventReportingPeriodDaysKey = keccak256(abi.encodePacked("Events", "minimumEventReportingPeriodDays"));

  modifier onlyEventOwnerOrDelegate(IAventusStorage _storage, uint _eventId, address _eventOwnerOrDelegate) {
    require(
      LEventsCommon.addressIsOwner(_storage, _eventId, _eventOwnerOrDelegate) ||
        LEventsCommon.addressIsDelegate(_storage, _eventId, _eventOwnerOrDelegate),
      "Function must be called by owner or delegate only"
    );
    _;
  }

  modifier isTicketRefundable(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(
      eventActive(_storage, _eventId),
      "Event must be active"
    );
    require(
      !isTicketRefunded(_storage, _eventId, _ticketId),
      "Ticket must not have been refunded yet"
    );
    require(
      _ticketId != 0 && _ticketId <= _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount"))),
      "Ticket's Id must be valid"
    );

    _;
  }

  modifier isActiveEvent(IAventusStorage _storage, uint _eventId) {
    require(
      eventActive(_storage, _eventId),
      "Event must be active"
    );

    _;
  }

  modifier isInactiveEvent(IAventusStorage _storage, uint _eventId) {
    require(
      !eventActive(_storage, _eventId),
      "Event must be inactive"
    );
    _;
  }

  modifier isValidEvent(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.eventValid(_storage, _eventId),
      "Event must be valid"
    );
    _;
  }

  modifier inTicketSalePeriod (IAventusStorage _storage, uint _eventId) {
    uint currentTime = LAventusTime.getCurrentTime(_storage);
    require(
      currentTime < _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "eventTime"))),
      "Current date must be before event's date"
    );
    require(
      currentTime >= _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketSaleStartTime"))),
      "Current date must be after beginning of tickets sale period"
    );
    _;
  }

  modifier ticketSaleNotInProgress(IAventusStorage _storage, uint _eventId) {
    uint ticketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount")));
    uint refundedTicketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "RefundedTicketCount")));
    require(
      ticketCount == refundedTicketCount,
      "All sold tickets must have been refunded"
    );
    _;
  }

  modifier isNotUnderChallenge(IAventusStorage  _storage, uint _eventId) {
    require(
      LEventsCommon.eventIsNotUnderChallenge(_storage, _eventId),
      "Event must not be under challenge"
    );
    _;
  }

  /**
  * @dev Refund sale of a ticket
  * @param _storage Storage contract
  * @param _eventId event id for the event in context
  * @param _ticketId ticket Id for the ticket to be refunded
  * @param _eventOwnerOrDelegate address requesting this refund - must be event owner or delegate
  */
  function doRefundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, address _eventOwnerOrDelegate)
    public
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    isTicketRefundable(_storage, _eventId, _ticketId)
  {
    bytes32 refundTicketKey = keccak256(abi.encodePacked("Event", _eventId, "RefundedTicketCount"));
    uint refundedTicketCount = _storage.getUInt(refundTicketKey);
    _storage.setUInt(refundTicketKey, refundedTicketCount + 1);
    setTicketStatusRefunded(_storage, _eventId, _ticketId);
    setTicketHashNotOwned(_storage, getTicketHashFromTicketId(_storage, _eventId, _ticketId));
  }

  /**
  * @dev Create an event
  * @param _storage Storage contract
  * @param _eventDesc description or title of the event
  * @param _eventTime - the actual event time
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @param _eventSupportURL - verifiable official supporting url for the event
  * @param _owner - address of the event owner
  * @return uint eventId of newly created event
  */
  function doCreateEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    public
    returns (uint eventId)
  {
    validateEventCreation(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL, _owner);

    eventId = _storage.getUInt(LEventsCommon.getEventCountKey()) + 1;

    uint depositInUSCents = 0;
    uint depositInAVTDecimals = 0;
    (depositInUSCents, depositInAVTDecimals) =
      LEventsCommon.getEventDeposit(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);

    bytes32 key = keccak256(abi.encodePacked("ExpectedDeposits", _owner));
    _storage.setUInt(key, _storage.getUInt(key) + depositInAVTDecimals);
    require(
      _storage.getUInt(key) <= _storage.getUInt(keccak256(abi.encodePacked("Lock", "deposit", _owner))),
      "Insufficient deposit funds to create event"
    );


    _storage.setUInt(LEventsCommon.getEventCountKey(), eventId);
    _storage.setAddress(keccak256(abi.encodePacked("Event", eventId, "owner")), _owner);
    _storage.setString(keccak256(abi.encodePacked("Event", eventId, "description")), _eventDesc);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId, "capacity")), _capacity);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId, "averageTicketPriceInUSCents")), _averageTicketPriceInUSCents);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId, "ticketSaleStartTime")), _ticketSaleStartTime);
    _storage.setString(keccak256(abi.encodePacked("Event", eventId, "eventSupportURL")), _eventSupportURL);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId, "deposit")), depositInAVTDecimals);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId, "eventTime")), _eventTime);
  }

  function doUnlockEventDeposit(IAventusStorage _storage, uint _eventId)
    public
    isInactiveEvent(_storage, _eventId)
  {
    address owner = LEventsCommon.getEventOwner(_storage, _eventId);
    bytes32 key = keccak256(abi.encodePacked("ExpectedDeposits", owner));
    uint depositInAVT = LEventsCommon.getExistingEventDeposit(_storage, _eventId);
    require(
      depositInAVT != 0,
      "Unlocked event must have a positive deposit"
    );
    assert(_storage.getUInt(key) >= depositInAVT);
    _storage.setUInt(key, _storage.getUInt(key) - depositInAVT);
    setEventDeposit(_storage, _eventId, 0);
  }

  /**
  * @dev Executes Cancellation of an existing event.
  * @param _storage Storage contract
  * @param _eventId - id of the event to cancel
  */
  function doCancelEvent(IAventusStorage _storage, uint _eventId)
    public
    isActiveEvent(_storage, _eventId)
    isNotUnderChallenge(_storage, _eventId)
    ticketSaleNotInProgress(_storage, _eventId)
  {
    setEventStatusCancelled(_storage, _eventId);
    doUnlockEventDeposit(_storage, _eventId);
  }

  /**
  * @dev Sell tickets for an active event.
  * @param _storage Storage contract
  * @param _eventId - event id for the event in context
  * @param _ticketDetails - ticket details
  * @param _buyer - address of the ticket buyer
  * @param _eventOwnerOrDelegate address requesting this sale - must be event owner or delegate
  *
  * TODO: Consider adding ticket price so we can stop selling tickets when the total capital has been reached.
  */
  function doSellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer, address _eventOwnerOrDelegate)
    public
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    inTicketSalePeriod(_storage, _eventId)
    isActiveEvent(_storage, _eventId)
    returns (uint ticketId)
  {
    // TODO: Convert to a modifier when variable stack depth allows.
    ticketId = checkEventOverCapacity(_storage, _eventId);

    bytes32 ticketHash = getTicketHashFromDetails(_eventId, _ticketDetails);
    setTicketHashOwned(_storage, ticketHash);

    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount")), ticketId);
    _storage.setString(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId, "ticketDetails")), _ticketDetails);
    _storage.setBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId, "ticketHash")), ticketHash);
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId, "buyer")), _buyer);
  }


  function setTicketStatusRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "status")), 1);
  }

  function setTicketHashOwned(IAventusStorage _storage, bytes32 _hash) private {
    require(
      !ticketHashIsOwned(_storage, _hash),
      "This hash must not yet be owned"
    );
    _storage.setBoolean(_hash, true);
  }

  function setTicketHashNotOwned(IAventusStorage _storage, bytes32 _hash) private {
    require(
      ticketHashIsOwned(_storage, _hash),
      "This ticket hash must already be owned"
    );
    _storage.setBoolean(_hash, false);
  }

  function validateEventCreation(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    private
  {
    bytes32 hashMsg = LEventsCommon.hashEventParameters(_eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner);
    bytes32 hashMsgKey = keccak256(abi.encodePacked("Event", "hashMessage", hashMsg));

    uint minimumEventReportingPeriod = (1 days) * _storage.getUInt(minimumEventReportingPeriodDaysKey);
    assert(minimumEventReportingPeriod > 0);
    require(
      _ticketSaleStartTime >= LAventusTime.getCurrentTime(_storage) + minimumEventReportingPeriod,
      "Event cannot be created because there is not enough of a reporting period before its date"
    );


    // TODO: Consider a minimum ticket sale period from ParameterRegistry.
    require(
      _ticketSaleStartTime < _eventTime,
      "Tickets sale period must start before event"
    );
    require(
      bytes(_eventSupportURL).length != 0,
      "Event creation requires a non-empty URL"
    );
    require(
      !_storage.getBoolean(hashMsgKey),
      "There is already an existing event with these data"
    );

    _storage.setBoolean(hashMsgKey, true);
  }

  function setEventDeposit(IAventusStorage _storage, uint _eventId, uint _deposit) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "deposit")), _deposit);
  }

  function setEventStatusCancelled(IAventusStorage _storage, uint _eventId) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "status")), 1);
  }

  function isEventCancelled(IAventusStorage _storage, uint _eventId) private view returns (bool) {
    return _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "status"))) == 1;
  }

  function isEventFraudulent(IAventusStorage _storage, uint _eventId) private view returns (bool) {
    return _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "status"))) == 2;
  }

  function eventActive(IAventusStorage _storage, uint _eventId)
    private
    view
    isValidEvent(_storage, _eventId)
    returns (bool)
  {
    return(LAventusTime.getCurrentTime(_storage) < LEventsCommon.getEventTime(_storage, _eventId) &&
           !isEventCancelled(_storage, _eventId) &&
           !isEventFraudulent(_storage, _eventId));
  }

  function isTicketRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private view returns (bool) {
    return _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "status"))) == 1;
  }

  function ticketHashIsOwned(IAventusStorage _storage, bytes32 _hash) private view returns (bool) {
    return _storage.getBoolean(_hash);
  }

  function checkEventOverCapacity(IAventusStorage _storage, uint _eventId) private view  returns (uint ticketCount) {
    uint capacity = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "capacity")));
    ticketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount")));
    uint refundedTicketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "RefundedTicketCount")));
    ticketCount += 1;

    require(
      ticketCount - refundedTicketCount <= capacity,
      "Number of currently issued tickets must be below event's capacity"
    );
  }

  function getTicketHashFromTicketId(IAventusStorage _storage, uint _eventId, uint _ticketId) private view returns (bytes32 hash) {
    hash = _storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "ticketHash")));
  }

  function getTicketHashFromDetails(uint _eventId, string _ticketDetails) private pure returns (bytes32 hash) {
    hash = keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketDetails));
  }

}
