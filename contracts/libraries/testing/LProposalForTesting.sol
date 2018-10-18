pragma solidity ^0.4.24;

import "../../interfaces/IAventusStorage.sol";

library LProposalForTesting {

  /// See IProposalsManager interface for events description
  event LogGovernanceProposalCreated(uint indexed proposalId, address indexed sender, string desc, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd, uint deposit);

  function createGovernanceProposal(IAventusStorage, string) public returns (uint proposalId_) {
    proposalId_ = 2018;
    emit LogGovernanceProposalCreated(proposalId_, msg.sender, "Test", 0, 0, 0, 0, 0);
  }

  function getGovernanceProposalDeposit(IAventusStorage) pure public returns (uint result_) {
    result_ = 10;
  }

  function endGovernanceProposal(IAventusStorage, uint, string) public pure {
    // This method has a different set of input parameters to the original.
  }
}
