pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PProposal is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LProposalInstance");
  }

}
