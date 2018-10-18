pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAventusTime.sol';
import './LAVTManager.sol';
import './LAventities.sol';
import './LMembers.sol';
import "./zeppelin/LECRecovery.sol";
import "./LEventsStorage.sol";

library LEventsCommon {

  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(isEventOwner(_storage, _eventId, msg.sender), "Function must be called by owner");
    _;
  }

  modifier onlyActiveMemberOnProtocol(IAventusStorage _storage, address _memberAddress, string _memberType) {
    require(isActiveMemberOnProtocol(_storage, _memberAddress, _memberType), "Member must be registered on protocol");
    _;
  }

  modifier onlyValidEventMemberType(IAventusStorage _storage, string _memberType) {
    require(
      keccak256(abi.encodePacked(_memberType)) == keccak256("Primary") ||
      keccak256(abi.encodePacked(_memberType)) == keccak256("Secondary") ||
      keccak256(abi.encodePacked(_memberType)) == keccak256("Broker"),
      "Member type must be Primary, Secondary or Broker"
    );
    _;
  }

  function validateEventCreation(IAventusStorage _storage, string _eventSupportURL, uint _onSaleTime, uint _offSaleTime)
    external
    view
  {
    require(bytes(_eventSupportURL).length != 0, "Event requires a non-empty URL");
    uint minimumEventReportingPeriod = (1 days) * LEventsStorage.getMinimumReportingPeriodDays(_storage);
    assert(minimumEventReportingPeriod > 0);
    require(_onSaleTime >= LAventusTime.getCurrentTime(_storage) + minimumEventReportingPeriod,
        "Reporting period must be greater than minimum");
    require(_onSaleTime < _offSaleTime, "Tickets on-sale time must be before off-sale time");
  }

  function getNewEventDeposit(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    depositInUSCents_ = getDepositInUSCents(_storage, _averageTicketPriceInUSCents);
    depositInAVTDecimals_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents_);
  }

  function getSenderAndValidateVendorProof(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      address _ticketOwner, bytes _vendorProof)
    external
    view
    returns (address vendor_)
  {
    bytes32 blankHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash));
    bytes32 ticketOwnerHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _ticketOwner));

    vendor_ = getSenderAndValidateMemberProof(_storage, _eventId, "Primary", _vendorProof, blankHash, ticketOwnerHash);
  }

  function validateResellerProofAndSender(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ticketOwnerPermission,
      address _newBuyer, bytes _resellerProof)
    external
    view
  {
    bytes32 newBuyerHash = keccak256(abi.encodePacked(_eventId, _ticketId, _ticketOwnerPermission, _newBuyer));
    bytes32 blankHash = keccak256(abi.encodePacked(_eventId, _ticketId, _ticketOwnerPermission));

    getSenderAndValidateMemberProof(_storage, _eventId, "Secondary", _resellerProof, blankHash, newBuyerHash);
  }

  function resellTicketOwnerPermissionCheck(IAventusStorage _storage, uint _eventId, uint _ticketId,
      bytes _ticketOwnerPermission)
   external
   view {
    address currentOwner = LEventsStorage.getTicketOwner(_storage, _eventId, _ticketId);
    bytes32 msgHash = keccak256(abi.encodePacked(_eventId, _ticketId, currentOwner));
    address signer = getSignerFromProof(msgHash, _ticketOwnerPermission);
    require(signer == currentOwner, "resale must be signed by current owner");
  }

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) external view returns (uint eventDeposit_) {
    uint aventityId = LEventsStorage.getAventityId(_storage, _eventId);
    eventDeposit_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  function registerMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
    onlyEventOwner(_storage, _eventId)
    onlyValidEventMemberType(_storage, _memberType)
    onlyActiveMemberOnProtocol(_storage, _memberAddress, _memberType)
    returns (bool)
  {
    if (isActiveMemberOnEvent(_storage, _eventId, _memberAddress, _memberType)) return false; // Already registered
    LEventsStorage.setAsRegisteredMemberOnEvent(_storage, _eventId, _memberAddress, _memberType, true);
    return true;
  }

  function deregisterMemberFromEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
    onlyEventOwner(_storage, _eventId)
    onlyValidEventMemberType(_storage, _memberType)
    returns (bool)
  {
    if (!isActiveMemberOnEvent(_storage, _eventId, _memberAddress, _memberType)) return false; // Already deregistered.
    LEventsStorage.setAsRegisteredMemberOnEvent(_storage, _eventId, _memberAddress, _memberType, false);
    return true;
  }

  function isActiveVendorOnEvent(IAventusStorage _storage, uint _eventId, address _vendor)
    external
    view
    returns (bool isActive_)
  {
    isActive_ = isEventOwner(_storage, _eventId, _vendor) || isActiveMemberOnEvent(_storage, _eventId, _vendor, "Primary");
  }

  function getSignerFromProof(bytes32 _msgHash, bytes _proof) public pure returns (address signer_) {
    signer_ = LECRecovery.recover(_msgHash, _proof);
  }

  function isActiveBrokerOnProtocol(IAventusStorage _storage, address _brokerAddress)
    public
    view
    returns (bool isRegistered_)
  {
    // Protocol registered primaries and secondaries have protocol registered broker permissions
    isRegistered_ = isActiveMemberOnProtocol(_storage, _brokerAddress, "Broker") ||
        isActiveMemberOnProtocol(_storage, _brokerAddress, "Primary") ||
        isActiveMemberOnProtocol(_storage, _brokerAddress, "Secondary");
  }

  function isActiveBrokerOnEvent(IAventusStorage _storage, address _brokerAddress, uint _eventId)
    public
    view
    returns (bool isValidBroker_)
  {
    // ALL valid member types can act as a broker.
    isValidBroker_ = isActiveMemberOnEvent(_storage, _eventId, _brokerAddress, "Broker") ||
        isActiveMemberOnEvent(_storage, _eventId, _brokerAddress, "Primary") ||
        isActiveMemberOnEvent(_storage, _eventId, _brokerAddress, "Secondary") ||
        isEventOwner(_storage, _eventId, _brokerAddress);
  }

  function isActiveMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    private
    view
    returns (bool isActive_)
  {
    isActive_ = isRegisteredMemberOnEvent(_storage, _eventId, _memberAddress, _memberType) &&
        isActiveMemberOnProtocol(_storage, _memberAddress, _memberType);
  }

  function isRegisteredMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    private
    view
    returns (bool isRegistered_)
  {
    isRegistered_ = LEventsStorage.isRegisteredAsMemberOnEvent(_storage, _eventId, _memberAddress, _memberType);
  }

  function isActiveMemberOnProtocol(IAventusStorage _storage, address _memberAddress, string _memberType)
    private
    view
    returns (bool isActive_)
  {
    isActive_ = LMembers.memberIsActive(_storage, _memberAddress, _memberType);
  }

  function isEventOwner(IAventusStorage _storage, uint _eventId, address _owner)
    private
    view
    returns (bool isOwner_)
  {
    isOwner_ = _owner == LEventsStorage.getEventOwner(_storage, _eventId);
  }

  /**
   * @dev validate that a proof hash is signed by a registered member of correct type and sent by a registered member of correct
   * type
   */
  function getSenderAndValidateMemberProof(IAventusStorage _storage, uint _eventId, string _memberType, bytes _memberProof,
      bytes32 _blankHash, bytes32 _integratedHash)
    private
    view
    returns (address)
  {
    (bool isValid, address memberAddress) = validateMemberProof(_storage, _memberType, _memberProof, _blankHash, _eventId);
    if (isValid) {
      require(isActiveBrokerOnEvent(_storage, msg.sender, _eventId) ||
          isActiveMemberOnEvent(_storage, _eventId, msg.sender, _memberType),
          string(abi.encodePacked(_memberType, " or event active broker only")));
      return memberAddress;
    }

    (isValid, memberAddress) = validateMemberProof(_storage, _memberType, _memberProof, _integratedHash, _eventId);
    if (isValid) {
      require(isEventOwnerOrActiveBrokerOnProtocol(_storage, _eventId, msg.sender) ||
          isActiveMemberOnEvent(_storage, _eventId, msg.sender, _memberType),
          string(abi.encodePacked(_memberType, " or protocol active broker only")));
      return memberAddress;
    }

    revert(string(abi.encodePacked("Invalid ", _memberType, " proof")));
  }

  function validateMemberProof(IAventusStorage _storage, string _memberType, bytes _memberProof, bytes32 _msgHash,
      uint _eventId)
    private
    view
    returns (bool isValid_, address signer_)
  {
    signer_ = getSignerFromProof(_msgHash, _memberProof);
    isValid_ = isEventOwner(_storage, _eventId, signer_) ||
        isActiveMemberOnEvent(_storage, _eventId, signer_, _memberType);
  }

  function isEventOwnerOrActiveBrokerOnProtocol(IAventusStorage _storage, uint _eventId, address _ownerOrBrokerAddress)
    private
    view
    returns (bool isOwnerOrBroker_)
  {
    isOwnerOrBroker_ = isEventOwner(_storage, _eventId, _ownerOrBrokerAddress) ||
        isActiveBrokerOnProtocol(_storage, _ownerOrBrokerAddress);
  }

  function getDepositInUSCents(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    private
    view
    returns (uint depositInUSCents_)
  {
    depositInUSCents_ = _averageTicketPriceInUSCents == 0 ?
      LEventsStorage.getFreeEventDepositInUSCents(_storage) :
      LEventsStorage.getPaidEventDepositInUSCents(_storage);
  }
}