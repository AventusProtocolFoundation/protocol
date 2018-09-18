pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAVTManager.sol';
import './LAventities.sol';
import './LProposal.sol';

library LMembers {
  bytes32 constant brokerHash = keccak256(abi.encodePacked("Broker"));
  bytes32 constant primaryDelegateHash = keccak256(abi.encodePacked("PrimaryDelegate"));
  bytes32 constant secondaryDelegateHash = keccak256(abi.encodePacked("SecondaryDelegate"));
  bytes32 constant tokenBondingCurveHash = keccak256(abi.encodePacked("TokenBondingCurve"));
  bytes32 constant scalingProviderHash = keccak256(abi.encodePacked("ScalingProvider"));

  /// See IMembersManager interface for events description.
  event LogMemberRegistered(address indexed memberAddress, string memberType, string evidenceUrl, string desc, uint deposit);
  event LogMemberDeregistered(address indexed memberAddress, string memberType);

  modifier onlyValidMemberType(string _memberType) {
    bytes32 hashedType = keccak256(abi.encodePacked(_memberType));
    require(
      hashedType == brokerHash ||
      hashedType == primaryDelegateHash ||
      hashedType == secondaryDelegateHash ||
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

  function registerMember(IAventusStorage _storage, address _memberAddress, string _memberType, string _evidenceUrl, string _desc)
    public
    onlyValidMemberType(_memberType)
    onlyIfNotAlreadyRegistered(_storage, _memberAddress, _memberType)
  {
    uint memberDeposit = getNewMemberDeposit(_storage, _memberType);
    uint aventityId = LAventities.registerAventity(_storage, _memberAddress, memberDeposit);

    // In addition to the standard aventity data, members need a mapping from member address and type to aventityId.
    _storage.setUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")), aventityId);

    emit LogMemberRegistered(_memberAddress, _memberType, _evidenceUrl, _desc, memberDeposit);
  }

  function deregisterMember(IAventusStorage _storage, address _memberAddress, string _memberType) external {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    LAventities.deregisterAventity(_storage, aventityId);

    _storage.setUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")), 0);

    emit LogMemberDeregistered(_memberAddress, _memberType);
  }

  function challengeMember(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    returns (uint challengeProposalId_)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    challengeProposalId_ = LAventities.challengeAventity(_storage, aventityId);
    LProposal.emitLogMemberChallenge(_storage, _memberAddress, _memberType, challengeProposalId_);
  }

  function getExistingMemberDeposit(IAventusStorage _storage, address _memberAddress, string _memberType) external view returns (uint memberDepositInAVT_) {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    memberDepositInAVT_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  // @return AVT value with 18 decimal places of precision.
  function getNewMemberDeposit(IAventusStorage _storage, string _memberType)
    view
    public
    onlyValidMemberType(_memberType)
    returns (uint depositinAVT_)
  {
    uint depositInUSCents = _storage.getUInt(keccak256(abi.encodePacked("Members", _memberType, "fixedDepositAmount")));
    depositinAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function memberIsActive(IAventusStorage _storage, address _memberAddress, string _memberType)
    public
    view
    returns (bool aventityIsRegistered_)
  {
    uint aventityId = getAventityIdForMember(_storage, _memberAddress, _memberType);
    aventityIsRegistered_ = LAventities.aventityIsActive(_storage, aventityId);
  }

  function getAventityIdForMember(IAventusStorage _storage, address _memberAddress, string _memberType)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")));
  }

  function memberIsRegistered(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
    returns (bool memberIsRegistered_)
  {
    memberIsRegistered_ = LAventities.aventityIsRegistered(_storage, getAventityIdForMember(_storage, _memberAddress, _memberType));
  }
}