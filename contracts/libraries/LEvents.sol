pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LApps.sol';
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsEnact.sol";

library LEvents {
  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.addressIsOwner(_storage, _eventId, msg.sender),
      "Function must be called by owner"
    );
    _;
  }

  modifier inReportingPeriod(IAventusStorage _storage, uint _eventId) {
    uint ticketSaleStart = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketSaleStartTime")));
    require(
      LAventusTime.getCurrentTime(_storage) < ticketSaleStart,
      "Current date must be in reporting period"
    );
    _;
  }

  modifier addressIsWhitelisted(IAventusStorage _storage, address delegate) {
    require(
      LApps.appIsRegistered(_storage, delegate),
      "App must have been registered as a delegate"
    );

    _;
  }

  modifier isNotUnderChallenge(IAventusStorage  _storage, uint _eventId) {
    require(
      eventIsNotUnderChallenge(_storage, _eventId),
      "Event must not be under challenge"
    );

    _;
  }

  function eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) view public returns (bool notUnderChallenge) {
    return LEventsCommon.eventIsNotUnderChallenge(_storage, _eventId);
  }

  function getSignerAndCheckNotMsgSender(bytes32 hash,  uint8 _v, bytes32 _r, bytes32 _s)
    private
    view
    returns (address _signer) {
    _signer = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)), _v, _r, _s);
    require(
      msg.sender != _signer,
      "Sender must not be the message signer"
    );

  }

  function createEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    public
    returns (uint eventId)
  {
    return LEventsEnact.doCreateEvent(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
      _eventSupportURL, msg.sender);
  }

  function signedCreateEvent(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, string _eventDesc,
    uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime,
    string _eventSupportURL, address _owner)
    addressIsWhitelisted(_storage, msg.sender)
    public
    returns (uint _eventId)
  {
    require(
      getSignerAndCheckNotMsgSender(
        LEventsCommon.hashEventParameters(
            _eventDesc, _eventTime,_capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
            _eventSupportURL, _owner),
        _v, _r, _s) == _owner,
      "Sender cannot equal the event owner. Use createEvent instead"
    );
    _eventId = LEventsEnact.doCreateEvent(
      _storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner
    );
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId)
    onlyEventOwner(_storage, _eventId)
    public
  {
    LEventsEnact.doCancelEvent(_storage, _eventId);
  }

  function signedCancelEvent(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId)
    addressIsWhitelisted(_storage, msg.sender)
    public
  {
    bytes32 hash = keccak256(abi.encodePacked(_eventId));
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    require(
      signer == getEventOwner(_storage, _eventId),
      "Only the owner can sign a message to cancel an event"
    );
    LEventsEnact.doCancelEvent(_storage, _eventId);
  }

  function unlockEventDeposit(IAventusStorage _storage, uint _eventId)
    public
  {
    LEventsEnact.doUnlockEventDeposit(_storage, _eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer)
    public
    returns (uint ticketId)
  {
    return LEventsEnact.doSellTicket(_storage, _eventId, _ticketDetails, _buyer, msg.sender);
  }

  function signedSellTicket(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId,
      string _ticketDetails, address _buyer)
    public
    addressIsWhitelisted(_storage, msg.sender)
    returns (uint ticketId)
  {
    bytes32 hash = keccak256(abi.encodePacked(_eventId, _ticketDetails, _buyer));
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    return LEventsEnact.doSellTicket(_storage, _eventId, _ticketDetails, _buyer, signer);
  }

  function refundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    public
  {
    LEventsEnact.doRefundTicket(_storage, _eventId, _ticketId, msg.sender);
  }

  function signedRefundTicket(IAventusStorage _storage, uint8 _v, bytes32 _r, bytes32 _s, uint _eventId, uint _ticketId)
    public
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 hash = keccak256(abi.encodePacked(_eventId, _ticketId));
    address signer = getSignerAndCheckNotMsgSender(hash, _v, _r, _s);
    LEventsEnact.doRefundTicket(_storage, _eventId, _ticketId, signer);
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
    _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "delegate", _delegate)), true);
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
      _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "delegate", _delegate)), false);
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
    return LEventsCommon.addressIsDelegate(_storage, _eventId, _delegate);
  }

  function getEventDeposit(IAventusStorage _storage, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    public
    view
    returns (uint depositInUSCents, uint depositInAVTDecimals)
  {
    return LEventsCommon.getEventDeposit(_storage, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    view
    public
    returns (address _eventOwner)
  {
    return LEventsCommon.getEventOwner(_storage, _eventId);
  }

  function getTicketSaleStartTime(IAventusStorage _storage, uint _eventId) view private returns (uint) {
    return _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "ticketSaleStartTime")));
  }

  /**
  * @dev Get the pre-calculated deposit for the specified event
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) public view returns (uint) {
    return LEventsCommon.getExistingEventDeposit(_storage, _eventId);
  }

  function setEventAsChallenged(IAventusStorage _s, uint _eventId, uint _challengeProposalId)
    public {
    _s.setUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")), _challengeProposalId);
  }

  function setEventAsClearFromChallenge(IAventusStorage _s, uint _eventId)
    public {
    _s.setUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")), 0);
  }

  function setEventStatusFraudulent(IAventusStorage _storage, uint _eventId) public {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "status")), 2);
    // Event is no longer valid; remove the expected deposit for the event owner.
    LEventsEnact.doUnlockEventDeposit(_storage, _eventId);
    // TODO: Add fraudulent counter, will be required for event deposit calculation
  }

  function getTicketHashFromDetails(uint _eventId, string _ticketDetails) pure private returns (bytes32 hash) {
    hash = keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketDetails));
  }

}
