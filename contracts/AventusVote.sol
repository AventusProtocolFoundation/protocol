pragma solidity ^0.4.19;

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
  event ToggleLockFreezeEvent(address indexed sender);
  event ThresholdUpdateEvent(address indexed sender, bool restricted, uint amount, uint balance);
  event CreateProposalEvent(address indexed sender, string desc, uint proposalId);
  event ProposalFinalisedEvent(uint proposalId, uint start, uint interval);
  event CastVoteEvent(uint proposalId, address indexed sender, bytes32 secret, uint prevTime);
  event RevealVoteEvent(uint proposalId, uint optId);
  event LogEndProposal(uint proposalId, uint votesFor, uint votesAgainst);
  event LogCreateEventChallenge(uint eventId, uint proposalId);

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param s_ Persistent storage contract
  */
  function AventusVote(IAventusStorage s_) public {
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

  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint _balance)
  {
    _balance = LLock.getBalance(s, _fund, _avtHolder);
  }

  function toggleLockFreeze()
    external
    onlyOwner
  {
    LLock.toggleLockFreeze(s);
    emit ToggleLockFreezeEvent(msg.sender);
  }

  function setThresholds(bool restricted, uint amount, uint balance)
    external
    onlyOwner
  {
    LLock.setThresholds(s, restricted, amount, balance);
    emit ThresholdUpdateEvent(msg.sender, restricted, amount, balance);
  }

  function getGovernanceProposalDeposit() view external returns (uint proposalDeposit) {
    proposalDeposit = LProposal.getGovernanceProposalDeposit(s);
  }

  function createGovernanceProposal(string desc) external returns (uint proposalId) {
    proposalId = LProposal.createGovernanceProposal(s, desc);
    emit CreateProposalEvent(msg.sender, desc, proposalId);
  }

  function getExistingEventDeposit(uint _eventId) external view returns(uint) {
    return LEvents.getExistingEventDeposit(s, _eventId);
  }

  function createEventChallenge(uint _eventId) external returns (uint _proposalId) {
    _proposalId = LProposal.createEventChallenge(s, _eventId);
    emit LogCreateEventChallenge(_eventId, _proposalId);
  }

  function finaliseProposal(uint proposalId, uint start, uint interval) external {
    LProposal.finaliseProposal(s, proposalId, start, interval);
    emit ProposalFinalisedEvent(proposalId, start, interval);
  }

  function endProposal(uint _proposalId) external {
    LProposal.endProposal(s, _proposalId);
    uint votesFor = s.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint(1)));
    uint votesAgainst = s.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint(2)));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst);
  }

  function getPrevTimeParamForCastVote(uint proposalId) external view returns (uint prevTime) {
    prevTime = LProposal.getPrevTimeParamForCastVote(s, proposalId);
  }

  function castVote(uint proposalId, bytes32 secret, uint prevTime) external {
    LProposal.castVote(s, proposalId, secret, prevTime);
    emit CastVoteEvent(proposalId, msg.sender, secret, prevTime);
  }

  function revealVote(uint proposalId, uint optId, uint8 v, bytes32 r, bytes32 s_) external {
    LProposal.revealVote(s, proposalId, optId, v, r, s_);
    emit RevealVoteEvent(proposalId, optId);
  }

  function updateStorage(IAventusStorage s_)
    external
    onlyOwner
  {
    s = s_;
  }

  function setStorageOwner(address owner_)
    external
    onlyOwner
  {
    Owned(s).setOwner(owner_);
  }
}
