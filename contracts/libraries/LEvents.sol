pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LMembers.sol';
import "./LAventusTime.sol";
import "./LProposal.sol";
import "./LEventsCommon.sol";
import "./LEventsEnact.sol";
import "./LEventsTickets.sol";
import "./zeppelin/LECRecovery.sol";

library LEvents {

  /// See IEventsManager interface for events description
  event LogEventCreated(uint indexed eventId, string eventDesc, string eventSupportURL, uint ticketSaleStartTime, uint eventTime, uint averageTicketPriceInUSCents, uint depositInAVTDecimals);
  event LogEventCancelled(uint indexed eventId);
  // TODO: Rename to LogEventEnded.
  event LogUnlockEventDeposit(uint indexed eventId);
  event LogTicketSale(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata, bytes sellerProof, bytes doorData, address indexed buyer);
  event LogTicketRefund(uint indexed eventId, uint indexed ticketId, bytes vendorProof);
  event LogTicketResale(uint indexed eventId, uint indexed ticketId, address indexed newBuyer, bytes sellerProof);
  event LogRegisterRole(uint indexed eventId, string role, address indexed _address);
  event LogDeregisterRole(uint indexed eventId, string role, address indexed _address);

  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(
      LEventsCommon.addressIsOwner(_storage, _eventId, msg.sender),
      "Function must be called by owner"
    );
    _;
  }

  modifier onlyBroker(IAventusStorage _storage, address _brokerAddress) {
    require(
      brokerIsRegistered(_storage, _brokerAddress),
      "Member must be registered as a broker"
    );
    _;
  }

  modifier onlyBrokerForThisEvent(IAventusStorage _storage, address _brokerAddress, uint _eventId) {
    require(
      brokerIsRegisteredOnEvent(_storage, _brokerAddress, _eventId),
      "Member must be registered as a broker on this event"
    );
    _;
  }

  modifier onlyRegisteredMember(IAventusStorage _storage, address _address, string _role) {
    require(
      LMembers.memberIsActive(_storage, _address, _role),
      "Member must be registered"
    );
    _;
  }

  modifier onlyValidRole(IAventusStorage _storage, string _role) {
    require(
      keccak256(abi.encodePacked(_role)) == keccak256("PrimaryDelegate") ||
      keccak256(abi.encodePacked(_role)) == keccak256("SecondaryDelegate") ||
      keccak256(abi.encodePacked(_role)) == keccak256("Broker"),
      "Role must be PrimaryDelegate, SecondaryDelegate or Broker"
    );
    _;
  }

  modifier onlyActiveEvent(IAventusStorage _storage, uint _eventId) {
    require(eventActive(_storage, _eventId), "Event must be active");
    _;
  }

  // TODO: Move to private area.
  function eventActive(IAventusStorage _storage, uint _eventId) view private returns (bool _eventActive) {
    _eventActive = LEventsCommon.eventActive(_storage, _eventId);
  }

  function getAventityIdFromEventId(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = LEventsCommon.getAventityIdFromEventId(_storage, _eventId);
  }

  function createEvent(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime,
      uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, bytes _ownerProof)
    external
    returns (uint eventId_)
  {
    eventId_ = _ownerProof.length > 0
      ? createEventFromBroker(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
            _averageTicketPriceInUSCents, _ownerProof)
      : createEventFromOwner(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
            _averageTicketPriceInUSCents);
  }

  function challengeEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyActiveEvent(_storage, _eventId)
    returns (uint challengeProposalId_)
  {
    challengeProposalId_ = LEventsEnact.doChallengeEvent(_storage, _eventId);
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId, bytes _ownerProof) external {
    if (_ownerProof.length > 0) {
      cancelEventFromBroker(_storage, _eventId, _ownerProof);
    } else {
      cancelEventFromOwner(_storage, _eventId);
    }
  }

  // TODO: Rename to endEvent, and the event log too.
  function unlockEventDeposit(IAventusStorage _storage, uint _eventId)
    external
  {
    LEventsEnact.doEndEvent(_storage, _eventId);
    emit LogUnlockEventDeposit(_eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
    string _ticketMetadata, address _buyer, bytes _sellerProof, bytes _doorData)
    public
    returns (uint ticketId_)
  {
    address seller = _sellerProof.length > 0
      ? getTicketSellerForSaleViaBroker(_storage, _eventId, _vendorTicketRefHash, _buyer, _sellerProof)
      : msg.sender;

    ticketId_ = LEventsTickets.doSellTicket(_storage, _eventId, _vendorTicketRefHash, seller);

    _storage.setBytes(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "doorData")), _doorData);
    _storage.setAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", ticketId_, "buyer")), _buyer);

    emit LogTicketSale(_eventId, ticketId_, _vendorTicketRefHash, _ticketMetadata, _sellerProof, _doorData, _buyer);
  }

  function refundTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _vendorProof)
    external
  {
    address vendor;

    if (_vendorProof.length > 0) {
      require(brokerIsRegisteredOnEvent(_storage, msg.sender, _eventId), "Broker must be registered on event");
      bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId));
      vendor = getSignerAndCheckNotSender(msgHash, _vendorProof);
    } else {
      vendor = msg.sender;
    }

    LEventsTickets.doRefundTicket(_storage, _eventId, _ticketId, vendor);
    emit LogTicketRefund(_eventId, _ticketId, _vendorProof);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId,
    bytes _ownerPermission, address _newBuyer, bytes _sellerProof)
  external
  {
    address seller;

    if (_sellerProof.length > 0) {
      require(brokerIsRegisteredOnEvent(_storage, msg.sender, _eventId));
      bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, _ownerPermission, _newBuyer));
      seller = getSignerAndCheckNotSender(msgHash, _sellerProof);
    } else {
      seller = msg.sender;
    }

    resellTicketOwnerPermissionCheck(_storage, _eventId, _ticketId, _ownerPermission);
    LEventsTickets.doResellTicket(_storage, _eventId, _ticketId, _newBuyer, seller);
    emit LogTicketResale(_eventId, _ticketId, _newBuyer, _sellerProof);
  }

   function resellTicketOwnerPermissionCheck(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ownerPermission) private view {
     address currentOwner = _storage.getAddress(keccak256(abi.encodePacked("Event", _eventId, "Ticket", _ticketId, "buyer")));
     bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, currentOwner));
     msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
     address signer = LECRecovery.recover(msgHash, _ownerPermission);
     require(signer == currentOwner, "resale must be signed by current owner");
   }

  /**
  * @dev Register an Aventity member for an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - role must be an aventity type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
  * @param _address - address
  */
  function registerRole(IAventusStorage _storage, uint _eventId, string _role, address _address)
    external
    onlyEventOwner(_storage, _eventId)
    onlyValidRole(_storage, _role)
    onlyRegisteredMember(_storage, _address, _role)
  {
    _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "address", _address)), true);
    emit LogRegisterRole(_eventId, _role, _address);
  }

  /**
  * @dev Deregister an Aventity member from an existing event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _role - role must be an aventity type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
  * @param _address - address
  */
  function deregisterRole(IAventusStorage _storage, uint _eventId, string _role, address _address)
    external
    onlyEventOwner(_storage, _eventId)
    onlyValidRole(_storage, _role)
  {
    if (LEventsCommon.roleIsRegistered(_storage, _eventId, _role, _address)) {
      _storage.setBoolean(keccak256(abi.encodePacked("Event", _eventId, "role", _role, "address", _address)), false);
      emit LogDeregisterRole(_eventId, _role, _address);
    }
  }

  /**
  * @dev Get the pre-calculated deposit for the specified event
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) external view returns (uint eventDeposit_) {
    eventDeposit_ = LEventsCommon.getExistingEventDeposit(_storage, _eventId);
  }

  function createEventFromOwner(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime,
    uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents)
    private
    returns (uint eventId_)
  {
    eventId_ = doCreateEvent(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
        _averageTicketPriceInUSCents, msg.sender);
  }

  function createEventFromBroker(IAventusStorage _storage, string _eventDesc, string _eventSupportURL,
      uint _ticketSaleStartTime, uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, bytes _ownerProof)
    private
    onlyBroker(_storage, msg.sender)
    returns (uint eventId_)
  {
    bytes32 msgHash = LEventsCommon.hashEventParameters(_eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime,
        _capacity, _averageTicketPriceInUSCents);
    address owner = getSignerAndCheckNotSender(msgHash, _ownerProof);
    eventId_ = doCreateEvent(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _capacity,
        _averageTicketPriceInUSCents, owner);
  }

  function doCreateEvent(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime,
      uint _eventTime, uint _capacity, uint _averageTicketPriceInUSCents, address _owner)
    private
    returns (uint eventId_)
  {
    uint depositInAVTDecimals;
    (eventId_, depositInAVTDecimals) = LEventsEnact.doCreateEvent(_storage, _eventDesc, _eventSupportURL, _ticketSaleStartTime,
        _eventTime, _capacity, _averageTicketPriceInUSCents, _owner);
    emit LogEventCreated(eventId_, _eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, _averageTicketPriceInUSCents,
        depositInAVTDecimals);
  }

  /**
  * @dev Check if an Aventity member is registered for an event
  * @param _storage Storage contract
  * @param _eventId - ID of the event
  * @param _address - address to check
  * @param _role - role must be an aventity type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
  * @return registered_ - returns true if the supplied member is registered
  */
  function roleIsRegistered(IAventusStorage _storage, uint _eventId, string _role, address _address)
    public
    view
    returns (bool registered_)
  {
    registered_ = LEventsCommon.roleIsRegistered(_storage, _eventId, _role, _address);
  }

  function getNewEventDeposit(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    (depositInUSCents_, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (address eventOwner_)
  {
    eventOwner_ = LEventsCommon.getEventOwner(_storage, _eventId);
  }

  function cancelEventFromOwner(IAventusStorage _storage, uint _eventId)
    private
    onlyEventOwner(_storage, _eventId)
  {
    doCancelEvent(_storage, _eventId);
  }

  function cancelEventFromBroker(IAventusStorage _storage, uint _eventId, bytes _ownerProof)
    private
    onlyBrokerForThisEvent(_storage, msg.sender, _eventId)
  {
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId));
    address signer = getSignerAndCheckNotSender(msgHash, _ownerProof);
    require(signer == getEventOwner(_storage, _eventId), "Signer must be event owner");
    doCancelEvent(_storage, _eventId);
  }

  function doCancelEvent(IAventusStorage _storage, uint _eventId) private {
    LEventsEnact.doCancelEvent(_storage, _eventId);
    emit LogEventCancelled(_eventId);
  }

  function getSignerAndCheckNotSender(bytes32 _msgHash, bytes _signedMessage)
    private
    view
    returns (address signer_)
  {
    _msgHash = LECRecovery.toEthSignedMessageHash(_msgHash);
    signer_ = LECRecovery.recover(_msgHash, _signedMessage);
    require(msg.sender != signer_, "Sender is signer: omit signed proof argument for this case");
  }

  function brokerIsRegistered (IAventusStorage _storage, address _brokerAddress)
    private
    view
    returns (bool isRegistered_)
  {
    isRegistered_ = LMembers.memberIsActive(_storage, _brokerAddress, "Broker");
  }

  function brokerIsRegisteredOnEvent (IAventusStorage _storage, address _brokerAddress, uint _eventId)
    private
    view
    returns (bool isRegistered_)
  {
    isRegistered_ = brokerIsRegistered(_storage, _brokerAddress) && LEventsCommon.roleIsRegistered(_storage, _eventId, "Broker", _brokerAddress);
  }

  function validateProof (IAventusStorage _storage, bytes _signedMessage, bytes32 _msgHash, uint _eventId, string _role)
    private
    view
    returns (bool isValid_)
  {
    _msgHash = LECRecovery.toEthSignedMessageHash(_msgHash);
    address signer = LECRecovery.recover(_msgHash, _signedMessage);
    isValid_ = (LEventsCommon.addressIsOwner(_storage, _eventId, signer) || LEventsCommon.roleIsRegistered(_storage, _eventId, _role, signer));
  }

  function getTicketSellerForSaleViaBroker(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
    address _buyer, bytes _sellerProof)
    private
    view
    returns (address seller_)
  {
    bytes32 blankHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash));
    bytes32 buyerHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _buyer));

    if (validateProof(_storage, _sellerProof, blankHash, _eventId, "PrimaryDelegate")) {
      require(brokerIsRegisteredOnEvent(_storage, msg.sender, _eventId), "Broker must be registered on event");
      seller_ = getSignerAndCheckNotSender(blankHash, _sellerProof);
    } else if (validateProof(_storage, _sellerProof, buyerHash, _eventId, "PrimaryDelegate")) {
      require(brokerIsRegistered(_storage, msg.sender), "Broker must be registered");
      seller_ = getSignerAndCheckNotSender(buyerHash, _sellerProof);
    } else {
      revert("Invalid seller proof");
    }
  }
}