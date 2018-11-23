pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";

library LAventitiesStorage {

  bytes32 constant aventityCountKey = keccak256(abi.encodePacked("AventityCount"));
  bytes32 constant challengeLobbyingPeriodDaysKey = keccak256(abi.encodePacked("Aventities", "challengeLobbyingPeriodDays"));
  bytes32 constant challengeVotingPeriodDaysKey = keccak256(abi.encodePacked("Aventities", "challengeVotingPeriodDays"));
  bytes32 constant challengeRevealingPeriodDaysKey = keccak256(abi.encodePacked("Aventities", "challengeRevealingPeriodDays"));

  bytes32 constant winningsForChallengeWinnerPercentageKey =
      keccak256(abi.encodePacked("Aventities", "winningsForChallengeWinnerPercentage"));
  bytes32 constant winningsForChallengeEnderPercentageKey =
      keccak256(abi.encodePacked("Aventities", "winningsForChallengeEnderPercentage"));

  function getAventityCount(IAventusStorage _storage)
    external
    view
    returns (uint aventityCount_)
  {
    aventityCount_ = _storage.getUInt(aventityCountKey);
  }

  function setAventityCount(IAventusStorage _storage, uint _aventityCount) external {
    _storage.setUInt(aventityCountKey, _aventityCount);
  }

  function getLobbyingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint lobbyingPeriodDays_)
  {
    lobbyingPeriodDays_ = _storage.getUInt(challengeLobbyingPeriodDaysKey);
  }

  function getVotingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint votingPeriodDays_)
  {
    votingPeriodDays_ = _storage.getUInt(challengeVotingPeriodDaysKey);
  }

  function getRevealingPeriodDays(IAventusStorage _storage)
    external
    view
    returns (uint revealingPeriodDays_)
  {
    revealingPeriodDays_ = _storage.getUInt(challengeRevealingPeriodDaysKey);
  }

  function getWinningsForChallengeWinnerPercentage(IAventusStorage _storage)
    external
    view
    returns (uint winnerPercentage_)
  {
    winnerPercentage_ = _storage.getUInt(winningsForChallengeWinnerPercentageKey);
  }

  function getWinningsForChallengeEnderPercentage(IAventusStorage _storage)
    external
    view
    returns (uint enderPercentage_)
  {
    enderPercentage_ = _storage.getUInt(winningsForChallengeEnderPercentageKey);
  }

  function getDepositor(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (address depositor_)
  {
    depositor_ = _storage.getAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "depositor")));
  }

  function setDepositor(IAventusStorage _storage, uint _aventityId, address _depositor) external {
    _storage.setAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "depositor")), _depositor);
  }

  function getChallengeProposalId(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint challengeProposalId_)
  {
    challengeProposalId_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")));
  }

  function setChallengeProposalId(IAventusStorage _storage, uint _aventityId, uint _challengeProposalId) external {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")), _challengeProposalId);
  }

  function getDeposit(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, uint _aventityId, uint _deposit) external {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")), _deposit);
  }

  function getWinningProposalOption(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningOption_)
  {
    winningOption_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")));
  }

  function setWinningProposalOption(IAventusStorage _storage, uint _proposalId, uint _winningOption) external {
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")), _winningOption);
  }

  function getTotalWinningStake(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint totalWinningStake_)
  {
    totalWinningStake_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")));
  }

  function setTotalWinningStake(IAventusStorage _storage, uint _proposalId, uint _totalWinningStake) external {
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")), _totalWinningStake);
  }

  function getTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsToVoters_)
  {
    winningsToVoters_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningsToVoters")));
  }

  function setTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId, uint _winningsToVoters) external {
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningsToVoters")), _winningsToVoters);
  }

  function initialiseVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _winningsRemaining) external {
    bytes32 winningsToVotersRemainingKey = keccak256(abi.encodePacked("Proposal", _proposalId, "winningsToVotersRemaining"));
    uint currentWinningsRemaining = _storage.getUInt(winningsToVotersRemainingKey);
    assert(currentWinningsRemaining == 0);

    _storage.setUInt(winningsToVotersRemainingKey, _winningsRemaining);
  }

  function reduceVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _reduction) external {
    assert(_reduction != 0);
    bytes32 winningsToVotersRemainingKey = keccak256(abi.encodePacked("Proposal", _proposalId, "winningsToVotersRemaining"));
    uint winningsRemaining = _storage.getUInt(winningsToVotersRemainingKey);
    assert(winningsRemaining >= _reduction);

    _storage.setUInt(winningsToVotersRemainingKey, winningsRemaining - _reduction);
  }
}