pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LValidators.sol";
import "./LMerkleRootsStorage.sol";
import "./LAventusTime.sol";
import "./LAVTManager.sol";
import "./LEvents.sol";

library LMerkleRoots {

  // See IMerkleRootsManager interface for logs description
  event LogMerkleRootRegistered(address indexed rootOwner, bytes32 indexed rootHash, uint treeDepth, uint rootExpiryTime,
      uint rootDeposit, string treeContentURL);
  event LogMerkleRootDeregistered(address indexed rootOwner, bytes32 indexed rootHash);
  event LogMerkleRootAutoChallenged(address indexed rootOwner, bytes32 indexed rootHash, address indexed challenger);

  modifier onlyRegisteredValidator(IAventusStorage _storage) {
    require(LValidators.isRegistered(_storage, msg.sender), "Sender must be a registered validator");
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

  modifier onlyAfterDeregistrationTime(IAventusStorage _storage, bytes32 _rootHash) {
    uint timeNow = LAventusTime.getCurrentTime(_storage);
    require(timeNow >= getRootDeregistrationTime(_storage, _rootHash), "Must be after cooling off period");
    _;
  }

  modifier onlyWithinChallengeWindow(IAventusStorage _storage, bytes32 _rootHash) {
    uint timeNow = LAventusTime.getCurrentTime(_storage);
    // TODO: PRODUCT_DECISION: Consider paying out reward and locking down entire protocol if this require is hit
    require(timeNow < LMerkleRootsStorage.getRootChallengeExpiryTime(_storage, _rootHash), "Challenge window expired");
    _;
  }

  modifier onlyValidTreeDepth(IAventusStorage _storage, uint _treeDepth) {
    require(_treeDepth != 0, "Tree depth cannot be zero");
    bool validTreeDepth = _treeDepth <= LMerkleRootsStorage.getMaxTreeDepth(_storage);
    require(validTreeDepth, "Tree depth must not exceed the maximum allowed value");
    _;
  }

  function registerMerkleRoot(IAventusStorage _storage, bytes32 _rootHash, uint _treeDepth, uint _rootExpiryTime,
      string calldata _treeContentURL)
    external
    onlyRegisteredValidator(_storage)
    onlyIfNotAlreadyActive(_storage, _rootHash)
  {
    require(bytes(_treeContentURL).length != 0, "Tree content URL must not be empty");

    uint deposit = getNewMerkleRootDeposit(_storage, _treeDepth, _rootExpiryTime);
    LAVTManager.lockDeposit(_storage, msg.sender, deposit);

    uint currentTime = LAventusTime.getCurrentTime(_storage);
    LMerkleRootsStorage.setRootRegistrationTime(_storage, _rootHash, currentTime);
    LMerkleRootsStorage.setRootOwner(_storage, _rootHash, msg.sender);
    LMerkleRootsStorage.setTreeDepth(_storage, _rootHash, _treeDepth);
    LMerkleRootsStorage.setDeposit(_storage, _rootHash, deposit);
    setRootExpiryTime(_storage, _rootHash, _rootExpiryTime);

    emit LogMerkleRootRegistered(msg.sender, _rootHash, _treeDepth, _rootExpiryTime, deposit, _treeContentURL);
  }

  // TODO: PRODUCT_DECISION: Consider making this possible only if the validator is registered
  function deregisterMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    onlyActive(_storage, _rootHash)
    onlyAfterDeregistrationTime(_storage, _rootHash)
  {
    uint deposit = LMerkleRootsStorage.getDeposit(_storage, _rootHash);
    address rootOwner = LMerkleRootsStorage.getRootOwner(_storage, _rootHash);
    LMerkleRootsStorage.setRootOwner(_storage, _rootHash, address(0));
    LMerkleRootsStorage.setDeposit(_storage, _rootHash, 0);

    LAVTManager.unlockDeposit(_storage, rootOwner, deposit);
    emit LogMerkleRootDeregistered(rootOwner, _rootHash);
  }

  function autoChallengeTreeDepth(IAventusStorage _storage, bytes32 _leafHash, bytes32[] calldata _merklePath)
    external
  {
    bytes32 rootHash = generateMerkleRoot(_storage, _merklePath, _leafHash);
    require(merkleRootIsActive(_storage, rootHash), "Merkle root must be active");
    bool validChallenge = LMerkleRootsStorage.getTreeDepth(_storage, rootHash) < _merklePath.length + 1;
    require(validChallenge, "Challenged leaf must exist at a greater depth than declared by validator");

    finaliseAutoChallenge(_storage, rootHash);
    LMerkleRootsStorage.setTreeDepth(_storage, rootHash, _merklePath.length + 1);
    address rootOwner = getRootOwner(_storage, rootHash);
    emit LogMerkleRootAutoChallenged(rootOwner, rootHash, msg.sender);
  }

  function autoChallengeRootExpiryTime(IAventusStorage _storage, bytes calldata _encodedLeaf, bytes32[] calldata _merklePath)
    external
  {
    bytes32 rootHash = generateMerkleRoot(_storage, _merklePath, keccak256(abi.encodePacked(_encodedLeaf)));
    require(merkleRootIsActive(_storage, rootHash), "Merkle root must be active");
    (/* transactionType */, bytes memory immutableData, /* mutableData */, /* provenance */) =
        abi.decode(_encodedLeaf, (string, bytes, bytes, bytes));
    (uint eventId, /* vendorTicketRef */, /* vendor */, /* immutableRulesData */) =
        abi.decode(immutableData, (uint, string, address, bytes));
    uint eventTime = LEvents.getEventTime(_storage, eventId);
    bool validChallenge = eventTime > LMerkleRootsStorage.getRootExpiryTime(_storage, rootHash);
    require(validChallenge, "Challenged leaf must have a later event time than declared by validator");

    finaliseAutoChallenge(_storage, rootHash);
    setRootExpiryTime(_storage, rootHash, eventTime);
    address rootOwner = getRootOwner(_storage, rootHash);
    emit LogMerkleRootAutoChallenged(rootOwner, rootHash, msg.sender);
  }

  function getRootRegistrationTime(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint registrationTime_)
  {
    registrationTime_ = LMerkleRootsStorage.getRootRegistrationTime(_storage, _rootHash);
  }

  function getRootDeregistrationTime(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (uint deregistrationTime_)
  {
    uint rootExpiryTime = LMerkleRootsStorage.getRootExpiryTime(_storage, _rootHash);
    uint coolingOffPeriod = LMerkleRootsStorage.getCoolingOffPeriod(_storage);
    deregistrationTime_ = rootExpiryTime + coolingOffPeriod;
  }

  function getNewMerkleRootDeposit(IAventusStorage _storage, uint _treeDepth, uint _rootExpiryTime)
    public
    view
    onlyValidTreeDepth(_storage, _treeDepth)
    returns (uint deposit_)
  {
    uint currentTime = LAventusTime.getCurrentTime(_storage);
    require(currentTime < _rootExpiryTime, "Root expiry time must be in the future");

    uint interveningTime = _rootExpiryTime - currentTime;
    bool validRootExpiryTime = interveningTime <= LMerkleRootsStorage.getMaxInterveningTime(_storage);
    require(validRootExpiryTime, "Last event time must not exceed the maximum allowed value");

    uint baseDeposit = LMerkleRootsStorage.getBaseDeposit(_storage);
    uint multiplier = LMerkleRootsStorage.getDepositMultiplier(_storage);
    // Overflow is avoided by checks on the input variables
    deposit_ = max(baseDeposit, (_treeDepth * interveningTime * multiplier));
  }

  function merkleRootIsActive(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (bool merkleRootIsActive_)
  {
    merkleRootIsActive_ = LMerkleRootsStorage.getRootOwner(_storage, _rootHash) != address(0);
  }

  function getRootOwner(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (address rootOwner_)
  {
    rootOwner_ = LMerkleRootsStorage.getRootOwner(_storage, _rootHash);
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

      if (computedHash < pathElement)
        computedHash = keccak256(abi.encodePacked(computedHash, pathElement));
      else
        computedHash = keccak256(abi.encodePacked(pathElement, computedHash));
    }

    rootHash_ = computedHash;
  }

  // TODO: PRODUCT_DECISION: Consider invalidating (and possibly rolling back) root
  function finaliseAutoChallenge(IAventusStorage _storage, bytes32 _rootHash)
    public
    onlyWithinChallengeWindow(_storage, _rootHash)
    returns (address RootOwner_)
  {
    uint deposit = LMerkleRootsStorage.getDeposit(_storage, _rootHash);
    RootOwner_ = LMerkleRootsStorage.getRootOwner(_storage, _rootHash);

    if (deposit != 0) {
      LValidators.validatorFailedRootChallenge(_storage, RootOwner_);
      LMerkleRootsStorage.setDeposit(_storage, _rootHash, 0);
      LAVTManager.unlockDeposit(_storage, RootOwner_, deposit);
      LAVTManager.decreaseAVT(_storage, RootOwner_, deposit);
      LAVTManager.increaseAVT(_storage, msg.sender, deposit);
    }
  }

  function setRootExpiryTime(IAventusStorage _storage, bytes32 _rootHash, uint _rootExpiryTime)
    private
  {
    LMerkleRootsStorage.setRootExpiryTime(_storage, _rootHash, _rootExpiryTime);
    LValidators.updateExpiryTimeIfNecessary(_storage, LMerkleRootsStorage.getRootOwner(_storage, _rootHash), _rootExpiryTime);
  }

  function max(uint _a, uint _b)
    private
    pure
    returns (uint)
  {
    if (_b > _a)
      return _b;
    else
      return _a;
  }
}