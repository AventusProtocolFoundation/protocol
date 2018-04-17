pragma solidity ^0.4.19;

import "./PLibraryDelegate.sol";

contract PProposal is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LProposalInstance");
  }

}
