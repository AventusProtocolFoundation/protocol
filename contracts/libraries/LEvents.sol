pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LApps.sol';
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsEnact.sol";
import "./zeppelin/LECRecovery.sol";

library LEvents {

  /// See IEventsManager interface for events description
  event LogEventCreated(uint indexed eventId, string eventDesc, uint ticketSaleStartTime, uint eventTime, uint averageTicketPriceInUSCents);
  event LogSignedEventCreated(uint indexed eventId, string eventDesc, uint ticketSaleStartTime, uint eventTime, uint averageTicketPriceInUSCents);
  event LogEventCancellation(uint indexed eventId);
  event LogSignedEventCancellation(uint indexed eventId);
  event LogUnlockEventDeposit(uint indexed eventId);
  event LogTicketSale(uint indexed eventId, uint indexed ticketId, address indexed buyer);
  event LogSignedTicketSale(uint indexed eventId, uint indexed ticketId, address indexed buyer);
  event LogTicketRefund(uint indexed eventId, uint indexed ticketId);
  event LogSignedTicketRefund(uint indexed eventId, uint indexed ticketId);
  event LogTicketResale(uint indexed eventId, uint indexed ticketId, address indexed newBuyer);
  event LogSignedTicketResale(uint indexed eventId, uint indexed ticketId, address indexed newBuyer);
  event LogRegisterDelegate(uint indexed eventId, string role, address indexed delegate);
  event LogDeregisterDelegate(uint indexed eventId, string role, address indexed delegate);

  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.addressIsOwner(_storage, _eventId, msg.sender),
      "Function must be called by owner"
    );
    _;
  }

  modifier addressIsWhitelisted(IAventusStorage _storage, address _delegate) {
    require(
      LApps.appIsRegistered(_storage, _delegate),
      "App must have been registered as a delegate"
    );
    _;
  }

  modifier validDelegateRole(IAventusStorage _storage, string _role) {
    require(
      keccak256(abi.encodePacked(_role)) == keccak256("primary") ||
      keccak256(abi.encodePacked(_role)) == keccak256("secondary"),
      "Delegate role must be primary or secondary"
    );
    _;
  }

  function createEvent(IAventusStorage _storage, string _eventDesc, uint _eventTime, uint _capacity,
    uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime, string _eventSupportURL)
    external
    returns (uint eventId_)
  {
    eventId_ = LEventsEnact.doCreateEvent(_storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
      _eventSupportURL, msg.sender);

    emit LogEventCreated(eventId_, _eventDesc, _ticketSaleStartTime, _eventTime, _averageTicketPriceInUSCents);
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyEventOwner(_storage, _eventId)
  {
    LEventsEnact.doCancelEvent(_storage, _eventId);
    emit LogEventCancellation(_eventId);
  }

  function signedCancelEvent(IAventusStorage _storage, bytes _signedMessage, uint _eventId)
    external
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId));
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address signer = LECRecovery.recover(msgHash, _signedMessage);
    checkNotMsgSender(signer);
    require(
      signer == getEventOwner(_storage, _eventId),
      "Only the owner can sign a message to cancel an event"
    );
    LEventsEnact.doCancelEvent(_storage, _eventId);
    emit LogSignedEventCancellation(_eventId);
  }

  function unlockEventDeposit(IAventusStorage _storage, uint _eventId)
    external
  {
    LEventsEnact.doUnlockEventDeposit(_storage, _eventId);
    emit LogUnlockEventDeposit(_eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, string _ticketDetails, address _buyer)
    external
  {
    uint ticketId = LEventsEnact.doSellTicket(_storage, _eventId, _ticketDetails, _buyer, msg.sender);
    emit LogTicketSale(_eventId, ticketId, _buyer);
  }

  function signedSellTicket(IAventusStorage _storage, bytes _signedMessage, uint _eventId,
      string _ticketDetails, address _buyer)
    external
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketDetails, _buyer));
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address signer = LECRecovery.recover(msgHash, _signedMessage);
    checkNotMsgSender(signer);

    uint ticketId = LEventsEnact.doSellTicket(_storage, _eventId, _ticketDetails, _buyer, signer);
    emit LogSignedTicketSale(_eventId, ticketId, _buyer);
  }

  function refundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    external
  {
    LEventsEnact.doRefundTicket(_storage, _eventId, _ticketId, msg.sender);
    emit LogTicketRefund(_eventId, _ticketId);
  }

  function signedRefundTicket(IAventusStorage _storage, bytes _signedMessage, uint _eventId, uint _ticketId)
    external
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId));
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address signer = LECRecovery.recover(msgHash, _signedMessage);
    checkNotMsgSender(signer);

    LEventsEnact.doRefundTicket(_storage, _eventId, _ticketId, signer);
    emit LogSignedTicketRefund(_eventId, _ticketId);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ownerPermission, address _newBuyer)
  external
  {
    ownerPermissionCheck(_storage, _eventId, _ticketId, _ownerPermission);
    LEventsEnact.doResellTicket(_storage, _eventId, _ticketId, _newBuyer, msg.sender);
    emit LogTicketResale(_eventId, _ticketId, _newBuyer);
  }

  function signedResellTicket(IAventusStorage _storage, bytes _signedMessage, uint _eventId,
    uint _ticketId, bytes _ownerPermission, address _newBuyer)
    external
    addressIsWhitelisted(_storage, msg.sender)
  {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, _ownerPermission, _newBuyer));
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address signer = LECRecovery.recover(msgHash, _signedMessage);
    checkNotMsgSender(signer);

    ownerPermissionCheck(_storage, _eventId, _ticketId, _ownerPermission);
    LEventsEnact.doResellTicket(_storage, _eventId, _ticketId, _newBuyer, signer);
    emit LogSignedTicketResale(_eventId, _ticketId, _newBuyer);
  }

   function ownerPermissionCheck(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ownerPermission) private view {
     address currentOwner = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "buyer")));
     bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, currentOwner));
     msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
     address signer = LECRecovery.recover(msgHash, _ownerPermission);
     addressMatch(signer, currentOwner);
   }

   function addressMatch(address _addrA, address _addrB) private pure  {
     require(
       _addrA == _addrB,
       "Addresses do not match"
     );
   }

  /**
  * @dev Register a delegate for an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - type of delegate (must be "primary" or "secondary")
  * @param _delegate - delegate address
  */
  function registerDelegate(IAventusStorage _storage, uint _eventId, string _role, address _delegate)
    external
    onlyEventOwner(_storage, _eventId)
    addressIsWhitelisted(_storage, _delegate)
    validDelegateRole(_storage, _role)
  {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "delegate", _delegate)), true);
    emit LogRegisterDelegate(_eventId, _role, _delegate);
  }

  /**
  * @dev Deregister a delegate to an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - type of delegate (must be "primary" or "secondary")
  * @param _delegate - delegate of the event
  */
  function deregisterDelegate(IAventusStorage _storage, uint _eventId, string _role, address _delegate)
    external
    onlyEventOwner(_storage, _eventId)
    validDelegateRole(_storage, _role)
  {
    if (addressIsDelegate(_storage, _eventId, _role, _delegate)) {
      _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "delegate", _delegate)), false);
      emit LogDeregisterDelegate(_eventId, _role, _delegate);
    }
  }

  function setEventAsChallenged(IAventusStorage _storage, uint _eventId, uint _challengeProposalId)
    external {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")), _challengeProposalId);
  }

  function setEventAsClearFromChallenge(IAventusStorage _storage, uint _eventId)
    external {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "challenge")), 0);
  }

  function setEventStatusFraudulent(IAventusStorage _storage, uint _eventId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Event", _eventId, "status")), 2);
    // Event is no longer valid; remove the expected deposit for the event owner.
    LEventsEnact.doUnlockEventDeposit(_storage, _eventId);
    // TODO: Add fraudulent counter, will be required for event deposit calculation
  }

  /**
  * @dev Get the pre-calculated deposit for the specified event
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) external view returns (uint eventDeposit_) {
    eventDeposit_ = LEventsCommon.getExistingEventDeposit(_storage, _eventId);
  }

  // TODO: Could be external but too many variables for stack unless public
  function signedCreateEvent(IAventusStorage _storage, bytes _signedMessage, string _eventDesc,
    uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime,
    string _eventSupportURL, address _owner)
    public
    addressIsWhitelisted(_storage, msg.sender)
    returns (uint eventId_)
  {
    bytes32 msgHash = LEventsCommon.hashEventParameters(
      _eventDesc, _eventTime,_capacity, _averageTicketPriceInUSCents, _ticketSaleStartTime,
      _eventSupportURL, _owner
    );
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address signer = LECRecovery.recover(msgHash, _signedMessage);
    checkNotMsgSender(signer);
    require (
      signer == _owner,
      "Sender cannot equal the event owner. Use createEvent instead"
    );

    eventId_ = LEventsEnact.doCreateEvent(
      _storage, _eventDesc, _eventTime, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime, _eventSupportURL, _owner
    );
    emit LogSignedEventCreated(eventId_, _eventDesc, _ticketSaleStartTime, _eventTime, _averageTicketPriceInUSCents);
  }

  function eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) public view returns (bool notUnderChallenge_) {
    notUnderChallenge_ = LEventsCommon.eventIsNotUnderChallenge(_storage, _eventId);
  }

  /**
  * @dev Check if an address is registered as a delegate for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _delegate - address to check
  * @param _role - type of delegate (must be "primary" or "secondary")
  * @return registered_ - returns true if the supplied delegate is registered
  */
  function addressIsDelegate(IAventusStorage _storage, uint _eventId, string _role, address _delegate)
    public
    view
    returns (bool registered_)
  {
    registered_ = LEventsCommon.addressIsDelegate(_storage, _eventId, _role, _delegate);
  }

  function getEventDeposit(IAventusStorage _storage, uint _capacity, uint _averageTicketPriceInUSCents, uint _ticketSaleStartTime)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    (depositInUSCents_, depositInAVTDecimals_) = LEventsCommon.getEventDeposit(_storage, _capacity, _averageTicketPriceInUSCents,
      _ticketSaleStartTime);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (address eventOwner_)
  {
    eventOwner_ = LEventsCommon.getEventOwner(_storage, _eventId);
  }

  function checkNotMsgSender(address _signer) private view  {
    require(
      msg.sender != _signer,
      "Sender must not be the message signer"
    );
  }
}
