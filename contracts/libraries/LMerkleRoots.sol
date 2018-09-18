pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LMembers.sol';

library LMerkleRoots {

  /// See IMerkleRootsManager interface for events description
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, string evidenceUrl, string desc, uint deposit);
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);

  bytes32 constant merkleRootCountKey = keccak256(abi.encodePacked("MerkleRootCount"));

  modifier onlyActiveMerkleRoot(IAventusStorage _storage, bytes32 _rootHash) {
    require(
      merkleRootIsActive(_storage, _rootHash),
      "Merkle root must be active"
    );
    _;
  }

  modifier onlyMerkleRootOwner(IAventusStorage _storage, bytes32 _rootHash) {
    require(
      msg.sender == _storage.getAddress(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "ownerAddress"))),
      "Function must be called by owner"
    );
    _;
  }

  modifier onlyActiveScalingProvider(IAventusStorage _storage, address _provider) {
    require(
      // TODO: replace this check with LMembers.memberIsActive(_storage, _provider, "ScalingProvider") when we support challenging scaling providers
      LMembers.memberIsRegistered(_storage, _provider, "ScalingProvider"),
      "Address must be a registered scaling provider"
    );
    _;
  }

  modifier onlyIfNotAlreadyRegistered(IAventusStorage _storage, bytes32 _rootHash) {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    if (aventityId != 0) {
      require(
        !LAventities.aventityIsRegistered(_storage, aventityId),
        "Root hash must not have been registered yet"
      );
    }
    _;
  }

  function deregisterMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    onlyActiveScalingProvider(_storage, msg.sender)
    onlyMerkleRootOwner(_storage, _rootHash)
    onlyActiveMerkleRoot(_storage, _rootHash)
  {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    LAventities.deregisterAventity(_storage, aventityId);
    emit LogMerkleRootDeregistered(_rootHash);
  }

  function challengeMerkleRoot(IAventusStorage _storage, bytes32 _rootHash)
    external
    returns (uint challengeProposalId_)
  {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    challengeProposalId_ = LAventities.challengeAventity(_storage, aventityId);
    LProposal.emitLogMerkleRootChallenged(_storage, _rootHash, challengeProposalId_);
  }

  function getExistingMerkleRootDeposit(IAventusStorage _storage, bytes32 _rootHash) external view returns (uint merkleRootDeposit_) {
    uint aventityId = getAventityIdForMerkleRoot(_storage, _rootHash);
    merkleRootDeposit_ = LAventities.getExistingAventityDeposit(_storage, aventityId);
  }

  function registerMerkleRoot(IAventusStorage _storage, address _ownerAddress, string _evidenceUrl, string _desc, bytes32 _rootHash)
    public
    onlyActiveScalingProvider(_storage, _ownerAddress)
    onlyIfNotAlreadyRegistered(_storage, _rootHash)
  {
    uint merkleRootDeposit = getNewMerkleRootDeposit(_storage);
    uint aventityId = LAventities.registerAventity(_storage, _ownerAddress, merkleRootDeposit);
    uint merkleRootCount = _storage.getUInt(merkleRootCountKey) + 1;

    _storage.setUInt(merkleRootCountKey, merkleRootCount);
    _storage.setUInt(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "aventityId")), aventityId);
    _storage.setAddress(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "ownerAddress")), _ownerAddress);

    emit LogMerkleRootRegistered(_ownerAddress, _rootHash, _evidenceUrl, _desc, merkleRootDeposit);
  }

  function getNewMerkleRootDeposit(IAventusStorage _storage)
    public
    view
    returns (uint depositinAVT_)
  {
    uint depositInUSCents = _storage.getUInt(keccak256(abi.encodePacked("MerkleRoots", "fixedDepositAmount")));
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

  function getMerkleRootOwner(IAventusStorage _storage, bytes32 _rootHash)
    public
    view
    returns (address merkleRootOwner_)
  {
    merkleRootOwner_ = _storage.getAddress(keccak256(abi.encodePacked("MerkleRoot", _rootHash, "ownerAddress")));
  }

  // NOTE: IAventusStorage is not used here but is required for proxying
  function generateMerkleRoot(IAventusStorage, bytes32[] _merklePath, bytes32 _leaf)
    external
    pure
    returns (bytes32 rootHash_)
  {
    bytes32 computedHash = _leaf;

    for (uint i = 0; i < _merklePath.length; i++) {
      bytes32 pathElement = _merklePath[i];

      if (computedHash < pathElement) {
        // Hash(current computed hash + current path element)
        computedHash = keccak256(abi.encodePacked(computedHash, ":", pathElement));
      } else {
        // Hash(current element of the path + current computed hash)
        computedHash = keccak256(abi.encodePacked(pathElement, ":", computedHash));
      }
    }

    rootHash_ = computedHash;
  }

}