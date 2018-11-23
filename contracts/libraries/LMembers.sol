pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./LAventities.sol";
import "./LProposals.sol";
import "./LMembersStorage.sol";

library LMembers {
  bytes32 constant primaryHash = keccak256(abi.encodePacked("Primary"));
  bytes32 constant secondaryHash = keccak256(abi.encodePacked("Secondary"));
  bytes32 constant brokerHash = keccak256(abi.encodePacked("Broker"));
  bytes32 constant tokenBondingCurveHash = keccak256(abi.encodePacked("TokenBondingCurve"));
  bytes32 constant scalingProviderHash = keccak256(abi.encodePacked("ScalingProvider"));

  // See IMembersManager interface for logs description.
  event LogMemberRegistered(address indexed memberAddress, string memberType, string evidenceUrl, string desc, uint deposit);
  event LogMemberDeregistered(address indexed memberAddress, string memberType);
  event LogMemberChallenged(address indexed memberAddress, string memberType, uint indexed proposalId, uint lobbyingStart,
      uint votingStart, uint revealingStart, uint revealingEnd);
  event LogMemberChallengeEnded(address indexed memberAddress, string memberType, uint indexed proposalId, uint votesFor,
      uint votesAgainst);

  modifier onlyValidMemberType(string _memberType) {
    bytes32 hashedType = keccak256(abi.encodePacked(_memberType));
    bool validMemberType =
        hashedType == brokerHash ||
        hashedType == primaryHash ||
        hashedType == secondaryHash ||
        hashedType == tokenBondingCurveHash ||
        hashedType == scalingProviderHash;
    require(validMemberType, "Member type is not valid");
    _;
  }

  modifier onlyAfterCoolingOffPeriod(IAventusStorage _storage, address _memberAddress, string _memberType) {
    require(isAfterCoolingOffPeriod(_storage, _memberAddress, _memberType), "Member is still in cooling off period");
    _;
  }

  modifier onlyIfNotAlreadyRegistered(IAventusStorage _storage, address _memberAddress, string _memberType) {
    require(0 == getAventityIdForMember(_storage, _memberAddress, _memberType), "Member must not be registered");
    _;
  }

  modifier onlyIfRegistered(IAventusStorage _storage, address _memberAddress, string _memberType) {
    require(getAventityIdForMember(_storage, _memberAddress, _memberType) > 0, "Member is not registered");
    _;
  }

  function deregisterMember(IAventusStorage _storage, address _memberAddress, string _memberType) external
    onlyValidMemberType(_memberType)
    onlyIfRegistered(_storage, _memberAddress, _memberType)
    onlyAfterCoolingOffPeriod(_storage, _memberAddress, _memberType)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    LAventities.deregisterAventity(_storage, aventityId);
    LMembersStorage.clearAventityId(_storage, _memberAddress, _memberType);

    emit LogMemberDeregistered(_memberAddress, _memberType);
  }

  function challengeMember(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    onlyValidMemberType(_memberType)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    uint proposalId = LAventities.challengeAventity(_storage, aventityId);
    (uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd) =
        LProposals.getTimestamps(_storage, proposalId);
    emit LogMemberChallenged(_memberAddress, _memberType, proposalId, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function endMemberChallenge(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    onlyValidMemberType(_memberType)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    require(aventityId != 0, "Member is not registered");

    (uint proposalId, uint votesFor, uint votesAgainst, bool challengeWon) = LAventities.endAventityChallenge(_storage, aventityId);

    if (challengeWon) {
      LMembersStorage.clearAventityId(_storage, _memberAddress, _memberType);
    }

    emit LogMemberChallengeEnded(_memberAddress, _memberType, proposalId, votesFor, votesAgainst);
  }

  function getExistingMemberDeposit(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
    onlyValidMemberType(_memberType)
    onlyIfRegistered(_storage, _memberAddress, _memberType)
    returns (uint memberDepositInAVT_)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    memberDepositInAVT_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  function memberIsActive(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
    returns (bool aventityIsRegistered_)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    aventityIsRegistered_ = LAventities.aventityIsActive(_storage, aventityId);
  }

  function registerMember(IAventusStorage _storage, address _memberAddress, string _memberType, string _evidenceUrl,
      string _desc)
    public
    onlyValidMemberType(_memberType)
    onlyIfNotAlreadyRegistered(_storage, _memberAddress, _memberType)
  {
    require(bytes(_evidenceUrl).length > 0, "Member requires a non-empty evidence URL");
    require(bytes(_desc).length > 0, "Member requires a non-empty description");

    uint memberDeposit = getNewMemberDeposit(_storage, _memberType);
    uint aventityId = LAventities.registerAventity(_storage, _memberAddress, memberDeposit);

    // In addition to the standard aventity data, members need a mapping from member address and type to aventityId.
    LMembersStorage.setAventityId(_storage, _memberAddress, _memberType, aventityId);

    emit LogMemberRegistered(_memberAddress, _memberType, _evidenceUrl, _desc, memberDeposit);
  }

  function getNewMemberDeposit(IAventusStorage _storage, string _memberType)
    public
    view
    onlyValidMemberType(_memberType)
    returns (uint depositinAVT_)
  {
    uint depositInUSCents = LMembersStorage.getFixedDepositAmount(_storage, _memberType);
    depositinAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function getAventityIdForMember(IAventusStorage _storage, address _memberAddress, string _memberType)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = LMembersStorage.getAventityId(_storage, _memberAddress, _memberType);
  }

  function recordInteraction (IAventusStorage _storage, address _memberAddress, string _memberType) public {
    LMembersStorage.setLastInteractionTime(_storage, _memberAddress, _memberType);
  }

  function isAfterCoolingOffPeriod(IAventusStorage _storage, address _memberAddress, string _memberType)
    private
    view
    returns (bool)
  {
    bytes32 hashedType = keccak256(abi.encodePacked(_memberType));
    uint coolingOffEndTime = 0;

    if (isEventMemberType(hashedType)) {
      coolingOffEndTime = getMaxEventMemberCoolingOffEndTime(_storage, _memberAddress, _memberType, hashedType);
    } else {
      coolingOffEndTime = getCoolingOffEndTime(_storage, _memberAddress, _memberType);
    }

    if (coolingOffEndTime == 0) return true;

    return LAventusTime.getCurrentTime(_storage) >= coolingOffEndTime;
  }

  function getMaxEventMemberCoolingOffEndTime(IAventusStorage _storage, address _memberAddress, string _memberType,
      bytes32 _hashedType)
    private
    view
    returns (uint maxCoolingOffEndTime_)
  {
    uint memberCoolingOffEndTime = 0;

    if (_hashedType == primaryHash || _hashedType == secondaryHash) {
      memberCoolingOffEndTime = getCoolingOffEndTime(_storage, _memberAddress, _memberType);
    }

    uint brokerCoolingOffEndTime = getCoolingOffEndTime(_storage, _memberAddress, "Broker");

    maxCoolingOffEndTime_ = maxTime(memberCoolingOffEndTime, brokerCoolingOffEndTime);
  }

  function getCoolingOffEndTime(IAventusStorage _storage, address _memberAddress, string _memberType) private view
    returns (uint coolingOffEndTime_)
  {
    uint lastInteractionTime = LMembersStorage.getLastInteractionTime(_storage, _memberAddress, _memberType);
    coolingOffEndTime_ = (lastInteractionTime == 0) ?
        0 : lastInteractionTime + LMembersStorage.getCoolingOffPeriod(_storage, _memberType) * 1 days;
  }

  function isEventMemberType(bytes32 _hashedType) private pure returns (bool isEventMemberType_) {
    isEventMemberType_ = _hashedType == brokerHash || _hashedType == primaryHash || _hashedType == secondaryHash;
  }

  function maxTime(uint _t1, uint _t2) private pure returns (uint maxTime_) {
    maxTime_ = _t1 > _t2 ? _t1 : _t2;
  }
}