pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PMerkleRoots is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LMerkleRootsInstance");
  }

}
