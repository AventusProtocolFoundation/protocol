pragma solidity ^0.4.24;

import "./LEventsCommon.sol";
import "./LAventities.sol";

library LEventsEnact {

  modifier onlyActiveEvent(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.eventActive(_storage, _eventId),
      "Event must be active"
    );
    _;
  }

  modifier onlyInactiveEvent(IAventusStorage _storage, uint _eventId) {
    require(
      !LEventsCommon.eventActive(_storage, _eventId),
      "Event must be inactive"
    );
    _;
  }

  modifier onlyWhenNoOutstandingTickets(IAventusStorage _storage, uint _eventId) {
    uint ticketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketCount")));
    uint refundedTicketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "refundedTicketCount")));
    require(
      ticketCount == refundedTicketCount,
      "All sold tickets must have been refunded"
    );
    _;
  }

  function doChallengeEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyActiveEvent(_storage, _eventId)
    returns (uint challengeProposalId_)
  {
    uint aventityId = LEventsCommon.getAventityIdFromEventId(_storage, _eventId);
    challengeProposalId_ = LAventities.challengeAventity(_storage, aventityId);
    LProposal.emitLogEventChallenged(_storage, _eventId, challengeProposalId_);
  }

  /**
   * @dev Executes Cancellation of an existing event.
   * @param _storage Storage contract
   * @param _eventId - id of the event to cancel
   */
  function doCancelEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyActiveEvent(_storage, _eventId)
    onlyWhenNoOutstandingTickets(_storage, _eventId)
  {
    setEventStatusCancelled(_storage, _eventId);
    doEndEvent(_storage, _eventId);
  }

  // TODO: Could be external but too many variables for stack unless public
  function doCreateEvent(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime,
    uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, address _owner)
    public
    returns (uint eventId_, uint depositInAVTDecimals_)
  {
    LEventsCommon.validateEventCreation(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
        _averageTicketPriceInUSCents);

    eventId_ = _storage.getUInt(LEventsCommon.getEventCountKey()) + 1;

    uint depositInUSCents;
    (depositInUSCents, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);

    registerAventityEvent(_storage, _owner, eventId_, depositInAVTDecimals_);

    _storage.setUInt(LEventsCommon.getEventCountKey(), eventId_);
    _storage.setAddress(keccak256(abi.encodePacked("Event", eventId_, "owner")), _owner);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "capacity")), _capacity);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "ticketSaleStartTime")), _ticketSaleStartTime);
    _storage.setString(keccak256(abi.encodePacked("Event", eventId_, "eventSupportURL")), _eventSupportURL);
    _storage.setUInt(keccak256(abi.encodePacked("Event", eventId_, "eventTime")), _eventTime);
  }

  function doEndEvent(IAventusStorage _storage, uint _eventId)
    public
    onlyInactiveEvent(_storage, _eventId)
  {
    uint aventityId = LEventsCommon.getAventityIdFromEventId(_storage, _eventId);
    LAventities.deregisterAventity(_storage, aventityId);
  }

  function setEventStatusCancelled(IAventusStorage _storage, uint _eventId) private {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "status")), 1);
  }

  function registerAventityEvent(IAventusStorage _storage, address _eventOwner, uint _eventId, uint _eventDeposit)
    private
  {
    uint aventityId = LAventities.registerAventity(_storage, _eventOwner, _eventDeposit);

    // In addition to the standard aventity data, events need a mapping from eventId to aventityId.
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "aventityId")), aventityId);
  }
}
