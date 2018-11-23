pragma solidity ^0.4.24;

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

    function registerMerkleRoot(bytes32 _rootHash)
      external
    {
      LMerkleRoots.registerMerkleRoot(s, _rootHash);
    }
}
