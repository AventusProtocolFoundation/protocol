pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";

library LEventsStorage {

  string constant eventsSchema = "Events";
  string constant eventSchema = "Event";

  bytes32 constant eventCountKey = keccak256(abi.encodePacked(eventsSchema, "EventCount"));

  function getEventCount(IAventusStorage _storage)
    external
    view
    returns (uint eventCount_)
  {
    eventCount_ = _storage.getUInt(eventCountKey);
  }

  function setEventCount(IAventusStorage _storage, uint _eventCount)
    external
  {
    _storage.setUInt(eventCountKey, _eventCount);
  }

  function isRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role)
    external
    view
    returns (bool isRegistered_)
  {
    isRegistered_ = _storage.getBoolean(keccak256(abi.encodePacked(eventSchema, _eventId, "role", _role, "address",
        _roleAddress)));
  }

  function setRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role)
    external
  {
    _storage.setBoolean(keccak256(abi.encodePacked(eventSchema, _eventId, "role", _role, "address", _roleAddress)), true);
  }

  function getTicketOwner(IAventusStorage _storage, uint _eventId, uint _ticketId)
    external
    view
    returns (address ticketOwner_)
  {
    ticketOwner_ = _storage.getAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "Ticket", _ticketId, "ticketOwner")));
  }

  function setTicketOwner(IAventusStorage _storage, uint _eventId, uint _ticketId, address _ticketOwner)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "Ticket", _ticketId, "ticketOwner")), _ticketOwner);
  }

  function getOffSaleTime(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint offSaleTime_)
  {
    offSaleTime_ = _storage.getUInt(keccak256(abi.encodePacked(eventSchema, _eventId, "offSaleTime")));
  }

  function setOffSaleTime(IAventusStorage _storage, uint _eventId, uint _offSaleTime)
    external
  {
    uint currentTime =  LAventusTime.getCurrentTime(_storage);
    require(_offSaleTime >= currentTime, "Ticket off-sale time must be in the future");
    _storage.setUInt(keccak256(abi.encodePacked(eventSchema, _eventId, "offSaleTime")), _offSaleTime);
  }

  function setEventTime(IAventusStorage _storage, uint _eventId, uint _eventTime)
    external
  {
     assert(_eventTime >= LAventusTime.getCurrentTime(_storage));
    _storage.setUInt(keccak256(abi.encodePacked(eventSchema, _eventId, "eventTime")), _eventTime);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (address eventOwner_)
  {
    eventOwner_ = _storage.getAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "owner")));
  }

  function setEventOwner(IAventusStorage _storage, uint _eventId, address _eventOwner)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "owner")), _eventOwner);
  }
}