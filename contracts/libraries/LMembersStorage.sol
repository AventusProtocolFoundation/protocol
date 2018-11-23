pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";

library LMembersStorage {

  function getFixedDepositAmount(IAventusStorage _storage, string _memberType)
    external
    view
    returns (uint fixedDepositAmount_)
  {
    fixedDepositAmount_ = _storage.getUInt(keccak256(abi.encodePacked("Members", _memberType, "fixedDepositAmount")));
  }

  function getAventityId(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")));
  }

  function setAventityId(IAventusStorage _storage, address _memberAddress, string _memberType, uint _aventityId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")), _aventityId);
  }

  function clearAventityId(IAventusStorage _storage, address _memberAddress, string _memberType) external {
    _storage.setUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "aventityId")), 0);
  }

  function setLastInteractionTime(IAventusStorage _storage, address _memberAddress, string _memberType) external {
    uint currentTime = LAventusTime.getCurrentTime(_storage);
    _storage.setUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType, "lastInteractionTime")),
        currentTime);
  }

  function getLastInteractionTime(IAventusStorage _storage, address _memberAddress, string _memberType)
    external
    view
    returns (uint lastInteractionTime_)
  {
    lastInteractionTime_ = _storage.getUInt(keccak256(abi.encodePacked("Member", _memberAddress, "type", _memberType,
        "lastInteractionTime")));
  }

  function getCoolingOffPeriod(IAventusStorage _storage, string _memberType)
    external
    view
    returns (uint coolingOffPeriod_)
  {
    coolingOffPeriod_ = _storage.getUInt(keccak256(abi.encodePacked("Members", _memberType, "coolingOffPeriodDays")));
  }
}