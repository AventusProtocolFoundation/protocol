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

  function setEventCount(IAventusStorage _storage, uint _eventCount) external {
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

  function setTicketOwner(IAventusStorage _storage, uint _eventId, uint _ticketId, address _ticketOwner) external {
    _storage.setAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "Ticket", _ticketId, "ticketOwner")), _ticketOwner);
  }

  function getOffSaleTime(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint offSaleTime_)
  {
    offSaleTime_ = _storage.getUInt(keccak256(abi.encodePacked(eventSchema, _eventId, "offSaleTime")));
  }

  function setOffSaleTime(IAventusStorage _storage, uint _eventId, uint _offSaleTime) external {
    uint currentTime =  LAventusTime.getCurrentTime(_storage);
    require(_offSaleTime > currentTime, "Ticket off-sale time must be in the future");
    _storage.setUInt(keccak256(abi.encodePacked(eventSchema, _eventId, "offSaleTime")), _offSaleTime);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (address eventOwner_)
  {
    eventOwner_ = _storage.getAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "owner")));
  }

  function setEventOwner(IAventusStorage _storage, uint _eventId, address _eventOwner) external {
    _storage.setAddress(keccak256(abi.encodePacked(eventSchema, _eventId, "owner")), _eventOwner);
  }

  function setTemporaryLeafHashAndOwner(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      bytes32 _leafHash, address _ticketOwner)
    external
  {
    _storage.setBytes32(getLeafHashKey(_eventId, _vendorTicketRefHash), _leafHash);
    _storage.setAddress(getLeafHashOwnerKey(_leafHash), _ticketOwner);
  }

  function clearTemporaryLeafHashAndOwner(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash)
    external
  {
    bytes32 leafHash = getLeafHash(_storage, _eventId, _vendorTicketRefHash);
    _storage.setAddress(getLeafHashOwnerKey(leafHash), address(0));
    _storage.setBytes32(getLeafHashKey(_eventId, _vendorTicketRefHash), 0);
  }

  function getLeafHashOwner(IAventusStorage _storage, bytes32 _leafHash)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(getLeafHashOwnerKey(_leafHash));
  }

  function getLeafHash(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash)
    public
    view
    returns (bytes32 leafHash_)
  {
    leafHash_ = _storage.getBytes32(getLeafHashKey(_eventId, _vendorTicketRefHash));
  }

  function getLeafHashKey(uint _eventId, bytes32 _vendorTicketRefHash)
    private
    pure
    returns (bytes32 key_)
  {
    key_ = keccak256(abi.encodePacked(eventSchema, _eventId, "vendorTicketRefHash", _vendorTicketRefHash, "leafHash"));
  }

  function getLeafHashOwnerKey(bytes32 _leafHash)
    private
    pure
    returns (bytes32 key_)
  {
    key_ = keccak256(abi.encodePacked(eventsSchema, "leafHash", _leafHash, "ticketOwner"));
  }
}