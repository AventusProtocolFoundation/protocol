pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LAventitiesStorage {

  string constant aventitiesSchema = "Aventities";
  string constant aventitySchema = "Aventity";

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

  function setAventityCount(IAventusStorage _storage, uint _aventityCount)
    external
  {
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

  function setDepositor(IAventusStorage _storage, uint _aventityId, address _depositor)
    external
  {
    _storage.setAddress(keccak256(abi.encodePacked(aventitySchema, _aventityId, "depositor")), _depositor);
  }

  function getChallengeProposalId(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint challengeProposalId_)
  {
    challengeProposalId_ = _storage.getUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "challenge")));
  }

  function setChallengeProposalId(IAventusStorage _storage, uint _aventityId, uint _challengeProposalId)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "challenge")), _challengeProposalId);
  }

  function getDeposit(IAventusStorage _storage, uint _aventityId)
    external
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "deposit")));
  }

  function setDeposit(IAventusStorage _storage, uint _aventityId, uint _deposit)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(aventitySchema, _aventityId, "deposit")), _deposit);
  }
}