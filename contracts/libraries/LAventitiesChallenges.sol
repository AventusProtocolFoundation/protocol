pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./LProposal.sol";
import "./LAventitiesStorage.sol";

/**
 * Library for dealing with the winnings of an aventity challenge.
 *
 * This is only used by, and is separate to, LAventities because of size limitations when deploying.
 * There is no proxy for this library.
 */

library LAventitiesChallenges {
  bytes32 constant winningsForChallengeWinnerPercentageKey =
      keccak256(abi.encodePacked("Events", "winningsForChallengeWinnerPercentage"));
  bytes32 constant winningsForChallengeEnderPercentageKey =
      keccak256(abi.encodePacked("Events", "winningsForChallengeEnderPercentage"));

    function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
      address voter = msg.sender;
      uint winningOption = LAventitiesStorage.getWinningProposalOption(_storage, _proposalId);
      uint voterStake = LProposal.getRevealedVoterStake(_storage, _proposalId, voter, winningOption);
      require(
        voterStake != 0,
        "Voter has no stake in this proposal"
      );

      uint totalWinnings = LAventitiesStorage.getTotalWinningsToVoters(_storage, _proposalId);
      assert(totalWinnings != 0);
      uint totalWinningStake = LAventitiesStorage.getTotalWinningStake(_storage, _proposalId);
      assert(totalWinningStake != 0);

      uint voterReward = (totalWinnings * voterStake) / totalWinningStake;
      giveWinnings(_storage, voterReward, voter);

      // Update how much is left in the voters winnings pot.
      // TODO: consider using a reduceWinningsToVotersRemaining method to save the get and set.
      uint winningsToVotersRemaining = LAventitiesStorage.getWinningsToVotersRemaining(_storage, _proposalId);
      assert(winningsToVotersRemaining >= voterReward);
      LAventitiesStorage.setWinningsToVotersRemaining(_storage, _proposalId, winningsToVotersRemaining - voterReward);

      // Stop the voter from claiming again.
      LProposal.clearRevealedStake(_storage, _proposalId, voter, winningOption);
    }

    function doWinningsDistribution(
        IAventusStorage _storage,
        uint _proposalId,
        bool _winningsForVoters,
        uint _deposit,
        address _winner,
        address _loser)
      external
    {
      distributeChallengeWinnings(
          _storage,
          _proposalId,
          _winner,
          _loser,
          _deposit,
          _winningsForVoters,
          // TODO: Move to LAventitiesStorage when stack depth allows
          _storage.getUInt(winningsForChallengeWinnerPercentageKey),
          _storage.getUInt(winningsForChallengeEnderPercentageKey)
      );
    }

  function distributeChallengeWinnings(
      IAventusStorage _storage,
      uint _proposalId,
      address _winner,
      address _loser,
      uint _winnings,
      bool _winningsForVoters,
      uint _winningsForChallengeWinnerPercentage,
      uint _winningsToChallengeEnderPercentage)
    private
  {
    takeAllWinningsFromProposalLoser(_storage, _winnings, _loser);

    uint winningsToProposalWinnerAVT = (_winnings * _winningsForChallengeWinnerPercentage) / 100;
    giveWinnings(_storage, winningsToProposalWinnerAVT, _winner);

    address challengeEnder = msg.sender;
    uint winningsToChallengeEnderAVT = (_winnings * _winningsToChallengeEnderPercentage) / 100;

    _winnings -= winningsToProposalWinnerAVT + winningsToChallengeEnderAVT;

    if (_winningsForVoters) {
      // The rest of the winnings is distributed to the voters as they claim it.
      LAventitiesStorage.setTotalWinningsToVoters(_storage, _proposalId, _winnings);
      LAventitiesStorage.setWinningsToVotersRemaining(_storage, _proposalId, _winnings);
    } else {
      // If no one voted, the challenge ender gets the rest of the winnings.
      winningsToChallengeEnderAVT += _winnings;
    }

    giveWinnings(_storage, winningsToChallengeEnderAVT, challengeEnder);
  }

  function takeAllWinningsFromProposalLoser(
      IAventusStorage _storage,
      uint _winnings,
      address _loser)
    private
  {
    LAVTManager.decreaseFund(_storage, _loser, "deposit", _winnings);
  }

  function giveWinnings(
      IAventusStorage _storage,
      uint _winnings,
      address _payee)
    private
  {
    LAVTManager.increaseFund(_storage, _payee, "deposit", _winnings);
  }
}