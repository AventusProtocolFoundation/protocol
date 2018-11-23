pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";

library LMerkleRootsStorage {
  function getRootHashOwner(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "owner")));
  }

  function setRootHashOwner(IAventusStorage _storage, bytes32 _rootHash, address _owner) external {
    _storage.setAddress(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "owner")), _owner);
  }
}