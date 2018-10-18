pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';

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
}