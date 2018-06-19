pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LLock.sol';
import './LApps.sol';

library LEventsCommon {
  bytes32 constant minimumDepositAmountUsCentsKey = keccak256(abi.encodePacked("Events", "minimumDepositAmountUsCents"));
  bytes32 constant fixedDepositAmountUsCentsKey = keccak256(abi.encodePacked("Events", "fixedDepositAmountUsCents"));
  bytes32 constant eventCountKey = keccak256(abi.encodePacked("EventCount"));

  function eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) external view returns (bool notUnderChallenge_) {
    // This function is called outside the library, so it can't use a modifier.
    require(eventValid(_storage, _eventId), "Event must be valid");
    notUnderChallenge_ = 0 == _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")));
  }

  function eventValid(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (bool isValid_)
  {
    isValid_ = _eventId != 0 && _eventId <= _storage.getUInt(eventCountKey);
  }

  /**
  * @dev Calculate the appropriate event deposit In USCents and in AVT
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @return uint depositInUSCents_ calculated deposit in US cents
  * @return uint depositInAVTDecimals_ calculated deposit in AVT Decimals
  */
  function getEventDeposit(IAventusStorage _storage, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    depositInUSCents_ = getDepositInUSCents(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);
    depositInAVTDecimals_ = LLock.getAVTDecimals(_storage, depositInUSCents_);
  }

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) internal view returns (uint eventDeposit_) {
    eventDeposit_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "deposit")));
  }

  /**
  * @dev Check if an address is registered as a delegate for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _delegate - address to check
  * @return registered_ - returns true if the supplied delegate is registered
  */
  function addressIsDelegate(IAventusStorage _storage, uint _eventId, address _delegate)
    internal
    view
    returns (bool registered_)
  {
    registered_ = _storage.getBoolean(keccak256(abi.encodePacked("Event", _eventId, "delegate", _delegate))) &&
      LApps.appIsRegistered(_storage, _delegate);
  }

  function addressIsOwner(IAventusStorage _storage, uint _eventId, address _owner) internal view returns (bool isOwner_) {
    isOwner_ = _owner == getEventOwner(_storage, _eventId);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    internal
    view
    returns (address eventOwner_)
  {
    eventOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "owner")));
  }

  function getEventCountKey() internal pure returns (bytes32 key_) {
    key_ = eventCountKey;
  }

  function hashEventParameters(string _eventDesc, uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents,
    uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    internal
    pure
    returns (bytes32 hash_)
  {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    hash_ = keccak256(abi.encodePacked(keccak256(abi.encodePacked(_eventDesc)), _eventTime, _capacity, _averageTicketPriceInUSCents,
        _ticketSaleStartTime,  keccak256(abi.encodePacked(_eventSupportURL)), _owner));
  }

  function getDepositInUSCents(IAventusStorage _storage, uint /*_capacity*/, uint _averageTicketPriceInUSCents, uint /*_ticketSaleStartTime*/)
    private
    view
    returns (uint depositInUSCents_)
  {
    // TODO: Use a more advanced formula, taking into consideration reporting period, fraudulence
    // rates, etc, instead of fixed values.
    depositInUSCents_ = _averageTicketPriceInUSCents == 0 ?
      _storage.getUInt(minimumDepositAmountUsCentsKey):
      _storage.getUInt(fixedDepositAmountUsCentsKey);
  }
}
