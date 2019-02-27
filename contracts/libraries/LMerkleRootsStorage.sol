pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LMerkleRootsStorage {

  string constant merkleRootSchema = "MerkleRoot";
  string constant merkleRootsSchema = "MerkleRoots";
  bytes32 constant baseDepositHash = keccak256(abi.encodePacked(merkleRootsSchema, "baseDeposit"));
  bytes32 constant coolingOffPeriodHash = keccak256(abi.encodePacked(merkleRootsSchema, "coolingOffPeriod"));
  bytes32 constant depositMultiplierHash = keccak256(abi.encodePacked(merkleRootsSchema, "depositMultiplier"));
  bytes32 constant maxTreeDepthHash = keccak256(abi.encodePacked(merkleRootsSchema, "maxTreeDepth"));
  bytes32 constant maxInterveningEventTimeHash = keccak256(abi.encodePacked(merkleRootsSchema, "maxInterveningEventTime"));

  function getBaseDeposit(IAventusStorage _storage)
    external
    view
    returns (uint baseDeposit_)
  {
    baseDeposit_ = _storage.getUInt(baseDepositHash);
  }

  function getCoolingOffPeriod(IAventusStorage _storage)
    external
    view
    returns (uint coolingOffPeriod_)
  {
    coolingOffPeriod_ = _storage.getUInt(coolingOffPeriodHash);
  }

  function getDepositMultiplier(IAventusStorage _storage)
    external
    view
    returns (uint multiplier_)
  {
    multiplier_ = _storage.getUInt(depositMultiplierHash);
  }

  function getMaxTreeDepth(IAventusStorage _storage)
    external
    view
    returns (uint maxDepth_)
  {
    maxDepth_ = _storage.getUInt(maxTreeDepthHash);
  }

  function getMaxInterveningEventTime(IAventusStorage _storage)
    external
    view
    returns (uint maxInterveningEventTime_)
  {
    maxInterveningEventTime_ = _storage.getUInt(maxInterveningEventTimeHash);
  }

  function getRootHashOwner(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "owner")));
  }

  function setRootHashOwner(IAventusStorage _storage, bytes32 _rootHash, address _owner)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "owner")), _owner);
  }

  function getTreeDepth(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint treeDepth_)
  {
    treeDepth_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "treeDepth")));
  }

  function setTreeDepth(IAventusStorage _storage, bytes32 _rootHash, uint _treeDepth)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "treeDepth")), _treeDepth);
  }

  function getLastEventTime(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint lastEventTime_)
  {
    lastEventTime_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "lastEventTime")));
  }

  function setLastEventTime(IAventusStorage _storage, bytes32 _rootHash, uint _lastEventTime)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "lastEventTime")), _lastEventTime);
  }

  function getDeposit(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, bytes32 _rootHash, uint _deposit)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootSchema, _rootHash, "deposit")), _deposit);
  }
}