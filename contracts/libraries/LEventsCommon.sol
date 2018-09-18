pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAventusTime.sol';
import './LAVTManager.sol';
import './LAventities.sol';
import './LMembers.sol';

library LEventsCommon {
  bytes32 constant minimumEventReportingPeriodDaysKey = keccak256(abi.encodePacked("Events", "minimumEventReportingPeriodDays"));
  bytes32 constant minimumDepositAmountUSCentsKey = keccak256(abi.encodePacked("Events", "minimumDepositAmountUSCents"));
  bytes32 constant fixedDepositAmountUSCentsKey = keccak256(abi.encodePacked("Events", "fixedDepositAmountUSCents"));
  bytes32 constant eventCountKey = keccak256(abi.encodePacked("EventCount"));

  modifier onlyValidEvent(IAventusStorage _storage, uint _eventId) {
    require(
      eventValid(_storage, _eventId),
      "Event must be valid"
    );
    _;
  }

  function validateEventCreation(IAventusStorage _storage, string _eventDesc, string _eventSupportURL,
    uint _ticketSaleStartTime, uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents)
    external
  {
    bytes32 hashMsg = hashEventParameters(_eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
        _averageTicketPriceInUSCents);
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

  function checkOwnerOrRegisteredRole(IAventusStorage _storage, uint _eventId, address _address, string _role) external view {
    require(
      addressIsOwner(_storage, _eventId, _address) ||
      roleIsRegistered(_storage, _eventId, _role, _address),
      "Function must be called by owner or registered member only"
    );
  }

  /**
  * @notice Calculate the event deposit In USCents and in AVT
  * @param _averageTicketPriceInUSCents Average ticket price in US Cents
  * @return uint depositInUSCents_ Deposit in US cents
  * @return uint depositInAVTDecimals_ Deposit in AVT Decimals
  */
  function getNewEventDeposit(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    depositInUSCents_ = getDepositInUSCents(_storage, _averageTicketPriceInUSCents);
    depositInAVTDecimals_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents_);
  }

  function eventActive(IAventusStorage _storage, uint _eventId)
    public
    view
    onlyValidEvent(_storage, _eventId)
    returns (bool active_)
  {
    bool eventHasHappened = LAventusTime.getCurrentTime(_storage) >=  _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "eventTime")));
    bool eventIsCancelled = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "status"))) == 1;

    uint aventityId = getAventityIdFromEventId(_storage, _eventId);
    bool aventityIsNotFraudulent = LAventities.aventityIsNotFraudulent(_storage, aventityId);

    active_ = !eventHasHappened && !eventIsCancelled && aventityIsNotFraudulent;
  }

  function getAventityIdFromEventId(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "aventityId")));
  }

  function eventValid(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (bool isValid_)
  {
    isValid_ = _eventId != 0 && _eventId <= _storage.getUInt(eventCountKey);
  }

  /**
  * @dev Check if an address is registered as a valid Aventity member for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - role must be an aventity type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
  * @param _address - address to check
  * @return registered_ - returns true if the supplied delegate is registered
  */
  function roleIsRegistered(IAventusStorage _storage, uint _eventId, string _role, address _address)
    public
    view
    returns (bool registered_)
  {
    registered_ = _storage.getBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "address", _address))) &&
      LMembers.memberIsActive(_storage, _address, _role);
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

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) public view returns (uint eventDeposit_) {
    uint aventityId = getAventityIdFromEventId(_storage, _eventId);
    eventDeposit_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  function getEventCountKey() internal pure returns (bytes32 key_) {
    key_ = eventCountKey;
  }

  function hashEventParameters(string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime, uint _eventTime,
      uint _capacity, uint _averageTicketPriceInUSCents)
    internal
    pure
    returns (bytes32 hash_)
  {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    hash_ = keccak256(abi.encodePacked(keccak256(abi.encodePacked(_eventDesc)), keccak256(abi.encodePacked(_eventSupportURL)),
        _ticketSaleStartTime, _eventTime, _capacity, _averageTicketPriceInUSCents));
  }

  function checkEventOverCapacity(IAventusStorage _storage, uint _eventId) internal view  returns (uint ticketCount_) {
    uint capacity = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "capacity")));
    ticketCount_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketCount")));
    uint refundedTicketCount = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "refundedTicketCount")));
    ticketCount_ += 1;

    require(
      ticketCount_ - refundedTicketCount <= capacity,
      "Number of currently issued tickets must be below event capacity"
    );
  }

  function getDepositInUSCents(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    private
    view
    returns (uint depositInUSCents_)
  {
    // TODO: Use a more advanced formula, taking into consideration reporting period, fraudulence
    // rates, etc, instead of fixed values.
    depositInUSCents_ = _averageTicketPriceInUSCents == 0 ?
      _storage.getUInt(minimumDepositAmountUSCentsKey):
      _storage.getUInt(fixedDepositAmountUSCentsKey);
  }
}
