pragma solidity ^0.4.19;

import "../../interfaces/IAventusStorage.sol";

library LProposalForTesting {
  function createGovernanceProposal(IAventusStorage, string) pure public returns (uint) {
    return 2018;
  }

  function getGovernanceProposalDeposit(IAventusStorage) pure public returns (uint) {
    return 10;
  }

  function endProposal(IAventusStorage, uint, string) pure public {
    // This method has a different set of input parameters to the original.
  }
}
