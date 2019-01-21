pragma solidity ^0.5.2;

import "./LMembers.sol";
import "./LEventsStorage.sol";
import "./zeppelin/LECRecovery.sol";

library LEventsEvents {
  function createEvent(IAventusStorage _storage, string calldata _eventDesc, uint _eventTime, uint _offSaleTime,
      bytes calldata _createEventEventOwnerProof)
    external
    returns (address eventOwner_, uint eventId_)
  {
    require(_eventTime == 0 || _eventTime > _offSaleTime, "Event time must be after off-sale time");
    require(bytes(_eventDesc).length > 0, "Event requires a non-empty description");

    bytes32 descHash = keccak256(abi.encodePacked(_eventDesc));
    bytes32 eventHash;
    if(_eventTime == 0) { // Old style
      eventHash = keccak256(abi.encodePacked(descHash, _offSaleTime));
    } else { // New style
      eventHash = keccak256(abi.encodePacked(descHash, _eventTime, _offSaleTime));
    }
    eventOwner_ = LECRecovery.recover(eventHash, _createEventEventOwnerProof);

    if (msg.sender != eventOwner_) {
      LMembers.checkValidatorActiveAndRecordInteraction(_storage);
    }

    eventId_ = LEventsStorage.getEventCount(_storage) + 1;

    LEventsStorage.setEventCount(_storage, eventId_);
    LEventsStorage.setEventOwner(_storage, eventId_, eventOwner_);
    LEventsStorage.setOffSaleTime(_storage, eventId_, _offSaleTime);
  }
}
