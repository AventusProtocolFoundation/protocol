pragma solidity ^0.4.19;

import './interfaces/IAventusStorage.sol';
import './libraries/LLock.sol';
import './libraries/LProposal.sol';
import './Owned.sol';

contract AventusVote is Owned {
  event WithdrawEvent(address indexed sender, uint amount);
  event DepositEvent(address indexed sender, uint amount);
  event ToggleLockFreezeEvent(address indexed sender);
  event ThresholdUpdateEvent(address indexed sender, bool restricted, uint amount, uint balance);
  event CreateProposalEvent(address indexed sender, string desc, uint proposalId);
  event AddProposalOptionEvent(uint proposalId, string option);
  event ProposalFinalisedEvent(uint proposalId, uint start, uint interval);
  event CastVoteEvent(uint proposalId, address indexed sender, bytes32 secret, uint prevTime);
  event RevealVoteEvent(uint proposalId, uint optId);

  modifier onlyProposalCreator(uint proposalId) {
    require (msg.sender == s.getAddress(keccak256("Proposal", proposalId, "creator")));
    _;
  }

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param s_ Persistent storage contract
  */
  function AventusVote(IAventusStorage s_) public {
    s = s_;
  }

  /**
  * @dev Withdraw locked, staked AVT not used in an active vote
  * @param amount Amount to withdraw from lock
  */
  function withdraw(uint amount) public {
    LLock.withdraw(s, msg.sender, amount);
    WithdrawEvent(msg.sender, amount);
  }

  /**
  * @dev Deposit & lock AVT for stake weighted votes
  * @param amount Amount to withdraw from lock
  */
  function deposit(uint amount) public {
    LLock.deposit(s, msg.sender, amount);
    DepositEvent(msg.sender, amount);
  }

  // @dev Toggle the ability to lock funds for staking (For security)
  function toggleLockFreeze()
    public
    onlyOwner
  {
    LLock.toggleLockFreeze(s);
    ToggleLockFreezeEvent(msg.sender);
  }

  /**
  * @dev Set up safety controls for initial release of voting
  * @param restricted True if we are in restricted mode
  * @param amount Maximum amount of AVT any account can lock up at a time
  * @param balance Maximum amount of AVT that can be locked up in total
  */
  function setThresholds(bool restricted, uint amount, uint balance)
    public
    onlyOwner
  {
    LLock.setThresholds(s, restricted, amount, balance);
    ThresholdUpdateEvent(msg.sender, restricted, amount, balance);
  }

  /**
  * @dev Create a proposal to be voted on
  * @param desc Either just a title or a pointer to IPFS details
  * @return uint proposalID of newly created proposal
  */
  function createProposal(string desc) public returns (uint proposalId) {
    proposalId = LProposal.createProposal(s, msg.sender, desc);
    CreateProposalEvent(msg.sender, desc, proposalId);
  }

  /**
  * @dev Add an option to a proposal that voters can choose
  * @param proposalId Proposal ID
  * @param option Description of option
  */
  function addProposalOption(uint proposalId, string option)
    public
    onlyProposalCreator(proposalId)
  {
    LProposal.addProposalOption(s, proposalId, option);
    AddProposalOptionEvent(proposalId, option);
  }

  /**
  * @dev Finish setting up proposal with time intervals & start
  * @param proposalId Proposal ID
  * @param start The start date of the cooldown period, after which voting on proposal starts
  * @param interval The amount of time the vote and reveal periods last for
  */
  function finaliseProposal(uint proposalId, uint start, uint interval)
    public
    onlyProposalCreator(proposalId)
  {
    LProposal.finaliseProposal(s, proposalId, start, interval);
    ProposalFinalisedEvent(proposalId, start, interval);
  }

  /**
  * @dev Cast a vote on one of a given proposal's options
  * @param proposalId Proposal ID
  * @param secret The secret vote: Sha3(signed Sha3(option ID))
  * @param prevTime The previous revealStart time that locked the user's funds
  */
  function castVote(uint proposalId, bytes32 secret, uint prevTime) public {
    LProposal.castVote(s, proposalId, msg.sender, secret, prevTime);
    CastVoteEvent(proposalId, msg.sender, secret, prevTime);
  }

  /**
  * @dev Reveal a vote on a proposal
  * @param proposalId Proposal ID
  * @param optId ID of option that was voted on
  * @param v User's ECDSA signature(keccak(optID)) v value
  * @param r User's ECDSA signature(keccak(optID)) r value
  * @param s_ User's ECDSA signature(keccak(optID)) s value
  */
  function revealVote(uint proposalId, uint optId, uint8 v, bytes32 r, bytes32 s_) public {
    LProposal.revealVote(s, proposalId, optId, v, r, s_);
    RevealVoteEvent(proposalId, optId);
  }


  /**
  * @dev Upgrade Storage if necessary
  * @param s_ New Storage instance
  */
  function updateStorage(IAventusStorage s_)
    public
    onlyOwner
  {
    s = s_;
  }

  /**
  * @dev Update the owner of the storage contract
  * @param owner_ New Owner of the storage contract
  */
  function setStorageOwner(address owner_)
    public
    onlyOwner
  {
    Owned(s).setOwner(owner_);
  }
}
