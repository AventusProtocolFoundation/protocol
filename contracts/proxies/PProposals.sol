pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PProposals is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LProposalsInstance");
  }

}