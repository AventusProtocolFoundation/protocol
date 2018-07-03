pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import "./LAventusTime.sol";
import './LLock.sol';
import './LApps.sol';

library LEventsCommon {
  bytes32 constant minimumEventReportingPeriodDaysKey = keccak256(abi.encodePacked("Events", "minimumEventReportingPeriodDays"));
  bytes32 constant minimumDepositAmountUsCentsKey = keccak256(abi.encodePacked("Events", "minimumDepositAmountUsCents"));
  bytes32 constant fixedDepositAmountUsCentsKey = keccak256(abi.encodePacked("Events", "fixedDepositAmountUsCents"));
  bytes32 constant eventCountKey = keccak256(abi.encodePacked("EventCount"));

  function eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) external view returns (bool notUnderChallenge_) {
    // This function is called outside the library, so it can't use a modifier.
    require(eventValid(_storage, _eventId), "Event must be valid");
    notUnderChallenge_ = 0 == _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")));
  }

  function validateEventCreation(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    external
  {
    bytes32 hashMsg = hashEventParameters(_eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner);
    bytes32 hashMsgKey = keccak256(abi.encodePacked("Event", "hashMessage", hashMsg));

    uint minimumEventReportingPeriod = (1 days) * _storage.getUInt(minimumEventReportingPeriodDaysKey);
    assert(minimumEventReportingPeriod > 0);
    require(
      _ticketSaleStartTime >= LAventusTime.getCurrentTime(_storage) + minimumEventReportingPeriod,
      "Event cannot be created because there is not enough of a reporting period before its date"
    );

    // TODO: Consider a minimum ticket sale period from ParameterRegistry.
    require(
      _ticketSaleStartTime < _eventTime,
      "Tickets sale period must start before event"
    );
    require(
      bytes(_eventSupportURL).length != 0,
      "Event creation requires a non-empty URL"
    );
    require(
      !_storage.getBoolean(hashMsgKey),
      "There is already an existing event with these data"
    );

    _storage.setBoolean(hashMsgKey, true);
  }

  function eventValid(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (bool isValid_)
  {
    isValid_ = _eventId != 0 && _eventId <= _storage.getUInt(eventCountKey);
  }

  function checkOwnerOrDelegateByRole(IAventusStorage _storage, uint _eventId, address _eventOwnerOrDelegate, string _role) external view {
    require(
      addressIsOwner(_storage, _eventId, _eventOwnerOrDelegate) ||
      addressIsDelegate(_storage, _eventId, _role, _eventOwnerOrDelegate),
      "Function must be called by owner or delegate only"
    );
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

  /**
  * @dev Check if an address is registered as a delegate for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - "primary" or "secondary" delegate role
  * @param _delegate - address to check
  * @return registered_ - returns true if the supplied delegate is registered
  */
  function addressIsDelegate(IAventusStorage _storage, uint _eventId, string _role, address _delegate)
    public
    view
    returns (bool registered_)
  {
    registered_ = _storage.getBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "delegate", _delegate))) &&
      LApps.appIsRegistered(_storage, _delegate);
  }

  function addressIsOwner(IAventusStorage _storage, uint _eventId, address _owner) public view returns (bool isOwner_) {
    isOwner_ = _owner == getEventOwner(_storage, _eventId);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (address eventOwner_)
  {
    eventOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "owner")));
  }

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) internal view returns (uint eventDeposit_) {
    eventDeposit_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "deposit")));
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

  function checkEventOverCapacity(IAventusStorage _storage, uint _eventId) internal view  returns (uint ticketCount_) {
    uint capacity = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "capacity")));
    ticketCount_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "TicketCount")));
    uint refundedTicketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "RefundedTicketCount")));
    ticketCount_ += 1;

    require(
      ticketCount_ - refundedTicketCount <= capacity,
      "Number of currently issued tickets must be below event capacity"
    );
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
