pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsCommon.sol";

library LEventsEnact {
  modifier onlyEventOwnerOrDelegate(IAventusStorage _storage, uint _eventId, address _eventOwnerOrDelegate) {
    LEventsCommon.checkOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate);
    _;
  }


  modifier ticketIsRefundable(IAventusStorage _storage, uint _eventId, uint _ticketId) {
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

  modifier isNotUnderChallenge(IAventusStorage _storage, uint _eventId) {
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
    external
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    ticketIsRefundable(_storage, _eventId, _ticketId)
  {
    bytes32 refundTicketKey = keccak256(abi.encodePacked("Event", _eventId, "RefundedTicketCount"));
    uint refundedTicketCount = _storage.getUInt(refundTicketKey);
    _storage.setUInt(refundTicketKey, refundedTicketCount + 1);
    setTicketStatusRefunded(_storage, _eventId, _ticketId);
    bytes32 ticketHash = _storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "ticketHash")));
    setTicketHashNotOwned(_storage, ticketHash);
  }

  /**
  * @dev Executes Cancellation of an existing event.
  * @param _storage Storage contract
  * @param _eventId - id of the event to cancel
  */
  function doCancelEvent(IAventusStorage _storage, uint _eventId)
    external
    isActiveEvent(_storage, _eventId)
    isNotUnderChallenge(_storage, _eventId)
    ticketSaleNotInProgress(_storage, _eventId)
  {
    setEventStatusCancelled(_storage, _eventId);
    doUnlockEventDeposit(_storage, _eventId);
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
  * @return uint eventId_ of newly created event
  *
  * TODO: Could be external but too many variables for stack unless public
  */
  function doCreateEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    public
    returns (uint eventId_)
  {
    LEventsCommon.validateEventCreation(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime, _eventSupportURL, _owner);

    eventId_ = _storage.getUInt(LEventsCommon.getEventCountKey()) + 1;

    uint depositInUSCents = 0;
    uint depositInAVTDecimals = 0;
    (depositInUSCents, depositInAVTDecimals) =
      LEventsCommon.getEventDeposit(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);

    bytes32 key = keccak256(abi.encodePacked("ExpectedDeposits", _owner));
    _storage.setUInt(key, _storage.getUInt(key) + depositInAVTDecimals);
    require(
      _storage.getUInt(key) <= LLock.getBalance(_storage, _owner, "deposit"),
      "Insufficient deposit funds to create event"
    );

    _storage.setUInt(LEventsCommon.getEventCountKey(), eventId_);
    _storage.setAddress(keccak256(abi.encodePacked("Event", eventId_, "owner")), _owner);
    _storage.setString(keccak256(abi.encodePacked("Event", eventId_, "description")), _eventDesc);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "capacity")), _capacity);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "averageTicketPriceInUSCents")), _averageTicketPriceInUSCents);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "ticketSaleStartTime")), _ticketSaleStartTime);
    _storage.setString(keccak256(abi.encodePacked("Event", eventId_, "eventSupportURL")), _eventSupportURL);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "deposit")), depositInAVTDecimals);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "eventTime")), _eventTime);
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
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "deposit")), 0);
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
  * TODO: Could be external but too many variables for stack unless public
  */
  function doSellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer, address _eventOwnerOrDelegate)
    public
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    inTicketSalePeriod(_storage, _eventId)
    isActiveEvent(_storage, _eventId)
    returns (uint ticketId_)
  {
    // TODO: Convert to a modifier when variable stack depth allows.
    ticketId_ = LEventsCommon.checkEventOverCapacity(_storage, _eventId);

    bytes32 ticketHash = keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketDetails));
    setTicketHashOwned(_storage, ticketHash);

    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount")), ticketId_);
    _storage.setString(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "ticketDetails")), _ticketDetails);
    _storage.setBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "ticketHash")), ticketHash);
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "buyer")), _buyer);
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

  function setEventStatusCancelled(IAventusStorage _storage, uint _eventId) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "status")), 1);
  }

  function eventActive(IAventusStorage _storage, uint _eventId)
    private
    view
    isValidEvent(_storage, _eventId)
    returns (bool active_)
  {
    bool eventHasHappened = LAventusTime.getCurrentTime(_storage) >=  _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "eventTime")));
    bool eventIsCancelled = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "status"))) == 1;
    bool eventIsFraudulent = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "status"))) == 2;
    active_ = !eventHasHappened && !eventIsCancelled && !eventIsFraudulent;
  }

  function isTicketRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private view returns (bool refunded_) {
    refunded_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "status"))) == 1;
  }

  function ticketHashIsOwned(IAventusStorage _storage, bytes32 _hash) private view returns (bool hashOwned_) {
    hashOwned_ = _storage.getBoolean(_hash);
  }

}
