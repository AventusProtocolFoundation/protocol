pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";

/**
 * Library for dealing with the winnings of a challenge.
 *
 * This only used by, and is separate to, LProposals because of size limitations when deploying.
 * There is no proxy for this library.
 *
 * NOTE: Do NOT put anything in here specific to events as this will also be used for app challenges.
 */
library LChallengeWinnings {
  function distributeChallengeWinnings(
      IAventusStorage _storage,
      uint _proposalId,
      address _winner,
      address _loser,
      uint _winnings,
      bool _challengeHasNoRevealedVotes,
      uint8 _winningsForChallengeWinnerPercentage,
      uint8 _winningsToChallengeEnderPercentage)
    public
  {
    takeAllWinningsFromProposalLoser(_storage, _winnings, _loser);

    uint winningsToProposalWinnerAVT = (_winnings * _winningsForChallengeWinnerPercentage) / 100;
    giveWinnings(_storage, winningsToProposalWinnerAVT, _winner);


    address challengeEnder = msg.sender;
    uint winningsToChallengeEnderAVT = (_winnings * _winningsToChallengeEnderPercentage) / 100;

    _winnings -= winningsToProposalWinnerAVT + winningsToChallengeEnderAVT;

    if (_challengeHasNoRevealedVotes) {
      // If no one voted, the challenge ender gets the rest of the winnings.
      winningsToChallengeEnderAVT += _winnings;
    } else {
      // Otherwise, the rest of the winnings is distributed to the voters as they claim it.
      _storage.setUInt(keccak256("Proposal", _proposalId, "totalWinningsToVoters"), _winnings);
      _storage.setUInt(keccak256("Proposal", _proposalId, "winningsToVotersRemaining"), _winnings);
    }
    giveWinnings(_storage, winningsToChallengeEnderAVT, challengeEnder);
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

  function giveWinnings(
      IAventusStorage _storage,
      uint _winnings,
      address _payee)
    private
  {
    bytes32 depositLockKey = keccak256("Lock", "deposit", _payee);
    uint depositLock = _storage.getUInt(depositLockKey);
    _storage.setUInt(depositLockKey, depositLock + _winnings);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) public {
    address voter = msg.sender;
    uint8 winningOption = _storage.getUInt8(keccak256("Proposal", _proposalId, "winningOption"));
    bytes32 voterStakeKey = keccak256("Proposal", _proposalId, "revealedVoter", winningOption, voter, "stake");
    uint voterStake = _storage.getUInt(voterStakeKey);
    require(voterStake != 0);

    uint totalWinnings = _storage.getUInt(keccak256("Proposal", _proposalId, "totalWinningsToVoters"));
    require(totalWinnings != 0);
    uint totalWinningStake = _storage.getUInt(keccak256("Proposal", _proposalId, "totalWinningStake"));
    require(totalWinningStake != 0);

    uint voterReward = (totalWinnings * voterStake) / totalWinningStake;
    giveWinnings(_storage, voterReward, voter);

    // Update how much is left in the voters winnings pot.
    bytes32 winningsToVotersRemainingKey = keccak256("Proposal", _proposalId, "winningsToVotersRemaining");
    uint winningsToVotersRemaining = _storage.getUInt(winningsToVotersRemainingKey);
    require(winningsToVotersRemaining >= voterReward);
    _storage.setUInt(winningsToVotersRemainingKey, winningsToVotersRemaining - voterReward);

    // Stop the voter from claiming again.
    _storage.setUInt(voterStakeKey, 0);
  }
}