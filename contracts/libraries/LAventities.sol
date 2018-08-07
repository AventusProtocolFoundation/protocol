pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAVTManager.sol';

library LAventities {
  bytes32 constant fixedDepositAmountKey = keccak256(abi.encodePacked("Applications", "fixedDepositAmount"));
  bytes32 constant brokerHash = keccak256(abi.encodePacked("Broker"));
  bytes32 constant primaryDelegateHash = keccak256(abi.encodePacked("PrimaryDelegate"));
  bytes32 constant secondaryDelegateHash = keccak256(abi.encodePacked("SecondaryDelegate"));
  bytes32 constant eventHash = keccak256(abi.encodePacked("Event"));
  bytes32 constant aventityCountKey = keccak256(abi.encodePacked("AventityCount"));
  uint constant fraudulentAventityStatus = 2;

  /// See IAventitiesManager interface for events description
  event LogAventityMemberRegistered(uint indexed aventityId, address indexed aventityAddress, string _type, string evidenceUrl, string desc, uint deposit);
  event LogAventityMemberDeregistered(uint indexed aventityId, address indexed aventityAddress, string _type);
  event LogAventityEventRegistered(uint indexed aventityId, address indexed ownerAddress, uint indexed entityId, string _type, string evidenceUrl, string desc, uint deposit);
  event LogAventityEventDeregistered(uint indexed aventityId, address indexed ownerAddress, uint indexed entityId, string _type);

  modifier onlyValidAddressType(string _type) {
    bytes32 hashedType = keccak256(abi.encodePacked(_type));
    require(
      hashedType == brokerHash ||
      hashedType == primaryDelegateHash ||
      hashedType == secondaryDelegateHash,
      "Aventity type is not valid"
    );
    _;
  }

  modifier onlyValidEventType(string _type) {
    bytes32 hashedType = keccak256(abi.encodePacked(_type));
    require(
      hashedType == eventHash,
      "Aventity type must be 'Event'"
    );
    _;
  }

  modifier onlyRegistered(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsRegistered(_storage, _aventityId),
      "Aventity must be registered with the protocol"
    );
    _;
  }

  modifier onlyNotFraudulent(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsNotFraudulent(_storage, _aventityId),
      "Aventity must be registered with the protocol"
    );
    _;
  }

  modifier onlyValidAventityId(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIdIsValid(_storage, _aventityId),
      "Aventity ID must be valid"
    );
    _;
  }

  modifier onlyNotUnderChallenge(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsNotUnderChallenge(_storage, _aventityId),
      "Aventity must be clear of challenges"
    );
    _;
  }

  modifier onlyNotRegistered(IAventusStorage _storage, uint _aventityId)  {
    require(
      !aventityIsRegistered(_storage, _aventityId),
      "Aventity must not be registered with the protocol"
    );
    _;
  }

  function registerAventity(IAventusStorage _storage, address _aventityAddress, string _type, string _evidenceUrl, string _desc)
    external
    onlyValidAddressType(_type)
    onlyNotRegistered(_storage, getAventityIdFromAddress(_storage, _aventityAddress, _type))
  {
    uint aventityDeposit = getAventityDeposit(_storage, _type);

    lockAventityDeposit(_storage, _aventityAddress, aventityDeposit);

    uint aventityId = _storage.getUInt(aventityCountKey) + 1;

    _storage.setUInt(aventityCountKey, aventityId);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityAddress, "type", _type, "aventityId")), aventityId);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", aventityId, "deposit")), aventityDeposit);
    _storage.setAddress(keccak256(abi.encodePacked("Aventity", aventityId, "address")), _aventityAddress);
    _storage.setString(keccak256(abi.encodePacked("Aventity", aventityId, "type")), _type);
    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", aventityId, "approved")), true);

    emit LogAventityMemberRegistered(aventityId, _aventityAddress, _type, _evidenceUrl, _desc, aventityDeposit);
  }

  //TODO: should be a single method combined with deregisterEventAventity
  function deregisterAventity(IAventusStorage _storage, address _aventityAddress, string _type)
    external
    onlyValidAventityId(_storage, getAventityIdFromAddress(_storage, _aventityAddress, _type))
    onlyRegistered(_storage, getAventityIdFromAddress(_storage, _aventityAddress, _type))
    onlyNotFraudulent(_storage, getAventityIdFromAddress(_storage, _aventityAddress, _type))
    onlyNotUnderChallenge(_storage, getAventityIdFromAddress(_storage, _aventityAddress, _type))
  {

    uint aventityId = getAventityIdFromAddress(_storage, _aventityAddress, _type);

    unlockAventityDeposit(_storage, aventityId);

    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", aventityId, "approved")), false);
    emit LogAventityMemberDeregistered(aventityId, _aventityAddress, _type);
  }

  function deregisterEventAventity(IAventusStorage _storage, uint _aventityId)
    external
    onlyValidAventityId(_storage, _aventityId)
    onlyRegistered(_storage, _aventityId)
    onlyNotFraudulent(_storage, _aventityId)
    onlyNotUnderChallenge(_storage, _aventityId)
  {
    unlockAventityDeposit(_storage, _aventityId);

    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "approved")), false);
    emit LogAventityEventDeregistered(
      _aventityId, getAventityOwner(_storage, _aventityId),
      _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "entityId"))),
      getAventityType(_storage, _aventityId)
    );
  }

  function setAventityStatusFraudulent(IAventusStorage _storage, uint _aventityId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "status")), fraudulentAventityStatus);
    setAventityAsClearFromChallenge(_storage, _aventityId);

    // Aventity is no longer valid; remove the expected deposit for the aventity.
    // TODO: Add fraudulent counter, will be required for event deposit calculation
    unlockAventityDeposit(_storage, _aventityId);
  }

  function setAventityAsChallenged(IAventusStorage _storage, uint _aventityId, uint _challengeProposalId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")), _challengeProposalId);
  }

  function registerEventAventity(IAventusStorage _storage, address _aventityOwner, uint _entityId, string _type, string _evidenceUrl, string _desc, uint _aventityDeposit)
    public
    onlyValidEventType(_type)
    onlyNotRegistered(_storage, getAventityIdFromEventId(_storage, _entityId, _type))
  {
    lockAventityDeposit(_storage, _aventityOwner, _aventityDeposit);

    uint aventityId = _storage.getUInt(aventityCountKey) + 1;

    _storage.setUInt(aventityCountKey, aventityId);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _entityId, "type", _type, "aventityId")), aventityId);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", aventityId, "deposit")), _aventityDeposit);
    _storage.setAddress(keccak256(abi.encodePacked("Aventity", aventityId, "address")), _aventityOwner);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", aventityId, "entityId")), _entityId);
    _storage.setString(keccak256(abi.encodePacked("Aventity", aventityId, "type")), _type);
    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", aventityId, "approved")), true);

    emit LogAventityEventRegistered(aventityId, _aventityOwner, _entityId, _type, _evidenceUrl, _desc, _aventityDeposit);
  }

  function getAventityType(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (string type_)
  {
    type_ = _storage.getString(keccak256(abi.encodePacked("Aventity", _aventityId, "type")));
  }

  function getAventityIdFromEventId(IAventusStorage _storage, uint _entityId, string _type)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _entityId, "type", _type, "aventityId")));
  }

  function setAventityAsClearFromChallenge(IAventusStorage _storage, uint _aventityId)
    public
  {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")), 0);
  }

  function getAventityOwner(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (address aventityOwner_)
  {
    aventityOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "address")));
  }

  // @return AVT value with 18 decimal places of precision.
  function getAventityDeposit(IAventusStorage _storage, string _type)
    view
    public
     onlyValidAddressType(_type)
    returns (uint depositinAVT_)
  {
    uint depositInUSCents = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _type, "fixedDepositAmount")));
    depositinAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function getExistingAventityDeposit(IAventusStorage _storage, uint _aventityId) public view returns (uint aventityDeposit_) {
    aventityDeposit_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")));
  }

  function aventityIsActive(IAventusStorage _storage, address _aventityAddress, string _type)
    public
    view
    returns (bool aventityIsRegistered_)
  {
    uint aventityId = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityAddress, "type", _type, "aventityId")));
    aventityIsRegistered_ = aventityIsActive(_storage, aventityId);
  }

  function aventityIsActive(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsRegistered_)
  {
    aventityIsRegistered_ = aventityIsRegistered(_storage, _aventityId) && aventityIsNotFraudulent(_storage, _aventityId);
  }

  function aventityIsActiveAndNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    onlyValidAventityId(_storage, _aventityId)
    returns (bool aventityIsRegisteredAndNotUnderChallenge_)
  {
    aventityIsRegisteredAndNotUnderChallenge_ = aventityIsActive(_storage, _aventityId) &&
        aventityIsNotUnderChallenge(_storage, _aventityId);
  }

  function unlockAventityDeposit(IAventusStorage _storage, uint _aventityId) public {
    uint aventityDeposit = getExistingAventityDeposit(_storage, _aventityId);
    address aventityOrOwnerAddress = _storage.getAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "address")));
    require(
      aventityDeposit != 0,
      "Unlocked aventity must have a positive deposit"
    );
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", aventityOrOwnerAddress));
    assert(_storage.getUInt(expectedDepositsKey) >= aventityDeposit); // If this asserts, we messed up the deposit code!
    _storage.setUInt(expectedDepositsKey, _storage.getUInt(expectedDepositsKey) - aventityDeposit);

    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")), 0);
  }

  function lockAventityDeposit(IAventusStorage _storage, address _aventityOrOwnerAddress, uint _aventityDeposit)
    private
  {
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", _aventityOrOwnerAddress));
    uint expectedDeposits = _storage.getUInt(expectedDepositsKey) + _aventityDeposit;
    uint actualDeposits = LAVTManager.getBalance(_storage, _aventityOrOwnerAddress, "deposit");
    require(
      actualDeposits >= expectedDeposits,
      'Insufficient deposits'
    );
    _storage.setUInt(expectedDepositsKey, expectedDeposits);
  }

  function aventityIsNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsNotUnderChallenge_)
  {
    aventityIsNotUnderChallenge_ = 0 == _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")));
  }

  function aventityIdIsValid(IAventusStorage _storage, uint _aventityId)
    private
    view
    returns (bool aventityIdIsValid_)
  {
    aventityIdIsValid_ = _aventityId != 0 && _aventityId <= _storage.getUInt(aventityCountKey);
  }

  //TODO: Move to public
  function aventityIsNotFraudulent(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsNotFraudulent_)
  {
    aventityIsNotFraudulent_ = fraudulentAventityStatus != _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "status")));
  }

  function aventityIsRegistered(IAventusStorage _storage, uint _aventityId)
    private
    view
    returns (bool aventityIsRegistered_)
  {
    aventityIsRegistered_ = _storage.getBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "approved")));
  }

  function getAventityIdFromAddress(IAventusStorage _storage, address _aventityAddress, string _type)
    private
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityAddress, "type", _type, "aventityId")));
  }
}