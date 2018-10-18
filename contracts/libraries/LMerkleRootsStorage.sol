pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';

library LMerkleRootsStorage {
  bytes32 constant fixedDepositAmountKey = keccak256(abi.encodePacked("MerkleRoots", "fixedDepositAmount"));

  function getFixedDepositAmount(IAventusStorage _storage)
    external
    view
    returns (uint fixedDepositAmount_)
  {
    fixedDepositAmount_ = _storage.getUInt(fixedDepositAmountKey);
  }

  function getAventityId(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")));
  }

  function setAventityId(IAventusStorage _storage, bytes32 _rootHash, uint _aventityId) external {
    _storage.setUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")), _aventityId);
  }

  function clearAventityId(IAventusStorage _storage, bytes32 _rootHash) external {
    _storage.setUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")), 0);
  }
}