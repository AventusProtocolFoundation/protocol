pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LMembers.sol";
import "./LMerkleRootsStorage.sol";
import "./LAventusTime.sol";
import "./LAVTManager.sol";

library LMerkleRoots {

  // See IMerkleRootsManager interface for logs description
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, uint treeDepth,
      uint lastEventTime);
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);
  event LogMerkleRootAutoChallenged(address indexed challenger, bytes32 indexed rootHash);

  modifier onlyActiveValidator(IAventusStorage _storage) {
    require(LMembers.memberIsActive(_storage, msg.sender, "Validator"), "Sender must be an active validator");
    _;
  }

  modifier onlyIfNotAlreadyActive(IAventusStorage _storage, bytes32 _rootHash) {
    require(!merkleRootIsActive(_storage, _rootHash), "Merkle root is already active");
    _;
  }

  modifier onlyActive(IAventusStorage _storage, bytes32 _rootHash) {
    require(merkleRootIsActive(_storage, _rootHash), "Merkle root must be active");
    _;
  }

  modifier onlyAfterCoolingOffPeriod(IAventusStorage _storage, bytes32 _rootHash) {
    uint lastEventTime = LMerkleRootsStorage.getLastEventTime(_storage, _rootHash);
    uint currentTime = LAventusTime.getCurrentTime(_storage);
    uint coolingOffPeriod = LMerkleRootsStorage.getCoolingOffPeriod(_storage);
    // Avoid underflow
    require(currentTime > lastEventTime && currentTime - lastEventTime >= coolingOffPeriod, "Must be after cooling off period");
    _;
  }

  modifier onlyValidTreeDepth(IAventusStorage _storage, uint _treeDepth) {
    require(_treeDepth > 0, "Tree depth cannot be zero");
    require(_treeDepth <= LMerkleRootsStorage.getMaxTreeDepth(_storage),
        "Tree depth must not exceed the maximum allowed value");
    _;
  }

  function registerMerkleRoot(IAventusStorage _storage, bytes32 _rootHash, uint _treeDepth, uint _lastEventTime)
    external
    onlyActiveValidator(_storage)
    onlyIfNotAlreadyActive(_storage, _rootHash)
  {
    uint deposit = getNewMerkleRootDeposit(_storage, _treeDepth, _lastEventTime);
    LAVTManager.lockDeposit(_storage, msg.sender, deposit);

    LMerkleRootsStorage.setRootHashOwner(_storage, _rootHash, msg.sender);
    LMerkleRootsStorage.setTreeDepth(_storage, _rootHash, _treeDepth);
    LMerkleRootsStorage.setDeposit(_storage, _rootHash, deposit);
    setLastEventTime(_storage, _rootHash, _lastEventTime);

    emit LogMerkleRootRegistered(msg.sender, _rootHash, _treeDepth, _lastEventTime);
  }

  // TODO: Consider making this possible only if the validator is active
  function deregisterMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    onlyActive(_storage, _rootHash)
    onlyAfterCoolingOffPeriod(_storage, _rootHash)
  {
    uint deposit = LMerkleRootsStorage.getDeposit(_storage, _rootHash);
    address rootHashOwner = LMerkleRootsStorage.getRootHashOwner(_storage, _rootHash);
    LMerkleRootsStorage.setRootHashOwner(_storage, _rootHash, address(0));
    LMerkleRootsStorage.setDeposit(_storage, _rootHash, 0);

    LAVTManager.unlockDeposit(_storage, rootHashOwner, deposit);
    emit LogMerkleRootDeregistered(_rootHash);
  }

  function autoChallengeTreeDepth(IAventusStorage _storage, bytes32 _leafHash, bytes32[] calldata _merklePath)
    external
  {
    bytes32 rootHash = generateMerkleRoot(_storage, _merklePath, _leafHash);
    require(merkleRootIsActive(_storage, rootHash), "Merkle root must be active");
    require(LMerkleRootsStorage.getTreeDepth(_storage, rootHash) < _merklePath.length + 1,
        "Challenged leaf must exist at a greater depth than declared by validator");

    finaliseAutoChallenge(_storage, rootHash);
    LMerkleRootsStorage.setTreeDepth(_storage, rootHash, _merklePath.length + 1);
    emit LogMerkleRootAutoChallenged(msg.sender, rootHash);
  }

  function autoChallengeLastEventTime(IAventusStorage _storage, uint _eventId, bytes calldata _remainingLeafData,
      bytes32[] calldata _merklePath)
    external
  {
    bytes32 rootHash = generateMerkleRoot(_storage, _merklePath, keccak256(abi.encodePacked(_eventId, _remainingLeafData)));
    require(merkleRootIsActive(_storage, rootHash), "Merkle root must be active");
    uint eventTime = getEventTime(_storage, _eventId);
    require(eventTime != 0 && eventTime > LMerkleRootsStorage.getLastEventTime(_storage, rootHash),
        "Challenged leaf must have a later event time than declared by validator");

    finaliseAutoChallenge(_storage, rootHash);
    setLastEventTime(_storage, rootHash, eventTime);
    emit LogMerkleRootAutoChallenged(msg.sender, rootHash);
  }

  function getNewMerkleRootDeposit(IAventusStorage _storage, uint _treeDepth, uint _lastEventTime)
    public
    view
    onlyValidTreeDepth(_storage, _treeDepth)
    returns (uint deposit_)
  {
    uint currentTime = LAventusTime.getCurrentTime(_storage);
    require(currentTime < _lastEventTime, "Last event time must be in the future");

    uint interveningEventTime = _lastEventTime - currentTime;
    require(interveningEventTime <= LMerkleRootsStorage.getMaxInterveningEventTime(_storage),
      "Last event time must not exceed the maximum allowed value");

    uint baseDeposit = LMerkleRootsStorage.getBaseDeposit(_storage);
    uint multiplier = LMerkleRootsStorage.getDepositMultiplier(_storage);
    // Overflow is avoided by checks on the input variables
    deposit_ = max(baseDeposit, (_treeDepth * interveningEventTime * multiplier));
  }

  function merkleRootIsActive(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (bool merkleRootIsActive_)
  {
    merkleRootIsActive_ = LMerkleRootsStorage.getRootHashOwner(_storage, _rootHash) != address(0);
  }

  // NOTE: IAventusStorage is not used here but is required for proxying
  function generateMerkleRoot(IAventusStorage, bytes32[] memory _merklePath, bytes32 _leafHash)
    public
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

  function finaliseAutoChallenge(IAventusStorage _storage, bytes32 _rootHash)
    private
  {
    uint deposit = LMerkleRootsStorage.getDeposit(_storage, _rootHash);

    if (deposit > 0) {
      // TODO: Increase validator's cooling off end time
      address rootHashOwner = LMerkleRootsStorage.getRootHashOwner(_storage, _rootHash);
      LMerkleRootsStorage.setDeposit(_storage, _rootHash, 0);
      LAVTManager.unlockDeposit(_storage, rootHashOwner, deposit);
      LAVTManager.decreaseAVT(_storage, rootHashOwner, deposit);
      LAVTManager.increaseAVT(_storage, msg.sender, deposit);
    }
  }

  function setLastEventTime(IAventusStorage _storage, bytes32 _rootHash, uint _lastEventTime)
    private
  {
    LMerkleRootsStorage.setLastEventTime(_storage, _rootHash, _lastEventTime);
    uint rootCoolingOffPeriod = LMerkleRootsStorage.getCoolingOffPeriod(_storage);
    LMembers.updateValidatorDeregistrationTimeIfNecessary(_storage, msg.sender, _lastEventTime + rootCoolingOffPeriod);
  }

  // TODO: Move this to LEvents once listTicket and hence cyclic dependency is removed
  function getEventTime(IAventusStorage _storage, uint _eventId)
    private
    view
    returns (uint eventTime_)
  {
    eventTime_ = _storage.getUInt(keccak256(abi.encodePacked("Event", _eventId, "eventTime")));
  }

  function max(uint _a, uint _b)
    private
    pure
    returns (uint max_)
  {
    max_ = _a;

    if (_b > max_) {
      max_ = _b;
    }
  }
}