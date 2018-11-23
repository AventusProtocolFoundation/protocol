pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";

library LProposalsStorage {

  bytes32 constant governanceProposalFixedDepositInUSCentsKey =
      keccak256(abi.encodePacked(proposalString, "governanceProposalFixedDepositInUSCents"));
  bytes32 constant governanceProposalLobbyingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalString, "governanceProposalLobbyingPeriodDays"));
  bytes32 constant governanceProposalVotingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalString, "governanceProposalVotingPeriodDays"));
  bytes32 constant governanceProposalRevealingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalString, "governanceProposalRevealingPeriodDays"));
  bytes32 constant proposalCountKey = keccak256(abi.encodePacked("ProposalCount"));

  string constant proposalString = "Proposal";

  function getGovernanceProposalDepositInUSCents(IAventusStorage _storage)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(governanceProposalFixedDepositInUSCentsKey);
  }

  function getGovernanceProposalLobbyingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint lobbyingDays_)
  {
    lobbyingDays_ = _storage.getUInt(governanceProposalLobbyingPeriodDaysKey);
  }

  function getGovernanceProposalVotingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint votingDays_)
  {
    votingDays_ = _storage.getUInt(governanceProposalVotingPeriodDaysKey);
  }

  function getGovernanceProposalRevealingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint revealingDays_)
  {
    revealingDays_ = _storage.getUInt(governanceProposalRevealingPeriodDaysKey);
  }

  function getProposalCount(IAventusStorage _storage)
    external
    view
    returns (uint proposalCount_)
  {
    proposalCount_ = _storage.getUInt(proposalCountKey);
  }

  function setProposalCount(IAventusStorage _storage, uint _proposalCount) external {
    _storage.setUInt(proposalCountKey, _proposalCount);
  }

  function getRevealedVoterStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId)
    external
    view
    returns (uint stake_)
  {
    stake_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealedVoter", _optionId, _voter,
        "stake")));
  }

  function setRevealedVoterStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId, uint _stake) external {
    bytes32 stakeKey = keccak256(abi.encodePacked(proposalString, _proposalId, "revealedVoter", _optionId, _voter, "stake"));
    _storage.setUInt(stakeKey, _stake);
  }

  function getDeposit(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, uint _proposalId, uint _deposit) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "deposit")), _deposit);
  }

  function isGovernanceProposal(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (bool isGovernance_)
  {
    isGovernance_ = _storage.getBoolean(keccak256(abi.encodePacked(proposalString, _proposalId, "governanceProposal")));
  }

  function setGovernanceProposal(IAventusStorage _storage, uint _proposalId) external {
    _storage.setBoolean(keccak256(abi.encodePacked(proposalString, _proposalId, "governanceProposal")), true);
  }

  function getLobbyingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint lobbyingStart_)
  {
    lobbyingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "lobbyingStart")));
  }

  function setLobbyingStart(IAventusStorage _storage, uint _proposalId, uint _lobbyingStart) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "lobbyingStart")), _lobbyingStart);
  }

  function getOwner(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked(proposalString, _proposalId, "owner")));
  }

  function setOwner(IAventusStorage _storage, uint _proposalId, address _owner) external {
    _storage.setAddress(keccak256(abi.encodePacked(proposalString, _proposalId, "owner")), _owner);
  }

  function getTotalRevealedStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint totalStake_)
  {
    totalStake_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealedStake", _optionId)));
  }

  function setTotalRevealedStake(IAventusStorage _storage, uint _proposalId, uint _optionId, uint _totalStake) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealedStake", _optionId)), _totalStake);
  }

  function getRevealedVotersCount(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint revealedVoters_)
  {
    revealedVoters_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealedVotersCount", _optionId)));
  }

  function setRevealedVotersCount(IAventusStorage _storage, uint _proposalId, uint _optionId, uint _revealedVoters) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealedVotersCount", _optionId)), _revealedVoters);
  }

  function getRevealingEnd(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint revealingEnd_)
  {
    revealingEnd_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealingEnd")));
  }

  function setRevealingEnd(IAventusStorage _storage, uint _proposalId, uint _revealingEnd) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealingEnd")), _revealingEnd);
  }

  function getRevealingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint revealingStart_)
  {
    revealingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealingStart")));
  }

  function setRevealingStart(IAventusStorage _storage, uint _proposalId, uint _revealingStart) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "revealingStart")), _revealingStart);
  }

  function getUnrevealedVotesCount(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint unrevealedVotes_)
  {
    unrevealedVotes_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "unrevealedVotesCount")));
  }

  function setUnrevealedVotesCount(IAventusStorage _storage, uint _proposalId, uint _unrevealedVotes) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "unrevealedVotesCount")), _unrevealedVotes);
  }

  function getVotingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint votingStart_)
  {
    votingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "votingStart")));
  }

  function setVotingStart(IAventusStorage _storage, uint _proposalId, uint _votingStart) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalString, _proposalId, "votingStart")), _votingStart);
  }

  function getVoteCountForRevealTime(IAventusStorage _storage, address _voter, uint _time)
    external
    view
    returns (uint voteCount_)
  {
    voteCount_ = _storage.getUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "count")));
  }

  function setVoteCountForRevealTime(IAventusStorage _storage, address _voter, uint _time, uint _voteCount) external {
    _storage.setUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "count")), _voteCount);
  }

  function getNextRevealTime(IAventusStorage _storage, address _voter, uint _time)
    external
    view
    returns (uint nextTime_)
  {
    nextTime_ = _storage.getUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "nextTime")));
  }

  function setNextRevealTime(IAventusStorage _storage, address _voter, uint _time, uint _nextTime) external {
    _storage.setUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "nextTime")), _nextTime);
  }

  function getPreviousRevealTime(IAventusStorage _storage, address _voter, uint _time)
    external
    view
    returns (uint previousTime_)
  {
    previousTime_ = _storage.getUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "prevTime")));
  }

  function setPreviousRevealTime(IAventusStorage _storage, address _voter, uint _time, uint _prevTime) external {
    _storage.setUInt(keccak256(abi.encodePacked("Voting", _voter, _time, "prevTime")), _prevTime);
  }

  function getVoterSecret(IAventusStorage _storage, address _voter, uint _proposalId)
    external
    view
    returns (bytes32 secrets_)
  {
    secrets_ = _storage.getBytes32(keccak256(abi.encodePacked("Voting", _voter, "secrets", _proposalId)));
  }

  function setVoterSecret(IAventusStorage _storage, address _voter, uint _proposalId, bytes32 _secrets) external {
    _storage.setBytes32(keccak256(abi.encodePacked("Voting", _voter, "secrets", _proposalId)), _secrets);
  }
}