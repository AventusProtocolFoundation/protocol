pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LProposalsEnact.sol";
import "./LProposalsVoting.sol";
import "./LProposalsStorage.sol";

// Library for extending voting protocol functionality
library LProposals {

  // See IProposalsManager interface for logs description.
  event LogGovernanceProposalCreated(uint indexed proposalId, address indexed sender, string desc, uint lobbyingStart,
      uint votingStart, uint revealingStart, uint revealingEnd, uint deposit);
  event LogVoteCast(uint indexed proposalId, address indexed sender, bytes32 secret, uint prevTime);
  event LogVoteCancelled(uint indexed proposalId, address indexed sender);
  event LogVoteRevealed(uint indexed proposalId, address indexed sender, uint indexed optId, uint revealingStart,
      uint revealingEnd);
  event LogGovernanceProposalEnded(uint indexed proposalId, uint votesFor, uint votesAgainst);

  // Verify a proposal's status (see LProposalsEnact.doGetProposalStatus for values)
  modifier onlyInVotingPeriod(IAventusStorage _storage, uint _proposalId) {
    require(LProposalsEnact.inVotingPeriod(_storage, _proposalId), "Proposal has the wrong status");
    _;
  }

  modifier onlyAfterRevealingFinishedAndProposalNotEnded(IAventusStorage _storage, uint _proposalId) {
    require(LProposalsEnact.afterRevealingFinishedAndProposalNotEnded(_storage, _proposalId), "Proposal has the wrong status");
    _;
  }

  modifier onlyGovernanceProposals(IAventusStorage _storage, uint _proposalId) {
    require(LProposalsStorage.isGovernanceProposal(_storage, _proposalId), "Proposal is not a governance proposal");
    _;
  }

  function createGovernanceProposal(IAventusStorage _storage, string calldata _desc)
    external
  {
    uint deposit = getGovernanceProposalDeposit(_storage);
    uint proposalId = doCreateGovernanceProposal(_storage, deposit);
    (uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd) = getTimestamps(_storage, proposalId);

    // set a flag to mark this proposal as a governance proposal
    LProposalsStorage.setGovernanceProposal(_storage, proposalId);

    emit LogGovernanceProposalCreated(proposalId, msg.sender, _desc, lobbyingStart, votingStart, revealingStart, revealingEnd,
        deposit);
  }

  function createProposal(IAventusStorage _storage, uint deposit, uint numDaysInLobbyingPeriod, uint numDaysInVotingPeriod,
      uint numDaysInRevealingPeriod)
    external
    returns (uint proposalId_)
  {
    proposalId_ = LProposalsEnact.doCreateProposal(_storage, deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
  }

  function castVote(IAventusStorage _storage, uint _proposalId, bytes32 _secret, uint _prevTime)
    external
    onlyInVotingPeriod(_storage, _proposalId) // Ensure voting period is currently active
  {
    LProposalsVoting.castVote(_storage, _proposalId, _secret, _prevTime);
    emit LogVoteCast(_proposalId, msg.sender, _secret, _prevTime);
  }

  function cancelVote(IAventusStorage _storage, uint _proposalId)
    external
  {
    LProposalsVoting.cancelVote(_storage, _proposalId);
    emit LogVoteCancelled(_proposalId, msg.sender);
  }

  function revealVote(IAventusStorage _storage, bytes calldata _signedMessage, uint _proposalId, uint _optId)
    external
  {
    LProposalsVoting.revealVote(_storage, _signedMessage, _proposalId, _optId);
    uint revealingStart = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    uint revealingEnd = LProposalsStorage.getRevealingEnd(_storage, _proposalId);
    emit LogVoteRevealed(_proposalId, msg.sender, _optId, revealingStart, revealingEnd);
  }

  function endGovernanceProposal(IAventusStorage _storage, uint _proposalId)
    external
    onlyGovernanceProposals(_storage, _proposalId)
  {
    (uint votesFor, uint votesAgainst) = endProposal(_storage, _proposalId);
    emit LogGovernanceProposalEnded(_proposalId, votesFor, votesAgainst);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint prevTime_)
  {
    prevTime_ = LProposalsVoting.getPrevTimeParamForCastVote(_storage, _proposalId);
  }

  function getAventusTime(IAventusStorage _storage)
    external
    view
    returns (uint time_)
  {
    time_ = LAventusTime.getCurrentTime(_storage);
  }

  function getTotalRevealedStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint totalStake_)
  {
    totalStake_ = LProposalsStorage.getTotalRevealedStake(_storage, _proposalId, _optionId);
  }

  function getOwner(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (address owner_)
  {
    owner_ = LProposalsStorage.getOwner(_storage, _proposalId);
  }

  function getRevealedVoterStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId)
    external
    view
    returns (uint stake_)
  {
    stake_ = LProposalsStorage.getRevealedVoterStake(_storage, _proposalId, _voter, _optionId);
  }

  function clearRevealedStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId)
    external
  {
    LProposalsStorage.setRevealedVoterStake(_storage, _proposalId, _voter, _optionId, 0);
  }

  function getNumVotersRevealedWithStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint numRevealedVoters_)
  {
    numRevealedVoters_ = LProposalsStorage.getNumVotersRevealedWithStake(_storage, _proposalId, _optionId);
  }

  function getWinningProposalOption(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningOption_)
  {
    winningOption_ = LProposalsStorage.getWinningProposalOption(_storage, _proposalId);
  }

  function setWinningProposalOption(IAventusStorage _storage, uint _proposalId, uint _winningOption)
    external
  {
    LProposalsStorage.setWinningProposalOption(_storage, _proposalId, _winningOption);
  }

  function getTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsToVoters_)
  {
    winningsToVoters_ = LProposalsStorage.getTotalWinningsToVoters(_storage, _proposalId);
  }

  function setTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId, uint _winningsToVoters)
    external
  {
    LProposalsStorage.setTotalWinningsToVoters(_storage, _proposalId, _winningsToVoters);
  }

  function getTotalWinningStake(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint totalWinningStake_)
  {
    totalWinningStake_ = LProposalsStorage.getTotalWinningStake(_storage, _proposalId);
  }

  function setTotalWinningStake(IAventusStorage _storage, uint _proposalId, uint _totalWinningStake)
    external
  {
    LProposalsStorage.setTotalWinningStake(_storage, _proposalId, _totalWinningStake);
  }

  function incrementNumVotersClaimed(IAventusStorage _storage, uint _proposalId)
    external
    returns (uint numVotersClaimed_)
  {
    numVotersClaimed_= LProposalsStorage.incrementNumVotersClaimed(_storage, _proposalId);
  }

  function initialiseVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _winningsRemaining)
    external
  {
    LProposalsStorage.initialiseVotersWinningsPot(_storage, _proposalId, _winningsRemaining);
  }

  function getVotersWinningsPot(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsPot_)
  {
    winningsPot_ = LProposalsStorage.getVotersWinningsPot(_storage, _proposalId);
  }

  function reduceVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _reduction)
    external
  {
    LProposalsStorage.reduceVotersWinningsPot(_storage, _proposalId, _reduction);
  }

  function getGovernanceProposalDeposit(IAventusStorage _storage)
    public
    view
    returns (uint depositInAVT_)
  {
    depositInAVT_ = LProposalsStorage.getGovernanceProposalDeposit(_storage);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId)
    public
    onlyAfterRevealingFinishedAndProposalNotEnded(_storage, _proposalId)
    returns (uint votesFor_, uint votesAgainst_)
  {
    LProposalsEnact.doUnlockProposalDeposit(_storage, _proposalId);

    votesFor_ = LProposalsStorage.getTotalRevealedStake(_storage, _proposalId, 1);
    votesAgainst_ = LProposalsStorage.getTotalRevealedStake(_storage, _proposalId, 2);
  }

  function getTimestamps(IAventusStorage _storage, uint _proposalId)
    public
    view
    returns (uint lobbyingStart_, uint votingStart_, uint revealingStart_, uint revealingEnd_)
  {
    lobbyingStart_ = LProposalsStorage.getLobbyingStart(_storage, _proposalId);
    votingStart_ = LProposalsStorage.getVotingStart(_storage, _proposalId);
    revealingStart_ = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    revealingEnd_ = LProposalsStorage.getRevealingEnd(_storage, _proposalId);
  }

  function doCreateGovernanceProposal(IAventusStorage _storage, uint _deposit)
    private
    returns (uint proposalId_)
  {
    uint numDaysInLobbyingPeriod = LProposalsStorage.getGovernanceProposalLobbyingPeriodDays(_storage);
    uint numDaysInVotingPeriod = LProposalsStorage.getGovernanceProposalVotingPeriodDays(_storage);
    uint numDaysInRevealingPeriod = LProposalsStorage.getGovernanceProposalRevealingPeriodDays(_storage);
    proposalId_ = LProposalsEnact.doCreateProposal(_storage, _deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
  }
}