pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LMembers.sol";
import "./LAVTManager.sol";
import "./LMerkleRootsStorage.sol";

library LMerkleRoots {

  // See IMerkleRootsManager interface for logs description
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash);

  modifier onlyActiveScalingProvider(IAventusStorage _storage) {
    require(LMembers.memberIsActive(_storage, msg.sender, "ScalingProvider"), "Sender must be an active scaling provider");
    _;
  }

  modifier onlyIfNotAlreadyActive(IAventusStorage _storage, bytes32 _rootHash) {
    require(!merkleRootIsActive(_storage, _rootHash), "Merkle root is already active");
    _;
  }

  // NOTE: IAventusStorage is not used here but is required for proxying
  function generateMerkleRoot(IAventusStorage, bytes32[] _merklePath, bytes32 _leafHash)
    external
    pure
    returns (bytes32 rootHash_)
  {
    bytes32 computedHash = _leafHash;

    for (uint i = 0; i < _merklePath.length; i++) {
      bytes32 pathElement = _merklePath[i];

      if (computedHash < pathElement) {
        // Hash(current computed hash + current path element)
        computedHash = keccak256(abi.encodePacked(computedHash, pathElement));
      } else {
        // Hash(current element of the path + current computed hash)
        computedHash = keccak256(abi.encodePacked(pathElement, computedHash));
      }
    }
    rootHash_ = computedHash;
  }

  function registerMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    onlyActiveScalingProvider(_storage)
    onlyIfNotAlreadyActive(_storage, _rootHash)
  {
    LMerkleRootsStorage.setRootHashOwner(_storage, _rootHash, msg.sender);
    LMembers.recordInteraction(_storage, msg.sender, "ScalingProvider");
    emit LogMerkleRootRegistered(msg.sender, _rootHash);
  }

  function merkleRootIsActive(IAventusStorage _storage, bytes32 _rootHash) public view returns (bool merkleRootIsActive_) {
    // TODO: Consider checking that the scaling provider is valid here as this is also called directly from listTicket.
    merkleRootIsActive_ = LMerkleRootsStorage.getRootHashOwner(_storage, _rootHash) != address(0);
  }
}