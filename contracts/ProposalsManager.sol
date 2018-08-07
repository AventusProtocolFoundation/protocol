pragma solidity ^0.4.24;

import './interfaces/IAventusStorage.sol';
import './interfaces/IProposalsManager.sol';
import './libraries/LEvents.sol';
import './libraries/LProposal.sol';
import './Owned.sol';
import './Versioned.sol';

contract ProposalsManager is IProposalsManager, Owned, Versioned {

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param _s Persistent storage contract
  */
  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function createGovernanceProposal(string _desc) external returns (uint proposalId_) {
    proposalId_ = LProposal.createGovernanceProposal(s, _desc);
  }

  function createEventChallenge(uint _eventId) external returns (uint proposalId_) {
    proposalId_ = LProposal.createEventChallenge(s, _eventId);
  }

  function createAventityChallenge(uint _aventityId) external returns (uint challengeProposalId_) {
    challengeProposalId_ = LProposal.createAventityChallenge(s, _aventityId);
  }

  function endProposal(uint _proposalId) external {
    LProposal.endProposal(s, _proposalId);
  }

  function castVote(uint _proposalId, bytes32 _secret, uint _prevTime) external {
    LProposal.castVote(s, _proposalId, _secret, _prevTime);
  }

  function revealVote(bytes _signedMessage, uint _proposalId, uint8 _optId) external {
    LProposal.revealVote(s, _signedMessage, _proposalId, _optId);
  }

  function claimVoterWinnings(uint _proposalId) external {
    LProposal.claimVoterWinnings(s, _proposalId);
  }

  function getGovernanceProposalDeposit() external view returns (uint proposalDeposit_) {
    proposalDeposit_ = LProposal.getGovernanceProposalDeposit(s);
  }

  function getExistingEventDeposit(uint _eventId) external view returns(uint eventDeposit_) {
    eventDeposit_ = LEvents.getExistingEventDeposit(s, _eventId);
  }

  function getPrevTimeParamForCastVote(uint _proposalId) external view returns (uint prevTime_) {
    prevTime_ = LProposal.getPrevTimeParamForCastVote(s, _proposalId);
  }

}
