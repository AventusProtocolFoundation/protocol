pragma solidity ^0.4.19;

import "./PDelegate.sol";

contract PProposal is PDelegate {

  function () payable public {
    initProxy("LProposalInstance");
  }

}
