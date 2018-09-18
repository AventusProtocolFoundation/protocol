pragma solidity ^0.4.24;

import './interfaces/IMerkleRootsManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LMerkleRoots.sol';
import './Owned.sol';
import './Versioned.sol';

contract MerkleRootsManager is IMerkleRootsManager, Owned, Versioned {

    IAventusStorage public s;

    /**
    * @dev Constructor
    * @param _s Persistent storage contract
    */
    constructor(IAventusStorage _s) public {
      s = _s;
    }

    function registerMerkleRoot(address _ownerAddress, string _evidenceUrl, string _desc, bytes32 _rootHash)
      external
    {
      LMerkleRoots.registerMerkleRoot(s, _ownerAddress, _evidenceUrl, _desc, _rootHash);
    }

    function deregisterMerkleRoot(bytes32 _rootHash)
      external
    {
      LMerkleRoots.deregisterMerkleRoot(s, _rootHash);
    }

    function challengeMerkleRoot(bytes32 _rootHash)
      external
      returns (uint proposalId_)
    {
      proposalId_ = LMerkleRoots.challengeMerkleRoot(s, _rootHash);
    }

    function merkleRootIsActive(bytes32 _rootHash)
      external
      view
      returns (bool isActive_)
    {
      isActive_ = LMerkleRoots.merkleRootIsActive(s, _rootHash);
    }

    function getNewMerkleRootDeposit() external view returns (uint merkleRootDepositInAVT_) {
      merkleRootDepositInAVT_ = LMerkleRoots.getNewMerkleRootDeposit(s);
    }

    function getExistingMerkleRootDeposit(bytes32 _rootHash) external view returns (uint merkleRootDepositInAVT_) {
      merkleRootDepositInAVT_ = LMerkleRoots.getExistingMerkleRootDeposit(s, _rootHash);
    }

    function generateMerkleRoot(bytes32[] _merklePath, bytes32 _leaf)
      external
      view
      returns (bytes32 rootHash_)
    {
      rootHash_ = LMerkleRoots.generateMerkleRoot(s, _merklePath, _leaf);
    }
}
