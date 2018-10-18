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
      bool _distributeToVoters,
      uint _winnings,
      address _winner,
      address _loser)
    external
  {
    takeAllWinningsFromProposalLoser(_storage, _winnings, _loser);
    uint winningsForChallengeWinnerPercentage = LAventitiesStorage.getWinningsForChallengeWinnerPercentage(_storage);
    uint winningsToProposalWinnerAVT = (_winnings * winningsForChallengeWinnerPercentage) / 100;
    giveWinnings(_storage, winningsToProposalWinnerAVT, _winner);

    uint winningsToChallengeEnderPercentage = LAventitiesStorage.getWinningsForChallengeEnderPercentage(_storage);
    address challengeEnder = msg.sender;
    uint winningsToChallengeEnderAVT = (_winnings * winningsToChallengeEnderPercentage) / 100;

    uint winningsForVoters = _winnings - winningsToProposalWinnerAVT - winningsToChallengeEnderAVT;

    if (_distributeToVoters) {
      // The rest of the winnings is distributed to the voters as they claim it.
      LAventitiesStorage.setTotalWinningsToVoters(_storage, _proposalId, winningsForVoters);
      LAventitiesStorage.setWinningsToVotersRemaining(_storage, _proposalId, winningsForVoters);
    } else {
      // If no one voted, the challenge ender gets the rest of the winnings.
      winningsToChallengeEnderAVT += winningsForVoters;
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