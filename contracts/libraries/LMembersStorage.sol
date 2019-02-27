pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";

library LMembersStorage {

  string constant membersSchema = "Members";
  string constant memberSchema = "Member";

  function getFixedDepositAmount(IAventusStorage _storage, string calldata _memberType)
    external
    view
    returns (uint fixedDepositAmount_)
  {
    fixedDepositAmount_ = _storage.getUInt(keccak256(abi.encodePacked(membersSchema, _memberType, "fixedDepositAmount")));
  }

  function getAventityId(IAventusStorage _storage, address _memberAddress, string calldata _memberType)
    external
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(
        keccak256(abi.encodePacked(memberSchema, _memberAddress, "type", _memberType, "aventityId")));
  }

  function setAventityId(IAventusStorage _storage, address _memberAddress, string calldata _memberType, uint _aventityId)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(memberSchema, _memberAddress, "type", _memberType, "aventityId")), _aventityId);
  }

  function clearAventityId(IAventusStorage _storage, address _memberAddress, string calldata _memberType)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(memberSchema, _memberAddress, "type", _memberType, "aventityId")), 0);
  }

  function getEarliestDeregistrationTime(IAventusStorage _storage, address _memberAddress, string calldata _memberType)
    external
    view
    returns (uint earliestDeregistrationTime_)
  {
    bytes32 key = keccak256(abi.encodePacked(memberSchema, _memberAddress, "type", _memberType, "earliestDeregistrationTime"));
    earliestDeregistrationTime_ = _storage.getUInt(key);
  }

  function setEarliestDeregistrationTime(IAventusStorage _storage, address _memberAddress, string calldata _memberType,
      uint _earliestDeregistrationTime)
    external
  {
    bytes32 key = keccak256(abi.encodePacked(memberSchema, _memberAddress, "type", _memberType, "earliestDeregistrationTime"));
    _storage.setUInt(key, _earliestDeregistrationTime);
  }
}