pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LMembers.sol';
import './LAventities.sol';
import './LProposal.sol';

library LMerkleRoots {

  // See IMerkleRootsManager interface for logs description
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, string evidenceUrl, string desc,
      uint deposit);
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);
  event LogMerkleRootChallenged(bytes32 indexed rootHash, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd);
  event LogMerkleRootChallengeEnded(bytes32 indexed rootHash, uint indexed proposalId, uint votesFor, uint votesAgainst);

  bytes32 constant merkleRootCountKey = keccak256(abi.encodePacked("MerkleRootCount"));
  bytes32 constant fixedDepositAmountKey = keccak256(abi.encodePacked("MerkleRoots", "fixedDepositAmount"));

  modifier onlyActiveMerkleRoot(IAventusStorage _storage, bytes32 _rootHash) {
    require(
      merkleRootIsActive(_storage, _rootHash),
      "Merkle root must be active"
    );
    _;
  }

  modifier onlyActiveScalingProvider(IAventusStorage _storage, address _provider) {
    require(
      LMembers.memberIsActive(_storage, _provider, "ScalingProvider"),
      "Address must be an active scaling provider"
    );
    _;
  }

  modifier onlyIfNotAlreadyActive(IAventusStorage _storage, bytes32 _rootHash) {
    require(getAventityIdForMerkleRoot(_storage, _rootHash) == 0);
    _;
  }

  function deregisterMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    onlyActiveScalingProvider(_storage, msg.sender)
    onlyActiveMerkleRoot(_storage, _rootHash)
  {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    require(
      LAventities.getAventityDepositor(_storage, aventityId) == msg.sender,
      "Only the merkle root owner can deregister a merkle root"
    );
    LAventities.deregisterAventity(_storage, aventityId);
    removeMerkleRootAventityId(_storage, _rootHash);

    emit LogMerkleRootDeregistered(_rootHash);
  }

  function challengeMerkleRoot(IAventusStorage _storage, bytes32 _rootHash) external {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    uint proposalId = LAventities.challengeAventity(_storage, aventityId);
    (uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd) =
        LProposal.getTimestamps(_storage, proposalId);
    emit LogMerkleRootChallenged(_rootHash, proposalId, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function endMerkleRootChallenge(IAventusStorage _storage, bytes32 _rootHash)
    external
  {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    (uint proposalId, uint votesFor, uint votesAgainst, bool challengeWon) = LAventities.endAventityChallenge(_storage, aventityId);

    if (challengeWon) {
      removeMerkleRootAventityId(_storage, _rootHash);
    }

    emit LogMerkleRootChallengeEnded(_rootHash, proposalId, votesFor, votesAgainst);
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

  function getExistingMerkleRootDeposit(IAventusStorage _storage, bytes32 _rootHash)
    external
    view
    returns (uint merkleRootDeposit_)
  {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    merkleRootDeposit_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  function registerMerkleRoot(IAventusStorage _storage, address _ownerAddress, string _evidenceUrl, string _desc,
      bytes32 _rootHash)
    public
    onlyActiveScalingProvider(_storage, _ownerAddress)
    onlyIfNotAlreadyActive(_storage, _rootHash)
  {
    uint merkleRootDeposit = getNewMerkleRootDeposit(_storage);
    uint aventityId = LAventities.registerAventity(_storage, _ownerAddress, merkleRootDeposit);
    uint merkleRootCount = _storage.getUInt(merkleRootCountKey) + 1;

    _storage.setUInt(merkleRootCountKey, merkleRootCount);
    _storage.setUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")), aventityId);

    emit LogMerkleRootRegistered(_ownerAddress, _rootHash, _evidenceUrl, _desc, merkleRootDeposit);
  }

  function getNewMerkleRootDeposit(IAventusStorage _storage)
    public
    view
    returns (uint depositinAVT_)
  {
    uint depositInUSCents = _storage.getUInt(fixedDepositAmountKey);
    depositinAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function merkleRootIsActive(IAventusStorage _storage, bytes32 _rootHash) public view returns (bool merkleRootIsActive_) {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    merkleRootIsActive_ = LAventities.aventityIsActive(_storage, aventityId);
  }

  function getAventityIdForMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")));
  }

  function removeMerkleRootAventityId(IAventusStorage _storage, bytes32 _rootHash) private {
    _storage.setUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")), 0);
  }
}