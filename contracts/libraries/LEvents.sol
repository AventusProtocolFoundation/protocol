pragma solidity ^0.4.19;

import '../interfaces/IAventusStorage.sol';
import './LApps.sol';
import './LLock.sol';
import "./LAventusTime.sol";

library LEvents {
  bytes32 constant minimumEventReportingPeriodDaysKey = keccak256("Events", "minimumEventReportingPeriodDays");
  bytes32 constant minimumDepositAmountUsCentsKey = keccak256("Events", "minimumDepositAmountUsCents");
  bytes32 constant fixedDepositAmountUsCentsKey = keccak256("Events", "fixedDepositAmountUsCents");
  bytes32 constant eventCountKey = keccak256("EventCount");

  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(addressIsOwner(_storage, _eventId, msg.sender));
    _;
  }

  modifier onlyEventOwnerOrDelegate(IAventusStorage _storage, uint _eventId, address _eventOwnerOrDelegate) {
    require(addressIsOwner(_storage, _eventId, _eventOwnerOrDelegate) ||
            addressIsDelegate(_storage, _eventId, _eventOwnerOrDelegate));
    _;
  }

  modifier isActiveEvent(IAventusStorage _storage, uint _eventId) {
    require(eventActive(_storage, _eventId));
    _;
  }

  modifier isValidEvent(IAventusStorage _storage, uint _eventId) {
    require(eventValid(_storage, _eventId));
    _;
  }

  function eventValid(IAventusStorage _storage, uint _eventId)
    view
    public
    returns (bool isValid)
  {
    isValid = _eventId != 0 && _eventId <= _storage.getUInt(eventCountKey);
  }

  function eventActive(IAventusStorage _storage, uint _eventId)
    isValidEvent(_storage, _eventId)
    view
    private
    returns (bool)
  {
    return(getCurrentTime(_storage) < getEventTime(_storage, _eventId) &&
           !isEventCancelled(_storage, _eventId) &&
           !isEventFraudulent(_storage, _eventId));
  }

  modifier isInactiveEvent(IAventusStorage _storage, uint _eventId) {
    require(!eventActive(_storage, _eventId));
    _;
  }

  modifier inReportingPeriod(IAventusStorage _storage, uint _eventId) {
    uint ticketSaleStart = _storage.getUInt(keccak256("Event", _eventId, "ticketSaleStartTime"));
    require(getCurrentTime(_storage) < ticketSaleStart);
    _;
  }

  modifier inTicketSalePeriod (IAventusStorage _storage, uint _eventId) {
    uint currentTime = getCurrentTime(_storage);
    require(currentTime < _storage.getUInt(keccak256("Event", _eventId, "eventTime")));
    require(currentTime >= _storage.getUInt(keccak256("Event", _eventId, "ticketSaleStartTime")));
    _;
  }

  modifier ticketSaleNotInProgress(IAventusStorage _storage, uint _eventId) {
    uint ticketCount = _storage.getUInt(keccak256("Event", _eventId, "TicketCount"));
    uint refundedTicketCount = _storage.getUInt(keccak256("Event", _eventId, "RefundedTicketCount"));
    require(ticketCount == refundedTicketCount);
    _;
  }

  modifier isNotCancelled(IAventusStorage _storage, uint _eventId) {
    require(!isEventCancelled(_storage, _eventId));
    _;
  }

  modifier isTicketRefundable(IAventusStorage _storage, uint _eventId, uint _ticketId) {
    require(eventActive(_storage, _eventId));
    require(!isTicketRefunded(_storage, _eventId, _ticketId));
    require(_ticketId != 0 && _ticketId <= _storage.getUInt(keccak256("Event", _eventId, "TicketCount")));
    _;
  }

  modifier addressIsWhitelisted(IAventusStorage _storage, address delegate) {
    require(LApps.appIsRegistered(_storage, delegate));
    _;
  }

  modifier isNotUnderChallenge(IAventusStorage  _storage, uint _eventId) {
    require(eventIsNotUnderChallenge(_storage, _eventId));
    _;
  }

  function eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) view public returns (bool notUnderChallenge) {
    require(eventValid(_storage, _eventId)); // This function is called outside the library, so it can't use a modifier.
    notUnderChallenge = 0 == _storage.getUInt(keccak256("Event", _eventId, "challenge"));
  }

  function addressIsOwner(IAventusStorage _storage, uint _eventId, address _owner) view private returns (bool) {
    return _owner == getEventOwner(_storage, _eventId);
  }

  function getSignerAndCheckNotMsgSender(bytes32 hash,  uint8 _v, bytes32 _r, bytes32 _s)
    private
    view
    returns (address _signer) {
    _signer = ecrecover(keccak256("\x19Ethereum Signed Message:\n32", hash), _v, _r, _s);
    require(msg.sender != _signer);
  }

  function createEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    public
    returns (uint eventId)
  {
    return doCreateEvent(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
      _eventSupportURL, msg.sender);
  }

  function signedCreateEvent(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, string _eventDesc,
    uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime,
    string _eventSupportURL, address _owner)
    addressIsWhitelisted(_storage, msg.sender)
    public
    returns (uint _eventId)
  {
    require(getSignerAndCheckNotMsgSender(
        hashEventParameters(
            _eventDesc, _eventTime,_capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
            _eventSupportURL, _owner),
        _v, _r, _s) == _owner
    );
    _eventId = doCreateEvent(
      _storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner
    );
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId)
    onlyEventOwner(_storage, _eventId)
    public
  {
    doCancelEvent(_storage, _eventId);
  }

  function signedCancelEvent(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId)
    addressIsWhitelisted(_storage, msg.sender)
    public
  {
    bytes32 hash = keccak256(_eventId);
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    require(signer == getEventOwner(_storage, _eventId));
    doCancelEvent(_storage, _eventId);
  }

  function unlockEventDeposit(IAventusStorage _storage, uint _eventId)
    public
  {
    doUnlockEventDeposit(_storage, _eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer)
    public
    returns (uint ticketId)
  {
    return doSellTicket(_storage, _eventId, _ticketDetails, _buyer, msg.sender);
  }

  function signedSellTicket(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId,
      string _ticketDetails, address _buyer)
    public
    addressIsWhitelisted(_storage, msg.sender)
    returns (uint ticketId)
  {
    bytes32 hash = keccak256(_eventId, _ticketDetails, _buyer);
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    return doSellTicket(_storage, _eventId, _ticketDetails, _buyer, signer);
  }

  function refundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    public
  {
    doRefundTicket(_storage, _eventId, _ticketId, msg.sender);
  }

  function signedRefundTicket(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId, uint _ticketId)
    public
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 hash = keccak256(_eventId, _ticketId);
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    doRefundTicket(_storage, _eventId, _ticketId, signer);
  }

  /**
  * @dev Refund sale of a ticket
  * @param _storage Storage contract
  * @param _eventId event id for the event in context
  * @param _ticketId ticket Id for the ticket to be refunded
  * @param _eventOwnerOrDelegate address requesting this refund - must be event owner or delegate
  */
  function doRefundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, address _eventOwnerOrDelegate)
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    isTicketRefundable(_storage, _eventId, _ticketId)
    private
  {
    bytes32 refundTicketKey = keccak256("Event", _eventId, "RefundedTicketCount");
    uint refundedTicketCount = _storage.getUInt(refundTicketKey);
    _storage.setUInt(refundTicketKey, refundedTicketCount + 1);
    setTicketStatusRefunded(_storage, _eventId, _ticketId);
    setTicketHashNotOwned(_storage, getTicketHashFromTicketId(_storage, _eventId, _ticketId));
  }

  /**
  * @dev Register a delegate for an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _delegate - delegate address
  */
  function registerDelegate(IAventusStorage _storage, uint _eventId, address _delegate)
    onlyEventOwner(_storage, _eventId)
    addressIsWhitelisted(_storage, _delegate)
    public
  {
    _storage.setBoolean(keccak256("Event", _eventId, "delegate", _delegate), true);
  }

  /**
  * @dev Deregister a delegate to an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _delegate - delegate of the event
  */
  function deregisterDelegate(IAventusStorage _storage, uint _eventId, address _delegate)
    onlyEventOwner(_storage, _eventId)
    public
  {
    if (addressIsDelegate(_storage, _eventId, _delegate))
      _storage.setBoolean(keccak256("Event", _eventId, "delegate", _delegate), false);
  }

  /**
  * @dev Check if an address is registered as a delegate for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _delegate - address to check
  * @return _registered - returns true if the supplied delegate is registered
  */
  function addressIsDelegate(IAventusStorage _storage, uint _eventId, address _delegate)
    public
    view
    returns (bool _registered)
  {
    _registered = _storage.getBoolean(keccak256("Event", _eventId, "delegate", _delegate)) &&
      LApps.appIsRegistered(_storage, _delegate);
  }

  /**
  * @dev Calculate the appropriate event deposit In USCents and in AVT
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @return uint depositInUSCents calculated deposit in US cents
  * @return uint depositInAVTDecimals calculated deposit in AVT Decimals
  */
  function getEventDeposit(IAventusStorage _storage, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    public
    view
    returns (uint depositInUSCents, uint depositInAVTDecimals)
  {
    depositInUSCents = getDepositInUSCents(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);
    depositInAVTDecimals = LLock.getAVTDecimals(_storage, depositInUSCents);
  }

  /**
  * @dev Create an event
  * @param _storage Storage contract
  * @param _eventDesc description or title of the event
  * @param _eventTime - the actual event time
  * @param _capacity - number of tickets (capacity) for the event
  * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
  * @param _ticketSaleStartTime - expected ticket sale start time
  * @param _eventSupportURL - verifiable official supporting url for the event
  * @param _owner - address of the event owner
  * @return uint eventId of newly created event
  */
  function doCreateEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    private
    returns (uint eventId)
  {
    validateEventCreation(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
      _eventSupportURL, _owner);

    eventId = _storage.getUInt(eventCountKey) + 1;

    uint depositInUSCents = 0;
    uint depositInAVTDecimals = 0;
    (depositInUSCents, depositInAVTDecimals) =
      getEventDeposit(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);

    bytes32 key = keccak256("ExpectedDeposits", _owner);
    _storage.setUInt(key, _storage.getUInt(key) + depositInAVTDecimals);
    require(_storage.getUInt(key) <= _storage.getUInt(keccak256("Lock", "deposit", _owner)));

    _storage.setUInt(eventCountKey, eventId);
    _storage.setAddress(keccak256("Event", eventId, "owner"), _owner);
    _storage.setString(keccak256("Event", eventId, "description"), _eventDesc);
    _storage.setUInt(keccak256("Event", eventId, "capacity"), _capacity);
    _storage.setUInt(keccak256("Event", eventId, "averageTicketPriceInUSCents"), _averageTicketPriceInUSCents);
    _storage.setUInt(keccak256("Event", eventId, "ticketSaleStartTime"), _ticketSaleStartTime);
    _storage.setString(keccak256("Event", eventId, "eventSupportURL"), _eventSupportURL);
    _storage.setUInt(keccak256("Event", eventId, "deposit"), depositInAVTDecimals);
    _storage.setUInt(keccak256("Event", eventId, "eventTime"), _eventTime);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    view
    public
    returns (address _eventOwner)
  {
    _eventOwner = _storage.getAddress(keccak256("Event", _eventId, "owner"));
  }

  function validateEventCreation(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    private
  {
    bytes32 hashMsg = hashEventParameters(_eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner);
    bytes32 hashMsgKey = keccak256("Event", "hashMessage", hashMsg);

    uint minimumEventReportingPeriod = (1 days) * _storage.getUInt(minimumEventReportingPeriodDaysKey);
    assert(minimumEventReportingPeriod > 0);
    require(_ticketSaleStartTime >= getCurrentTime(_storage) + minimumEventReportingPeriod);

    // TODO: Consider a minimum ticket sale period from ParameterRegistry.
    require(_ticketSaleStartTime < _eventTime);

    require(bytes(_eventSupportURL).length != 0);
    require(!_storage.getBoolean(hashMsgKey));

    _storage.setBoolean(hashMsgKey, true);
  }

  function hashEventParameters(string _eventDesc, uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents,
    uint _ticketSaleStartTime, string _eventSupportURL, address _owner)
    pure
    private
    returns (bytes32)
  {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    return keccak256(keccak256(_eventDesc), _eventTime, _capacity, _averageTicketPriceInUSCents,
        _ticketSaleStartTime,  keccak256(_eventSupportURL), _owner);
  }

  function doUnlockEventDeposit(IAventusStorage _storage, uint _eventId)
    isInactiveEvent(_storage, _eventId)
    private
  {
    address owner = getEventOwner(_storage, _eventId);
    bytes32 key = keccak256("ExpectedDeposits", owner);
    uint depositInAVT = getExistingEventDeposit(_storage, _eventId);
    require(depositInAVT != 0);
    assert(_storage.getUInt(key) >= depositInAVT);
    _storage.setUInt(key, _storage.getUInt(key) - depositInAVT);
    setEventDeposit(_storage, _eventId, 0);
  }

  function setEventDeposit(IAventusStorage _storage, uint _eventId, uint _deposit) private {
    _storage.setUInt(keccak256("Event", _eventId, "deposit"), _deposit);
  }

  /**
  * @dev Executes Cancellation of an existing event.
  * @param _storage Storage contract
  * @param _eventId - id of the event to cancel
  */
  function doCancelEvent(IAventusStorage _storage, uint _eventId)
    isActiveEvent(_storage, _eventId)
    isNotUnderChallenge(_storage, _eventId)
    ticketSaleNotInProgress(_storage, _eventId)
    private
  {
    setEventStatusCancelled(_storage, _eventId);
    doUnlockEventDeposit(_storage, _eventId);
  }

  /**
  * @dev Sell tickets for an active event.
  * @param _storage Storage contract
  * @param _eventId - event id for the event in context
  * @param _ticketDetails - ticket details
  * @param _buyer - address of the ticket buyer
  * @param _eventOwnerOrDelegate address requesting this sale - must be event owner or delegate
  *
  * TODO: Consider adding ticket price so we can stop selling tickets when the total capital has been reached.
  */
  function doSellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer, address _eventOwnerOrDelegate)
    onlyEventOwnerOrDelegate(_storage, _eventId, _eventOwnerOrDelegate)
    inTicketSalePeriod(_storage, _eventId)
    isActiveEvent(_storage, _eventId)
    private
    returns (uint ticketId)
  {
    // TODO: Convert to a modifier when variable stack depth allows.
    ticketId = checkEventOverCapacity(_storage, _eventId);

    bytes32 ticketHash = getTicketHashFromDetails(_eventId, _ticketDetails);
    setTicketHashOwned(_storage, ticketHash);

    _storage.setUInt(keccak256("Event", _eventId, "TicketCount"), ticketId);
    _storage.setString(keccak256("Event", _eventId, "Ticket", ticketId, "ticketDetails"), _ticketDetails);
    _storage.setBytes32(keccak256("Event", _eventId, "Ticket", ticketId, "ticketHash"), ticketHash);
    _storage.setAddress(keccak256("Event", _eventId, "Ticket", ticketId, "buyer"), _buyer);
  }

  function checkEventOverCapacity(IAventusStorage _storage, uint _eventId) view private returns (uint ticketCount) {
    uint capacity = _storage.getUInt(keccak256("Event", _eventId, "capacity"));
    ticketCount = _storage.getUInt(keccak256("Event", _eventId, "TicketCount"));
    uint refundedTicketCount = _storage.getUInt(keccak256("Event", _eventId, "RefundedTicketCount"));
    ticketCount += 1;

    require(ticketCount - refundedTicketCount <= capacity);
  }

  function getCurrentTime(IAventusStorage _storage) view private returns (uint) {
    return LAventusTime.getCurrentTime(_storage);
  }

  function getEventTime(IAventusStorage _storage, uint _eventId) view private returns (uint) {
    return _storage.getUInt(keccak256("Event", _eventId, "eventTime"));
  }

  function getTicketSaleStartTime(IAventusStorage _storage, uint _eventId) view private returns (uint) {
    return _storage.getUInt(keccak256("Event", _eventId, "ticketSaleStartTime"));
  }

  function getDepositInUSCents(IAventusStorage _storage, uint /*_capacity*/, uint _averageTicketPriceInUSCents, uint /*_ticketSaleStartTime*/)
    private
    view
    returns (uint depositInUSCents)
  {
    // TODO: Use a more advanced formula, taking into consideration reporting period, fraudulence
    // rates, etc, instead of fixed values.
    depositInUSCents = _averageTicketPriceInUSCents == 0 ?
      _storage.getUInt(minimumDepositAmountUsCentsKey):
      _storage.getUInt(fixedDepositAmountUsCentsKey);
  }

  /**
  * @dev Get the pre-calculated deposit for the specified event
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) public view returns (uint) {
    return _storage.getUInt(keccak256("Event", _eventId, "deposit"));
  }

  function setEventAsChallenged(IAventusStorage _s, uint _eventId, uint _challengeProposalId)
    public {
    _s.setUInt(keccak256("Event", _eventId, "challenge"), _challengeProposalId);
  }

  function setEventAsClearFromChallenge(IAventusStorage _s, uint _eventId)
    public {
    _s.setUInt(keccak256("Event", _eventId, "challenge"), 0);
  }

  function setEventStatusCancelled(IAventusStorage _storage, uint _eventId) private {
    _storage.setUInt(keccak256("Event", _eventId, "status"), 1);
  }

  function isEventCancelled(IAventusStorage _storage, uint _eventId) view private returns (bool) {
    return _storage.getUInt(keccak256("Event", _eventId, "status")) == 1;
  }

  function setEventStatusFraudulent(IAventusStorage _storage, uint _eventId) public {
    _storage.setUInt(keccak256("Event", _eventId, "status"), 2);
    // Event is no longer valid; remove the expected deposit for the event owner.
    doUnlockEventDeposit(_storage, _eventId);
    // TODO: Add fraudulent counter, will be required for event deposit calculation
  }

  function isEventFraudulent(IAventusStorage _storage, uint _eventId) view private returns (bool) {
    return _storage.getUInt(keccak256("Event", _eventId, "status")) == 2;
  }

  function setTicketStatusRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) private {
    _storage.setUInt(keccak256("Event", _eventId, "Ticket", _ticketId, "status"), 1);
  }

  function isTicketRefunded(IAventusStorage _storage, uint _eventId, uint _ticketId) view private returns (bool) {
    return _storage.getUInt(keccak256("Event", _eventId, "Ticket", _ticketId, "status")) == 1;
  }

  function getTicketHashFromDetails(uint _eventId, string _ticketDetails) pure private returns (bytes32 hash) {
    hash = keccak256("Event", _eventId, "Ticket", _ticketDetails);
  }

  function getTicketHashFromTicketId(IAventusStorage _storage, uint _eventId, uint _ticketId) view private returns (bytes32 hash) {
    hash = _storage.getBytes32(keccak256("Event", _eventId, "Ticket", _ticketId, "ticketHash"));
  }

  function setTicketHashNotOwned(IAventusStorage _storage, bytes32 _hash) private {
    require(ticketHashIsOwned(_storage, _hash));
    _storage.setBoolean(_hash, false);
  }

  function setTicketHashOwned(IAventusStorage _storage, bytes32 _hash) private {
    require(!ticketHashIsOwned(_storage, _hash));
    _storage.setBoolean(_hash, true);
  }

  function ticketHashIsOwned(IAventusStorage _storage, bytes32 _hash) view private returns (bool) {
    return _storage.getBoolean(_hash);
  }
}