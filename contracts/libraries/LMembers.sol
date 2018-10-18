pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAVTManager.sol';
import './LAventities.sol';
import './LProposal.sol';
import './LMembersStorage.sol';

library LMembers {
  bytes32 constant brokerHash = keccak256(abi.encodePacked("Broker"));
  bytes32 constant primaryHash = keccak256(abi.encodePacked("Primary"));
  bytes32 constant secondaryHash = keccak256(abi.encodePacked("Secondary"));
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
    require(
      hashedType == brokerHash ||
      hashedType == primaryHash ||
      hashedType == secondaryHash ||
      hashedType == tokenBondingCurveHash ||
      hashedType == scalingProviderHash ,
      "Member type is not valid"
    );
    _;
  }

  modifier onlyIfNotAlreadyRegistered(IAventusStorage _storage, address _memberAddress, string _memberType) {
    require(0 == getAventityIdForMember(_storage, _memberAddress, _memberType), "Member must not be registered");
    _;
  }

  function deregisterMember(IAventusStorage _storage, address _memberAddress, string _memberType) external {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    LAventities.deregisterAventity(_storage, aventityId);
    LMembersStorage.clearAventityId(_storage, _memberAddress, _memberType);

    emit LogMemberDeregistered(_memberAddress, _memberType);
  }

  function challengeMember(IAventusStorage _storage, address _memberAddress, string _memberType) external {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    uint proposalId = LAventities.challengeAventity(_storage, aventityId);
    (uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd) =
        LProposal.getTimestamps(_storage, proposalId);
    emit LogMemberChallenged(_memberAddress, _memberType, proposalId, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function endMemberChallenge(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);

    (uint proposalId, uint votesFor, uint votesAgainst, bool challengeWon) = LAventities.endAventityChallenge(_storage, aventityId);

    if (challengeWon) {
      LMembersStorage.clearAventityId(_storage, _memberAddress, _memberType);
    }

    emit LogMemberChallengeEnded(_memberAddress, _memberType, proposalId, votesFor, votesAgainst);
  }

  function getExistingMemberDeposit(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
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
    uint memberDeposit = getNewMemberDeposit(_storage, _memberType);
    uint aventityId = LAventities.registerAventity(_storage, _memberAddress, memberDeposit);

    // In addition to the standard aventity data, members need a mapping from member address and type to aventityId.
    LMembersStorage.setAventityId(_storage, _memberAddress, _memberType, aventityId);

    emit LogMemberRegistered(_memberAddress, _memberType, _evidenceUrl, _desc, memberDeposit);
  }

  function getNewMemberDeposit(IAventusStorage _storage, string _memberType)
    view
    public
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
}