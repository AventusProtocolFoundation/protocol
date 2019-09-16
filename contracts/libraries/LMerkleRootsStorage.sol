pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LMerkleRootsStorage {

  string constant merkleRootTable = "MerkleRoot";
  string constant merkleRootsTable = "MerkleRoots";
  bytes32 constant baseDepositHash = keccak256(abi.encodePacked(merkleRootsTable, "BaseDeposit"));
  bytes32 constant coolingOffPeriodHash = keccak256(abi.encodePacked(merkleRootsTable, "CoolingOffPeriod"));
  bytes32 constant depositMultiplierHash = keccak256(abi.encodePacked(merkleRootsTable, "DepositMultiplier"));
  bytes32 constant maxTreeDepthHash = keccak256(abi.encodePacked(merkleRootsTable, "MaxTreeDepth"));
  bytes32 constant maxInterveningTimeHash = keccak256(abi.encodePacked(merkleRootsTable, "MaxInterveningTime"));
  bytes32 constant challengeWindowHash = keccak256(abi.encodePacked(merkleRootsTable, "ChallengeWindow"));

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

  function getMaxInterveningTime(IAventusStorage _storage)
    external
    view
    returns (uint maxInterveningTime_)
  {
    maxInterveningTime_ = _storage.getUInt(maxInterveningTimeHash);
  }

  function getRootOwner(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "Owner")));
  }

  function setRootOwner(IAventusStorage _storage, bytes32 _rootHash, address _owner)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "Owner")), _owner);
  }

  function getTreeDepth(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint treeDepth_)
  {
    treeDepth_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "TreeDepth")));
  }

  function setTreeDepth(IAventusStorage _storage, bytes32 _rootHash, uint _treeDepth)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "TreeDepth")), _treeDepth);
  }

  function getRootExpiryTime(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint rootExpiryTime_)
  {
    rootExpiryTime_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "RootExpiryTime")));
  }

  function setRootExpiryTime(IAventusStorage _storage, bytes32 _rootHash, uint _rootExpiryTime)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "RootExpiryTime")), _rootExpiryTime);
  }

  function getDeposit(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "Deposit")));
  }

  function setDeposit(IAventusStorage _storage, bytes32 _rootHash, uint _deposit)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "Deposit")), _deposit);
  }

  function setRootRegistrationTime(IAventusStorage _storage, bytes32 _rootHash, uint _registrationTime)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "RegistrationTime")), _registrationTime);
  }

  function getRootChallengeExpiryTime(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint expiryTime_)
  {
    expiryTime_ = getRootRegistrationTime(_storage, _rootHash) + _storage.getUInt(challengeWindowHash);
  }

  function getRootRegistrationTime(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (uint registrationTime_)
  {
    registrationTime_ = _storage.getUInt(keccak256(abi.encodePacked(merkleRootTable, _rootHash, "RegistrationTime")));
  }
}