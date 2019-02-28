pragma solidity ^0.5.2;

import "./interfaces/IAventusStorage.sol";
import "./interfaces/IProposalsManager.sol";
import "./libraries/LEvents.sol";
import "./libraries/LProposals.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract ProposalsManager is IProposalsManager, Owned, Versioned {

  IAventusStorage public s;

  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function createGovernanceProposal(string calldata _desc)
    external
  {
    LProposals.createGovernanceProposal(s, _desc);
  }

  function endGovernanceProposal(uint _proposalId)
    external
  {
    LProposals.endGovernanceProposal(s, _proposalId);
  }

  function castVote(uint _proposalId, bytes32 _secret, uint _prevTime)
    external
  {
    LProposals.castVote(s, _proposalId, _secret, _prevTime);
  }

  function cancelVote(uint _proposalId)
    external
  {
    LProposals.cancelVote(s, _proposalId);
  }

  function revealVote(bytes calldata _signedMessage, uint _proposalId, uint _optId)
    external
  {
    LProposals.revealVote(s, _signedMessage, _proposalId, _optId);
  }

  function claimVoterWinnings(uint _proposalId)
    external
  {
    LAventities.claimVoterWinnings(s, _proposalId);
  }

  function getGovernanceProposalDeposit() external view returns (uint proposalDeposit_) {
    proposalDeposit_ = LProposals.getGovernanceProposalDeposit(s);
  }

  function getPrevTimeParamForCastVote(uint _proposalId) external view returns (uint prevTime_) {
    prevTime_ = LProposals.getPrevTimeParamForCastVote(s, _proposalId);
  }

  function getAventusTime() external view returns (uint time_) {
    time_ = LProposals.getAventusTime(s);
  }
}