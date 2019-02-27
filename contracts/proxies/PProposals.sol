pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PProposals is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LProposalsInstance");
  }
}