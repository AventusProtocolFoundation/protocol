pragma solidity ^0.4.24;

import "./LEventsCommon.sol";
import "./LAventities.sol";

library LEventsEnact {

  modifier onlyWithValidOwnerProof(IAventusStorage _storage, uint _eventId, bytes _ownerProof) {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId));
    address signer = LEventsCommon.getSignerFromProof(msgHash, _ownerProof);
    require(signer == LEventsStorage.getEventOwner(_storage, _eventId), "Signer must be event owner");
    _;
  }

  modifier onlyActiveBrokerOnEvent(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.isActiveBrokerOnEvent(_storage, msg.sender, _eventId), "Sender must be registered broker on this event");
    _;
  }

  function challengeEvent(IAventusStorage _storage, uint _eventId)
    external
    returns (uint proposalId_)
  {
    uint aventityId = LEventsStorage.getAventityId(_storage, _eventId);
    proposalId_ = LAventities.challengeAventity(_storage, aventityId);
  }

  function createEvent(IAventusStorage _storage, string _eventSupportURL, uint _onSaleTime,
      uint _offSaleTime, uint _averageTicketPriceInUSCents, bytes _ownerProof, bytes32 _eventHash)
    external
    returns (uint eventId_, uint depositInAVTDecimals_)
  {
    address eventOwner = LEventsCommon.getSignerFromProof(_eventHash, _ownerProof);
    (eventId_, depositInAVTDecimals_) = doCreateEvent(_storage, _eventSupportURL, _onSaleTime, _offSaleTime,
      _averageTicketPriceInUSCents, eventOwner, _eventHash);
  }

  function endEventChallenge(IAventusStorage _storage, uint _eventId)
    external
    returns (uint proposalId_, uint votesFor_, uint votesAgainst_)
  {
    uint aventityId = LEventsStorage.getAventityId(_storage, _eventId);
    bool challengeWon;
    (proposalId_, votesFor_, votesAgainst_, challengeWon) = LAventities.endAventityChallenge(_storage, aventityId);

    if (challengeWon) {
      clearEventHash(_storage, _eventId);
    }
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId, bytes _ownerProof)
    external
    onlyActiveBrokerOnEvent(_storage, _eventId)
    onlyWithValidOwnerProof(_storage, _eventId, _ownerProof)
  {
    deregisterEvent(_storage, _eventId);
  }

  function endEvent(IAventusStorage _storage, uint _eventId)
    external
  {
    deregisterEvent(_storage, _eventId);
  }

  function doCreateEvent(IAventusStorage _storage, string _eventSupportURL, uint _onSaleTime,
      uint _offSaleTime, uint _averageTicketPriceInUSCents, address _eventOwner, bytes32 _eventHash)
    private
    returns (uint eventId_, uint depositInAVTDecimals_)
  {
    if (_eventOwner != msg.sender) require(LEventsCommon.isActiveBrokerOnProtocol(_storage, msg.sender),
        "sender must be broker");

    LEventsCommon.validateEventCreation(_storage, _eventSupportURL, _onSaleTime, _offSaleTime);

    eventId_ = LEventsStorage.getEventCount(_storage) + 1;
    LEventsStorage.setEventCount(_storage, eventId_);

    uint depositInUSCents;
    (depositInUSCents, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);

    uint aventityId = LAventities.registerAventity(_storage, _eventOwner, depositInAVTDecimals_);

    LEventsStorage.setEventHashExists(_storage, _eventHash, true);
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
    clearEventHash(_storage, _eventId);
  }

  function clearEventHash(IAventusStorage _storage, uint _eventId) private {
    bytes32 eventHash = LEventsStorage.getEventHash(_storage, _eventId);
    LEventsStorage.setEventHashExists(_storage, eventHash, false);
  }
}