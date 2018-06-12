pragma solidity ^0.4.24;

import './interfaces/IAventusStorage.sol';
import './interfaces/IAVTManager.sol';
import './interfaces/IProposalsManager.sol';
import './libraries/LEvents.sol';
import './libraries/LLock.sol';
import './libraries/LProposal.sol';
import './Owned.sol';

// TODO: Move all LLock methods into new AventusLock contract so, eg, making a deposit for
// events doesn't need to know about the AventusVote contract.
contract AventusVote is IAVTManager, IProposalsManager, Owned {
  // TODO: Consistent naming, eg make all event names start with "Log", or something similar.
  event WithdrawEvent(address indexed sender, string fund, uint amount);
  event DepositEvent(address indexed sender, string fund, uint amount);
  event CreateProposalEvent(address indexed sender, string desc, uint proposalId);
  event CastVoteEvent(uint proposalId, address indexed sender, bytes32 secret, uint prevTime);
  event RevealVoteEvent(uint proposalId, uint8 optId);
  event ClaimVoterWinningsEvent(uint proposalId);
  event LogEndProposal(uint proposalId, uint votesFor, uint votesAgainst);
  event LogCreateEventChallenge(uint eventId, uint proposalId);

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param s_ Persistent storage contract
  */
  constructor(IAventusStorage s_) public {
    s = s_;
  }

  function withdraw(string fund, uint amount) external {
    LLock.withdraw(s, fund, amount);
    emit WithdrawEvent(msg.sender, fund, amount);
  }

  function deposit(string fund, uint amount) external {
    LLock.deposit(s, fund, amount);
    emit DepositEvent(msg.sender, fund, amount);
  }

  function createGovernanceProposal(string desc) external returns (uint proposalId) {
    proposalId = LProposal.createGovernanceProposal(s, desc);
    emit CreateProposalEvent(msg.sender, desc, proposalId);
  }

  function createEventChallenge(uint _eventId) external returns (uint _proposalId) {
    _proposalId = LProposal.createEventChallenge(s, _eventId);
    emit LogCreateEventChallenge(_eventId, _proposalId);
  }

  function endProposal(uint _proposalId) external {
    LProposal.endProposal(s, _proposalId);
    uint votesFor = s.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint votesAgainst = s.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst);
  }

  function castVote(uint proposalId, bytes32 secret, uint prevTime) external {
    LProposal.castVote(s, proposalId, secret, prevTime);
    emit CastVoteEvent(proposalId, msg.sender, secret, prevTime);
  }

  function revealVote(uint proposalId, uint8 optId, uint8 v, bytes32 r, bytes32 s_) external {
    LProposal.revealVote(s, proposalId, optId, v, r, s_);
    emit RevealVoteEvent(proposalId, optId);
  }

  function claimVoterWinnings(uint _proposalId) external {
    LProposal.claimVoterWinnings(s, _proposalId);
    emit ClaimVoterWinningsEvent(_proposalId);
  }

  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint _balance)
  {
    _balance = LLock.getBalance(s, _fund, _avtHolder);
  }

  function getGovernanceProposalDeposit() external view returns (uint proposalDeposit) {
    proposalDeposit = LProposal.getGovernanceProposalDeposit(s);
  }

  function getExistingEventDeposit(uint _eventId) external view returns(uint) {
    return LEvents.getExistingEventDeposit(s, _eventId);
  }

  function getPrevTimeParamForCastVote(uint proposalId) external view returns (uint prevTime) {
    prevTime = LProposal.getPrevTimeParamForCastVote(s, proposalId);
  }
  
}
