pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LMerkleRootsStorage {
  string constant merkleRootSchema = "MerkleRoot";

  function getRootHashOwner(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "owner")));
  }

  function setRootHashOwner(IAventusStorage _storage, bytes32 _rootHash, address _owner) external {
    _storage.setAddress(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "owner")), _owner);
  }
}