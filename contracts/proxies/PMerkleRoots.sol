pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PMerkleRoots is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LMerkleRootsInstance");
  }

}
