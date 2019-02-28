pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LProposalsStorage {

  string constant proposalsSchema = "Proposals";
  string constant proposalSchema = "Proposal";
  string constant votingSchema = "Voting";

  bytes32 constant governanceProposalFixedDepositKey =
      keccak256(abi.encodePacked(proposalsSchema, "governanceProposalFixedDeposit"));
  bytes32 constant governanceProposalLobbyingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalsSchema, "governanceProposalLobbyingPeriodDays"));
  bytes32 constant governanceProposalVotingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalsSchema, "governanceProposalVotingPeriodDays"));
  bytes32 constant governanceProposalRevealingPeriodDaysKey =
      keccak256(abi.encodePacked(proposalsSchema, "governanceProposalRevealingPeriodDays"));
  bytes32 constant proposalCountKey = keccak256(abi.encodePacked(proposalsSchema, "ProposalCount"));

  function getGovernanceProposalDeposit(IAventusStorage _storage)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(governanceProposalFixedDepositKey);
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

  function setProposalCount(IAventusStorage _storage, uint _proposalCount)
    external
  {
    _storage.setUInt(proposalCountKey, _proposalCount);
  }

  function getRevealedVoterStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId)
    external
    view
    returns (uint stake_)
  {
    stake_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealedVoter", _optionId, _voter,
        "stake")));
  }

  function setRevealedVoterStake(IAventusStorage _storage, uint _proposalId, address _voter, uint _optionId, uint _stake)
    external
  {
    bytes32 stakeKey = keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealedVoter", _optionId, _voter, "stake"));
    _storage.setUInt(stakeKey, _stake);
  }

  function getDeposit(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, uint _proposalId, uint _deposit)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "deposit")), _deposit);
  }

  function isGovernanceProposal(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (bool isGovernance_)
  {
    isGovernance_ = _storage.getBoolean(keccak256(abi.encodePacked(proposalSchema, _proposalId, "governanceProposal")));
  }

  function setGovernanceProposal(IAventusStorage _storage, uint _proposalId)
    external
  {
    _storage.setBoolean(keccak256(abi.encodePacked(proposalSchema, _proposalId, "governanceProposal")), true);
  }

  function getLobbyingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint lobbyingStart_)
  {
    lobbyingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "lobbyingStart")));
  }

  function setLobbyingStart(IAventusStorage _storage, uint _proposalId, uint _lobbyingStart)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "lobbyingStart")), _lobbyingStart);
  }

  function getOwner(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked(proposalSchema, _proposalId, "owner")));
  }

  function setOwner(IAventusStorage _storage, uint _proposalId, address _owner)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(proposalSchema, _proposalId, "owner")), _owner);
  }

  function getTotalRevealedStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint totalStake_)
  {
    totalStake_ = _storage.getUInt(getTotalRevealedStakeKey(_proposalId, _optionId));
  }

  function increaseTotalRevealedStake(IAventusStorage _storage, uint _proposalId, uint _optionId, uint _stake)
    external
  {
    bytes32 revealedStakeKey = getTotalRevealedStakeKey(_proposalId, _optionId);
    _storage.setUInt(revealedStakeKey, _storage.getUInt(revealedStakeKey) + _stake);
  }

  function getNumVotersRevealedWithStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external
    view
    returns (uint revealedVoters_)
  {
    revealedVoters_ = _storage.getUInt(getNumVotersRevealedWithStakeKey(_proposalId, _optionId));
  }

  function incrementNumVotersRevealedWithStake(IAventusStorage _storage, uint _proposalId, uint _optionId)
    external {
    bytes32 revealedVotersCountKey = getNumVotersRevealedWithStakeKey(_proposalId, _optionId);
    _storage.setUInt(revealedVotersCountKey, _storage.getUInt(revealedVotersCountKey) + 1);
  }

  function getRevealingEnd(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint revealingEnd_)
  {
    revealingEnd_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealingEnd")));
  }

  function setRevealingEnd(IAventusStorage _storage, uint _proposalId, uint _revealingEnd)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealingEnd")), _revealingEnd);
  }

  function getRevealingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint revealingStart_)
  {
    revealingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealingStart")));
  }

  function setRevealingStart(IAventusStorage _storage, uint _proposalId, uint _revealingStart)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "revealingStart")), _revealingStart);
  }

  function getUnrevealedVotesCount(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint unrevealedVotes_)
  {
    unrevealedVotes_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "unrevealedVotesCount")));
  }

  function setUnrevealedVotesCount(IAventusStorage _storage, uint _proposalId, uint _unrevealedVotes)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "unrevealedVotesCount")), _unrevealedVotes);
  }

  function getVotingStart(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint votingStart_)
  {
    votingStart_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "votingStart")));
  }

  function setVotingStart(IAventusStorage _storage, uint _proposalId, uint _votingStart)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "votingStart")), _votingStart);
  }

  function getVoterSecret(IAventusStorage _storage, address _voter, uint _proposalId)
    external
    view
    returns (bytes32 secrets_)
  {
    secrets_ = _storage.getBytes32(keccak256(abi.encodePacked(votingSchema, _voter, "secrets", _proposalId)));
  }

  function setVoterSecret(IAventusStorage _storage, address _voter, uint _proposalId, bytes32 _secrets)
    external
  {
    _storage.setBytes32(keccak256(abi.encodePacked(votingSchema, _voter, "secrets", _proposalId)), _secrets);
  }

  function getWinningProposalOption(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningOption_)
  {
    winningOption_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "winningOption")));
  }

  function setWinningProposalOption(IAventusStorage _storage, uint _proposalId, uint _winningOption)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "winningOption")), _winningOption);
  }

  function getTotalWinningStake(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint totalWinningStake_)
  {
    totalWinningStake_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningStake")));
  }

  function setTotalWinningStake(IAventusStorage _storage, uint _proposalId, uint _totalWinningStake)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningStake")), _totalWinningStake);
  }

  function getTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsToVoters_)
  {
    winningsToVoters_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningsToVoters")));
  }

  function setTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId, uint _winningsToVoters)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningsToVoters")), _winningsToVoters);
  }

  function initialiseVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _winningsRemaining)
    external
  {
    bytes32 winningsToVotersRemainingKey = getVotersWinningsPotKey(_proposalId);
    assert(_storage.getUInt(winningsToVotersRemainingKey) == 0);
    _storage.setUInt(winningsToVotersRemainingKey, _winningsRemaining);
  }

  function getVotersWinningsPot(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsPot_)
  {
    winningsPot_ = _storage.getUInt(getVotersWinningsPotKey(_proposalId));
  }

  function reduceVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _reduction)
    external
  {
    assert(_reduction != 0);
    bytes32 key = getVotersWinningsPotKey(_proposalId);
    uint winningsRemaining = _storage.getUInt(key);
    assert(winningsRemaining >= _reduction);

    _storage.setUInt(key, winningsRemaining - _reduction);
  }

  function incrementNumVotersClaimed(IAventusStorage _storage, uint _proposalId)
    external
    returns (uint numVotersClaimed_)
  {
    bytes32 key = keccak256(abi.encodePacked(proposalSchema, _proposalId, "numVotersClaimed"));
    numVotersClaimed_ = _storage.getUInt(key);
    _storage.setUInt(key, ++numVotersClaimed_);
  }

  function getVotersWinningsPotKey(uint _proposalId)
    private
    pure
    returns (bytes32 key_)
  {
   key_ = keccak256(abi.encodePacked(proposalSchema, _proposalId, "winningsToVotersRemaining"));
  }

  function getTotalRevealedStakeKey(uint _proposalId, uint _optionId)
    private
    pure
    returns (bytes32 key_)
  {
    key_ = keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalRevealedStake", _optionId));
  }

  function getNumVotersRevealedWithStakeKey(uint _proposalId, uint _optionId)
    private
    pure
    returns (bytes32 numVotersRevealedWithStake)
  {
    numVotersRevealedWithStake =
        keccak256(abi.encodePacked(proposalSchema, _proposalId, "numVotersRevealedWithStake", _optionId));
  }
}