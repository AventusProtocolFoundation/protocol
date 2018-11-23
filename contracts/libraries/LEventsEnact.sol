pragma solidity ^0.4.24;

import "./LEventsCommon.sol";
import "./LAventities.sol";

library LEventsEnact {

  modifier onlyWithValidCancellationProof(IAventusStorage _storage, uint _eventId, bytes _cancelEventEventOwnerProof) {
    bytes32 cancellationHash = keccak256(abi.encodePacked(_eventId));
    address signer = LEventsCommon.getSignerFromProof(cancellationHash, _cancelEventEventOwnerProof);
    require(signer == LEventsStorage.getEventOwner(_storage, _eventId), "Proof must be valid and signed by event owner");
    _;
  }

  modifier onlyActiveBrokerOnEvent(IAventusStorage _storage, uint _eventId) {
    bool isActiveBroker = LEventsCommon.isActiveBrokerOnEvent(_storage, _eventId, msg.sender);
    require(isActiveBroker, "Sender must be registered broker on this event");
    _;
  }

  function createEvent(IAventusStorage _storage, uint _onSaleTime, uint _offSaleTime, uint _averageTicketPriceInUSCents,
      bytes _createEventEventOwnerProof, bytes32 _eventHash)
    external
    returns (address eventOwner_, uint eventId_, uint depositInAVTDecimals_)
  {
    eventOwner_ = LEventsCommon.getSignerFromProof(_eventHash, _createEventEventOwnerProof);
    (eventId_, depositInAVTDecimals_) = doCreateEvent(_storage, _onSaleTime, _offSaleTime, _averageTicketPriceInUSCents,
        eventOwner_, _eventHash);
    LEventsCommon.recordProtocolInteractions(_storage, eventOwner_, "EventOwner");
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId, bytes _cancelEventEventOwnerProof)
    external
    onlyActiveBrokerOnEvent(_storage, _eventId)
    onlyWithValidCancellationProof(_storage, _eventId, _cancelEventEventOwnerProof)
  {
    deregisterEvent(_storage, _eventId);
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    LEventsCommon.recordProtocolInteractions(_storage, eventOwner, "EventOwner");
  }

  function endEvent(IAventusStorage _storage, uint _eventId)
    external
  {
    deregisterEvent(_storage, _eventId);
  }

  function doCreateEvent(IAventusStorage _storage, uint _onSaleTime, uint _offSaleTime, uint _averageTicketPriceInUSCents,
      address _eventOwner, bytes32 _eventHash)
    private
    returns (uint eventId_, uint depositInAVTDecimals_)
  {
    if (_eventOwner != msg.sender) {
      require(LEventsCommon.isActiveBrokerOnProtocol(_storage, msg.sender), "Sender must be broker");
    }

    eventId_ = LEventsStorage.getEventCount(_storage) + 1;
    LEventsStorage.setEventCount(_storage, eventId_);

    uint depositInUSCents;
    (depositInUSCents, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);

    uint aventityId = LAventities.registerAventity(_storage, _eventOwner, depositInAVTDecimals_);

    LEventsStorage.setEventHashExists(_storage, _eventHash);
    LEventsStorage.setEventHash(_storage, eventId_, _eventHash);
    LEventsStorage.setAventityId(_storage, eventId_, aventityId);
    LEventsStorage.setEventOwner(_storage, eventId_, _eventOwner);
    LEventsStorage.setOnSaleTime(_storage, eventId_, _onSaleTime);
    LEventsStorage.setOffSaleTime(_storage, eventId_, _offSaleTime);
  }

  function deregisterEvent(IAventusStorage _storage, uint _eventId)
    private
  {
    uint aventityId = LEventsStorage.getAventityId(_storage, _eventId);
    LAventities.deregisterAventity(_storage, aventityId);
    bytes32 eventHash = LEventsStorage.getEventHash(_storage, _eventId);
    LEventsStorage.clearEventHashExists(_storage, eventHash);
  }
}