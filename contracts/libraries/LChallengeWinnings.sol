pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";

// Library for dealing with the winnings of a challenge.
// This library is seprate to LProposals because of size limitations when deploying.
library LChallengeWinnings {
  function distributeChallengeWinnings(
      IAventusStorage _storage,
      uint _proposalId,
      address _challenger,
      address _challengee,
      bool _votersAgreedWithChallenger,
      uint _winningOption,
      uint _totalWinningStake,
      uint _winnings,
      uint8 _winningsForChallengeWinnerPercentage,
      uint8 _winningsToChallengeEnderPercentage)
    public
  {
    address loser = _votersAgreedWithChallenger ? _challengee : _challenger;
    takeAllWinningsFromProposalLoser(_storage, _winnings, loser);

    address winner = _votersAgreedWithChallenger ? _challenger : _challengee;

    uint winningsToProposalWinnerAVT = giveFixedWinningsToProposalWinner(
        _storage, winner, _winnings, _winningsForChallengeWinnerPercentage);
    uint winningsToChallengeEnderAVT =  (_winnings * _winningsToChallengeEnderPercentage) / 100;

    _winnings -= winningsToProposalWinnerAVT + winningsToChallengeEnderAVT;
    _winnings -= distributeWinningsAmongVoters(_storage, _proposalId, _winningOption, _totalWinningStake, _winnings);

    // Give anything remaining to the address that initiated the challenge end, along with their winnings.
    giveWinningsToStakeHolder(_storage, winningsToChallengeEnderAVT + _winnings, msg.sender);
  }

  // TODO: Consider keccak256("Lock", address, "deposit") format for all of
  // these calls and elsewhere: makes it clearer that deposit and stake are
  // owned by the same address, also means we will not use "LockDeposit" or
  // "LockStake" combined strings.
  // TODO: Consider using LLock for all these get/set calls.
  function takeAllWinningsFromProposalLoser(
      IAventusStorage _storage,
      uint _winnings,
      address _loser)
    private
  {
    bytes32 depositLockKey = keccak256("Lock", "deposit", _loser);
    uint depositLock = _storage.getUInt(depositLockKey);
    assert(depositLock >= _winnings);
    _storage.setUInt(depositLockKey, depositLock - _winnings);
  }

  function giveFixedWinningsToProposalWinner(
    IAventusStorage _storage,
    address _winner,
    uint _winnings,
    uint8 _winningsForChallengeWinnerPercentage)
    private
    returns (uint _fixedWinnings)
  {
    _fixedWinnings = (_winnings * _winningsForChallengeWinnerPercentage) / 100;
    bytes32 depositLockKey = keccak256("Lock", "deposit", _winner);
    uint depositLock = _storage.getUInt(depositLockKey);
    _storage.setUInt(depositLockKey, depositLock + _fixedWinnings);
  }

  function giveWinningsToStakeHolder(
      IAventusStorage _storage,
      uint _winnings,
      address _stakeHolder)
    private
  {
    bytes32 stakeLockKey = keccak256("Lock", "deposit", _stakeHolder);
    uint stakeLock = _storage.getUInt(stakeLockKey);
    _storage.setUInt(stakeLockKey, stakeLock + _winnings);
  }

  function distributeWinningsAmongVoters(
      IAventusStorage _storage,
      uint _proposalId,
      uint _winningOption,
      uint _totalWinningStake,
      uint _winnings)
    private
    returns (uint _winningsPaid)
  {
    uint numWinningVoters = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedVotersCount", _winningOption));
    for (uint i = 1; i <= numWinningVoters; ++i) {
      address voter = _storage.getAddress(keccak256("Proposal", _proposalId, "revealedVoter", _winningOption, i));
      uint voterStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedVoter", _winningOption, voter, "stake"));
      uint voterReward = (_winnings * voterStake) / _totalWinningStake;
      giveWinningsToStakeHolder(_storage, voterReward, voter);
      _winningsPaid += voterReward;
    }
  }
}