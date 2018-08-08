pragma solidity ^0.4.24;

import "../../interfaces/IAventusStorage.sol";

library LProposalForTesting {

  /// See IProposalsManager interface for events description
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd, uint deposit);

  function createGovernanceProposal(IAventusStorage, string) public returns (uint proposalId_) {
    proposalId_ = 2018;
    emit LogCreateProposal(msg.sender, "Test", proposalId_, 0, 0, 0, 0, 0);
  }

  function getGovernanceProposalDeposit(IAventusStorage) pure public returns (uint result_) {
    result_ = 10;
  }

  function endProposal(IAventusStorage, uint, string) public pure {
    // This method has a different set of input parameters to the original.
  }
}
