pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import "./LAventusTime.sol";
import "./LEventsCommon.sol";

library LEventsTickets {

  modifier onlyEventOwnerOrPrimaryDelegate(IAventusStorage _storage, uint _eventId, address _address) {
    LEventsCommon.checkOwnerOrRegisteredRole(_storage, _eventId, _address, "PrimaryDelegate");
    _;
  }

  modifier onlyEventOwnerOrSecondaryDelegate(IAventusStorage _storage, uint _eventId, address _address) {
    LEventsCommon.checkOwnerOrRegisteredRole(_storage, _eventId, _address, "SecondaryDelegate");
    _;
  }

  modifier onlyActiveEvent(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.eventActive(_storage, _eventId),
      "Event must be active"
    );
    _;
  }

  modifier onlyRefundableOrResellableTicket(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(
      LEventsCommon.eventActive(_storage, _eventId),
      "Event must be active"
    );
    require(
      !isTicketRefunded(_storage, _eventId, _ticketId),
      "Ticket must not have been refunded yet"
    );
    require(
      _ticketId != 0 && _ticketId <= _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketCount"))),
      "Ticket's Id must be valid"
    );
    _;
  }

  modifier onlyInTicketSalePeriod (IAventusStorage _storage, uint _eventId) {
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

  /**
   * @dev Refund sale of a ticket
   * @param _storage Storage contract
   * @param _eventId event id for the event in context
   * @param _ticketId ticket Id for the ticket to be refunded
   * @param _address address requesting this refund - must be event owner or delegate
   */
  function doRefundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, address _address)
    external
    onlyEventOwnerOrPrimaryDelegate(_storage, _eventId, _address)
    onlyRefundableOrResellableTicket(_storage, _eventId, _ticketId)
  {
    bytes32 refundTicketKey = keccak256(abi.encodePacked("Event", _eventId, "refundedTicketCount"));
    uint refundedTicketCount = _storage.getUInt(refundTicketKey);
    _storage.setUInt(refundTicketKey, refundedTicketCount + 1);
    setTicketStatusRefunded(_storage, _eventId, _ticketId);
    bytes32 ticketHash = _storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "ticketHash")));
    setTicketHashNotOwned(_storage, ticketHash);
  }

  /**
   * @dev Resell tickets for an active event.
   * @param _storage Storage contract
   * @param _eventId - event id for the event in context
   * @param _ticketId - original ticketId
   * @param _newBuyer - address of the ticket buyer
   * @param _address address requesting this sale - must be event owner or delegate
   *
   */
  function doResellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, address _newBuyer, address _address)
    external
    onlyEventOwnerOrSecondaryDelegate(_storage, _eventId, _address)
    onlyInTicketSalePeriod(_storage, _eventId)
    onlyRefundableOrResellableTicket(_storage, _eventId, _ticketId)
  {
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "buyer")), _newBuyer);
  }

  function doSellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, address _address)
    external
    onlyEventOwnerOrPrimaryDelegate(_storage, _eventId, _address)
    onlyInTicketSalePeriod(_storage, _eventId)
    onlyActiveEvent(_storage, _eventId)
    returns (uint ticketId_)
  {
    // TODO: Convert to a modifier when variable stack depth allows.
    ticketId_ = LEventsCommon.checkEventOverCapacity(_storage, _eventId);
    bytes32 ticketHash = keccak256(abi.encodePacked("Event", _eventId, "Ticket", _vendorTicketRefHash));
    setTicketHashOwned(_storage, ticketHash);
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketCount")), ticketId_);
    _storage.setBytes32(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "ticketHash")), ticketHash);
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

  function ticketHashIsOwned(IAventusStorage _storage, bytes32 _hash) private view returns (bool hashOwned_) {
    hashOwned_ = _storage.getBoolean(_hash);
  }

  function setTicketStatusRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "status")), 1);
  }

  function isTicketRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private view returns (bool refunded_) {
    refunded_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "status"))) == 1;
  }
}