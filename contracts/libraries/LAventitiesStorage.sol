pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LAventitiesStorage {
  string constant aventitiesSchema = "Aventities";
  string constant aventitySchema = "Aventity";
  // TODO: Callers should get Proposal data from LProposals instead.
  string constant proposalSchema = "Proposal";

  bytes32 constant aventityCountKey = keccak256(abi.encodePacked(aventitiesSchema, "aventityCount"));
  bytes32 constant challengeLobbyingPeriodDaysKey =
      keccak256(abi.encodePacked(aventitiesSchema, "challengeLobbyingPeriodDays"));
  bytes32 constant challengeVotingPeriodDaysKey = keccak256(abi.encodePacked(aventitiesSchema, "challengeVotingPeriodDays"));
  bytes32 constant challengeRevealingPeriodDaysKey =
      keccak256(abi.encodePacked(aventitiesSchema, "challengeRevealingPeriodDays"));

  bytes32 constant winningsForChallengeWinnerPercentageKey =
      keccak256(abi.encodePacked(aventitiesSchema, "winningsForChallengeWinnerPercentage"));
  bytes32 constant winningsForChallengeEnderPercentageKey =
      keccak256(abi.encodePacked(aventitiesSchema, "winningsForChallengeEnderPercentage"));

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
    depositor_ = _storage.getAddress(keccak256(abi.encodePacked(aventitySchema, _aventityId, "depositor")));
  }

  function setDepositor(IAventusStorage _storage, uint _aventityId, address _depositor) external {
    _storage.setAddress(keccak256(abi.encodePacked(aventitySchema, _aventityId, "depositor")), _depositor);
  }

  function getChallengeProposalId(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint challengeProposalId_)
  {
    challengeProposalId_ = _storage.getUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "challenge")));
  }

  function setChallengeProposalId(IAventusStorage _storage, uint _aventityId, uint _challengeProposalId) external {
    _storage.setUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "challenge")), _challengeProposalId);
  }

  function getDeposit(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, uint _aventityId, uint _deposit) external {
    _storage.setUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "deposit")), _deposit);
  }

  function getWinningProposalOption(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningOption_)
  {
    winningOption_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "winningOption")));
  }

  function setWinningProposalOption(IAventusStorage _storage, uint _proposalId, uint _winningOption) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "winningOption")), _winningOption);
  }

  function getTotalWinningStake(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint totalWinningStake_)
  {
    totalWinningStake_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningStake")));
  }

  function setTotalWinningStake(IAventusStorage _storage, uint _proposalId, uint _totalWinningStake) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningStake")), _totalWinningStake);
  }

  function getTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint winningsToVoters_)
  {
    winningsToVoters_ = _storage.getUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningsToVoters")));
  }

  function setTotalWinningsToVoters(IAventusStorage _storage, uint _proposalId, uint _winningsToVoters) external {
    _storage.setUInt(keccak256(abi.encodePacked(proposalSchema, _proposalId, "totalWinningsToVoters")), _winningsToVoters);
  }

  function initialiseVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _winningsRemaining) external {
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

  function reduceVotersWinningsPot(IAventusStorage _storage, uint _proposalId, uint _reduction) external {
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
}