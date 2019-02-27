pragma solidity ^0.5.2;

import "./LMembers.sol";
import "./LEventsStorage.sol";
import "./zeppelin/LECRecovery.sol";
import "./LAventusTime.sol";
import "./LEventsRoles.sol";

library LEventsEvents {

  modifier onlyValidatorOnEventOrEventOwner(IAventusStorage _storage, uint _eventId) {
    LEventsRoles.mustBeValidatorOnEventOrEventOwner(_storage, _eventId, msg.sender);
    _;
  }

  function createEvent(IAventusStorage _storage, string calldata _eventDesc, uint _eventTime, uint _offSaleTime,
      bytes calldata _createEventEventOwnerProof, address _eventOwner)
    external
    returns (uint eventId_, bool registerValidatorOnEvent_)
  {
    require(_eventTime > _offSaleTime, "Event time must be after off-sale time");
    require(bytes(_eventDesc).length > 0, "Event requires a non-empty description");

    bytes32 descHash = keccak256(abi.encodePacked(_eventDesc));
    bytes32 eventHash = keccak256(abi.encodePacked(descHash, _eventTime, _offSaleTime, msg.sender));
    address signer = LECRecovery.recover(eventHash, _createEventEventOwnerProof);
    require(signer == _eventOwner, "Creation proof must be valid and signed by event owner");

    eventId_ = LEventsStorage.getEventCount(_storage) + 1;
    registerValidatorOnEvent_ = msg.sender != _eventOwner;

    if (registerValidatorOnEvent_) {
      LMembers.checkValidatorActive(_storage);
      LEventsStorage.setRoleOnEvent(_storage, eventId_, msg.sender, "Validator");
    }

    LEventsStorage.setEventCount(_storage, eventId_);
    LEventsStorage.setEventOwner(_storage, eventId_, _eventOwner);
    LEventsStorage.setOffSaleTime(_storage, eventId_, _offSaleTime);
    LEventsStorage.setEventTime(_storage, eventId_, _eventTime);
  }

  function takeEventOffSale(IAventusStorage _storage, uint _eventId, bytes calldata _eventOwnerProof)
    external
    onlyValidatorOnEventOrEventOwner(_storage, _eventId)
  {
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    address signer = LECRecovery.recover(keccak256(abi.encodePacked(_eventId)), _eventOwnerProof);
    require(eventOwner == signer, "Offsale proof must be valid and signed by event owner");

    if (msg.sender != eventOwner) {
      LMembers.checkValidatorActive(_storage);
    }

    uint currentTime = LAventusTime.getCurrentTime(_storage);
    LEventsStorage.setOffSaleTime(_storage, _eventId, currentTime);
  }
}
