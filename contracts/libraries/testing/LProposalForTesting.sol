pragma solidity ^0.4.24;

import "../../interfaces/IAventusStorage.sol";

library LProposalForTesting {
  function createGovernanceProposal(IAventusStorage, string) pure public returns (uint result_) {
    result_ = 2018;
  }

  function getGovernanceProposalDeposit(IAventusStorage) pure public returns (uint result_) {
    result_ = 10;
  }

  function endProposal(IAventusStorage, uint, string) pure public {
    // This method has a different set of input parameters to the original.
  }
}
