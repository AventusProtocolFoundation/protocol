pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LLock.sol";

/**
 * Library for dealing with the winnings of a challenge.
 *
 * This only used by, and is separate to, LProposals because of size limitations when deploying.
 * There is no proxy for this library.
 *
 * NOTE: Do NOT put anything in here specific to events as this will also be used for app challenges.
 */
library LProposalWinnings {
  bytes32 constant winningsForChallengeWinnerPercentageKey =
      keccak256(abi.encodePacked("Events", "winningsForChallengeWinnerPercentage"));
  bytes32 constant winningsForChallengeEnderPercentageKey =
      keccak256(abi.encodePacked("Events", "winningsForChallengeEnderPercentage"));

    function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
      address voter = msg.sender;
      uint8 winningOption = _storage.getUInt8(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")));
      bytes32 voterStakeKey = keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVoter", winningOption, voter, "stake"));
      uint voterStake = _storage.getUInt(voterStakeKey);
      require(
        voterStake != 0,
        "Voter has no stake in this proposal"
      );

      uint totalWinnings = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningsToVoters")));
      assert(totalWinnings != 0);
      uint totalWinningStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")));
      assert(totalWinningStake != 0);

      uint voterReward = (totalWinnings * voterStake) / totalWinningStake;
      giveWinnings(_storage, voterReward, voter);

      // Update how much is left in the voters winnings pot.
      bytes32 winningsToVotersRemainingKey = keccak256(abi.encodePacked("Proposal", _proposalId, "winningsToVotersRemaining"));
      uint winningsToVotersRemaining = _storage.getUInt(winningsToVotersRemainingKey);
      assert(winningsToVotersRemaining >= voterReward);
      _storage.setUInt(winningsToVotersRemainingKey, winningsToVotersRemaining - voterReward);

      // Stop the voter from claiming again.
      _storage.setUInt(voterStakeKey, 0);
    }

    function doEventWinningsDistribution(
        IAventusStorage _storage,
        uint _proposalId,
        uint8 _winningOption,
        bool _challengeWon,
        uint _deposit,
        address _challenger,
        address _eventOwner)
      external
    {
      distributeChallengeWinnings(
          _storage,
          _proposalId,
          _challengeWon ? _challenger : _eventOwner, // winner
          _challengeWon ? _eventOwner : _challenger, // loser
          _deposit,
          0 ==_storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVotersCount", _winningOption))), // challengeHasNoRevealedVotes
          _storage.getUInt8(winningsForChallengeWinnerPercentageKey),
          _storage.getUInt8(winningsForChallengeEnderPercentageKey)
      );
    }

  function distributeChallengeWinnings(
      IAventusStorage _storage,
      uint _proposalId,
      address _winner,
      address _loser,
      uint _winnings,
      bool _challengeHasNoRevealedVotes,
      uint8 _winningsForChallengeWinnerPercentage,
      uint8 _winningsToChallengeEnderPercentage)
    private
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
      _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningsToVoters")), _winnings);
      _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "winningsToVotersRemaining")), _winnings);
    }
    giveWinnings(_storage, winningsToChallengeEnderAVT, challengeEnder);
  }

  // TODO: Consider using LLock for all these get/set calls.
  function takeAllWinningsFromProposalLoser(
      IAventusStorage _storage,
      uint _winnings,
      address _loser)
    private
  {
    LLock.decreaseFund(_storage, _loser, "deposit", _winnings);
  }

  function giveWinnings(
      IAventusStorage _storage,
      uint _winnings,
      address _payee)
    private
  {
    LLock.increaseFund(_storage, _payee, "deposit", _winnings);
  }

}
