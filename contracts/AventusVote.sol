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
  * @param _s Persistent storage contract
  */
  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function withdraw(string _fund, uint _amount) external {
    LLock.withdraw(s, _fund, _amount);
    emit WithdrawEvent(msg.sender, _fund, _amount);
  }

  function deposit(string _fund, uint _amount) external {
    LLock.deposit(s, _fund, _amount);
    emit DepositEvent(msg.sender, _fund, _amount);
  }

  function createGovernanceProposal(string _desc) external returns (uint proposalId_) {
    proposalId_ = LProposal.createGovernanceProposal(s, _desc);
    emit CreateProposalEvent(msg.sender, _desc, proposalId_);
  }

  function createEventChallenge(uint _eventId) external returns (uint proposalId_) {
    proposalId_ = LProposal.createEventChallenge(s, _eventId);
    emit LogCreateEventChallenge(_eventId, proposalId_);
  }

  function endProposal(uint _proposalId) external {
    LProposal.endProposal(s, _proposalId);
    uint votesFor = s.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint votesAgainst = s.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst);
  }

  function castVote(uint _proposalId, bytes32 _secret, uint _prevTime) external {
    LProposal.castVote(s, _proposalId, _secret, _prevTime);
    emit CastVoteEvent(_proposalId, msg.sender, _secret, _prevTime);
  }

  function revealVote(bytes _signedMessage, uint _proposalId, uint8 _optId) external {
    LProposal.revealVote(s, _signedMessage, _proposalId, _optId);
    emit RevealVoteEvent(_proposalId, _optId);
  }

  function claimVoterWinnings(uint _proposalId) external {
    LProposal.claimVoterWinnings(s, _proposalId);
    emit ClaimVoterWinningsEvent(_proposalId);
  }

  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint balance_)
  {
    balance_ = LLock.getBalance(s, _fund, _avtHolder);
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
