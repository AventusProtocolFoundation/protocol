pragma solidity ^0.5.2;

import "./interfaces/IMerkleRootsManager.sol";
import "./interfaces/IAventusStorage.sol";
import "./libraries/LMerkleRoots.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract MerkleRootsManager is IMerkleRootsManager, Owned, Versioned {

    IAventusStorage public s;

    constructor(IAventusStorage _s) public {
      s = _s;
    }

    function registerMerkleRoot(bytes32 _rootHash, uint _treeDepth, uint _eventTime)
      external
    {
      LMerkleRoots.registerMerkleRoot(s, _rootHash, _treeDepth, _eventTime);
    }

    function deregisterMerkleRoot(bytes32 _rootHash)
      external
    {
      LMerkleRoots.deregisterMerkleRoot(s, _rootHash);
    }

    function getNewMerkleRootDeposit(uint _treeDepth, uint _lastEventTime)
      external
      view
      returns (uint deposit_)
    {
      deposit_ = LMerkleRoots.getNewMerkleRootDeposit(s, _treeDepth, _lastEventTime);
    }

    function autoChallengeTreeDepth(bytes32 _leafHash, bytes32[] calldata _merklePath)
      external
    {
      LMerkleRoots.autoChallengeTreeDepth(s, _leafHash, _merklePath);
    }

    function autoChallengeLastEventTime(uint _eventId, bytes calldata _remainingLeafContent, bytes32[] calldata _merklePath)
      external
    {
      LMerkleRoots.autoChallengeLastEventTime(s, _eventId, _remainingLeafContent, _merklePath);
    }
}
