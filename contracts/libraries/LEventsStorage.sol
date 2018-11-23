pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";

library LEventsStorage {

  bytes32 constant minimumEventReportingPeriodDaysKey = keccak256(abi.encodePacked("Events",
      "minimumEventReportingPeriodDays"));
  bytes32 constant freeEventDepositAmountUSCentsKey = keccak256(abi.encodePacked("Events", "freeEventDepositAmountUSCents"));
  bytes32 constant paidEventDepositAmountUSCentsKey = keccak256(abi.encodePacked("Events", "paidEventDepositAmountUSCents"));
  bytes32 constant eventCountKey = keccak256(abi.encodePacked("EventCount"));

  function getFreeEventDepositInUSCents(IAventusStorage _storage)
    external
    view
    returns (uint freeEventDeposit_)
  {
    freeEventDeposit_ = _storage.getUInt(freeEventDepositAmountUSCentsKey);
  }

  function getPaidEventDepositInUSCents(IAventusStorage _storage)
    external
    view
    returns (uint paidEventDeposit_)
  {
    paidEventDeposit_ = _storage.getUInt(paidEventDepositAmountUSCentsKey);
  }

  function getEventCount(IAventusStorage _storage)
    external
    view
    returns (uint eventCount_)
  {
    eventCount_ = _storage.getUInt(eventCountKey);
  }

  function setEventCount(IAventusStorage _storage, uint _eventCount) external {
    _storage.setUInt(eventCountKey, _eventCount);
  }

  function isRegisteredAsMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
    view
    returns (bool isRegistered_)
  {
    isRegistered_ = _storage.getBoolean(keccak256(abi.encodePacked("Event", _eventId, "member", _memberType, "address",
        _memberAddress)));
  }

  function setRegisteredMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
  {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "member", _memberType, "address", _memberAddress)),
        true);
  }

  function clearRegisteredMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
  {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "member", _memberType, "address", _memberAddress)),
        false);
  }

  function getTicketOwner(IAventusStorage _storage, uint _eventId, uint _ticketId)
    external
    view
    returns (address ticketOwner_)
  {
    ticketOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "ticketOwner")));
  }

  function setTicketOwner(IAventusStorage _storage, uint _eventId, uint _ticketId, address _ticketOwner) external {
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "ticketOwner")), _ticketOwner);
  }

  function getEventHash(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (bytes32 eventHash_)
  {
    eventHash_ = _storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "hash")));
  }

  function setEventHash(IAventusStorage _storage, uint _eventId, bytes32 _eventHash) external {
    _storage.setBytes32(keccak256(abi.encodePacked("Event", _eventId, "hash")), _eventHash);
  }

  function isExistingEventHash(IAventusStorage _storage, bytes32 _eventHash)
    external
    view
    returns (bool isExisting_)
  {
    isExisting_ = _storage.getBoolean(keccak256(abi.encodePacked("Event", "hash", _eventHash)));
  }

  function setEventHashExists(IAventusStorage _storage, bytes32 _eventHash) external {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", "hash", _eventHash)), true);
  }

  function clearEventHashExists(IAventusStorage _storage, bytes32 _eventHash) external {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", "hash", _eventHash)), false);
  }

  function getOffSaleTime(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint offSaleTime_)
  {
    offSaleTime_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "offSaleTime")));
  }

  function setOffSaleTime(IAventusStorage _storage, uint _eventId, uint _offSaleTime) external {
    uint onSaleTime = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "onSaleTime")));
    require(onSaleTime < _offSaleTime, "Tickets on-sale time must be before off-sale time");
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "offSaleTime")), _offSaleTime);
  }

  function getOnSaleTime(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint onSaleTime_)
  {
    onSaleTime_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "onSaleTime")));
  }

  function setOnSaleTime(IAventusStorage _storage, uint _eventId, uint _onSaleTime) external {
    uint minimumEventReportingPeriod = (1 days) * _storage.getUInt(minimumEventReportingPeriodDaysKey);
    uint minimumOnSaleTime = LAventusTime.getCurrentTime(_storage) + minimumEventReportingPeriod;
    require(_onSaleTime >= minimumOnSaleTime, "Tickets on-sale time is not far enough in the future");
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "onSaleTime")), _onSaleTime);
  }

  function getAventityId(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "aventityId")));
  }

  function setAventityId(IAventusStorage _storage, uint _eventId, uint _aventityId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "aventityId")), _aventityId);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (address eventOwner_)
  {
    eventOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "owner")));
  }

  function setEventOwner(IAventusStorage _storage, uint _eventId, address _eventOwner) external {
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "owner")), _eventOwner);
  }

}