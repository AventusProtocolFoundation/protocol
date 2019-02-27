pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./LProposals.sol";
import "./LAventitiesChallenges.sol";
import "./LAventitiesStorage.sol";

library LAventities {

  // See IProposalsManager.claimVoterWinnings for details.
  event LogVoterWinningsClaimed(uint indexed proposalId);

  modifier onlyActiveAndNotUnderChallengeAventity(IAventusStorage _storage, uint _aventityId) {
    require(aventityIsActiveAndNotUnderChallenge(_storage, _aventityId), "Must be valid and not under challenge");
    _;
  }

  function registerAventity(IAventusStorage _storage, address _aventityDepositor, uint _aventityDeposit)
    external
    returns(uint aventityId_)
  {
    LAVTManager.lockDeposit(_storage, _aventityDepositor, _aventityDeposit);

    aventityId_ = LAventitiesStorage.getAventityCount(_storage) + 1;

    LAventitiesStorage.setAventityCount(_storage, aventityId_);
    LAventitiesStorage.setDeposit(_storage, aventityId_, _aventityDeposit);
    LAventitiesStorage.setDepositor(_storage, aventityId_, _aventityDepositor);
  }

  function deregisterAventity(IAventusStorage _storage, uint _aventityId)
    external
    onlyActiveAndNotUnderChallengeAventity(_storage, _aventityId)
  {
    unlockAventityDeposit(_storage, _aventityId);
  }

  function challengeAventity(IAventusStorage _storage, uint _aventityId)
    external
    onlyActiveAndNotUnderChallengeAventity(_storage, _aventityId)
    returns (uint challengeProposalId_)
  {
    uint numDaysInLobbyingPeriod = LAventitiesStorage.getLobbyingPeriodDays(_storage);
    uint numDaysInVotingPeriod = LAventitiesStorage.getVotingPeriodDays(_storage);
    uint numDaysInRevealingPeriod = LAventitiesStorage.getRevealingPeriodDays(_storage);

    uint deposit = getExistingAventityDeposit(_storage, _aventityId);
    challengeProposalId_ = LProposals.createProposal(_storage, deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
    LAventitiesStorage.setChallengeProposalId(_storage, _aventityId, challengeProposalId_);
  }

  function endAventityChallenge(IAventusStorage _storage, uint _aventityId)
    external
    returns (uint proposalId_, uint votesFor_, uint votesAgainst_, bool challengeWon_)
  {
    proposalId_ = LAventitiesStorage.getChallengeProposalId(_storage, _aventityId);
    require(proposalId_ > 0, "Challenge does not exist");

    challengeWon_ = finaliseChallenge(_storage, proposalId_, _aventityId);

    (votesFor_, votesAgainst_) = LProposals.endProposal(_storage, proposalId_);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId)
    external
  {
    LAventitiesChallenges.claimVoterWinnings(_storage, _proposalId);
    emit LogVoterWinningsClaimed(_proposalId);
  }

  function getAventityDepositor(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (address aventityDepositor_)
  {
    aventityDepositor_ = LAventitiesStorage.getDepositor(_storage, _aventityId);
  }

  function getExistingAventityDeposit(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (uint aventityDeposit_)
  {
    aventityDeposit_ = LAventitiesStorage.getDeposit(_storage, _aventityId);
  }

  function aventityIsActive(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsActive_)
  {
    aventityIsActive_ = _aventityId != 0 && LAventitiesStorage.getDeposit(_storage, _aventityId) != 0;
  }

  function aventityIsActiveAndNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsRegisteredAndNotUnderChallenge_)
  {
    aventityIsRegisteredAndNotUnderChallenge_ = aventityIsActive(_storage, _aventityId) &&
        aventityIsNotUnderChallenge(_storage, _aventityId);
  }

  function unlockAventityDeposit(IAventusStorage _storage, uint _aventityId)
    public
  {
    uint aventityDeposit = getExistingAventityDeposit(_storage, _aventityId);
    address aventityDepositor = LAventitiesStorage.getDepositor(_storage, _aventityId);
    LAVTManager.unlockDeposit(_storage, aventityDepositor, aventityDeposit);

    LAventitiesStorage.setDeposit(_storage, _aventityId, 0);
  }

  function aventityIsNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsNotUnderChallenge_)
  {
    aventityIsNotUnderChallenge_ = 0 == LAventitiesStorage.getChallengeProposalId(_storage, _aventityId);
  }

  function setAventityStatusFraudulent(IAventusStorage _storage, uint _aventityId)
    private
  {
    setAventityAsClearFromChallenge(_storage, _aventityId);

    // Aventity is no longer valid; remove the expected deposit for the aventity.
    unlockAventityDeposit(_storage, _aventityId);
  }

  function setAventityAsClearFromChallenge(IAventusStorage _storage, uint _aventityId)
    private
  {
    LAventitiesStorage.setChallengeProposalId(_storage, _aventityId, 0);
  }

  function finaliseChallenge(IAventusStorage _storage, uint _proposalId, uint _aventityId)
    private
    returns (bool challengeWon_)
  {
    uint totalAgreedStake = LProposals.getTotalRevealedStake(_storage, _proposalId, 1);
    uint totalDisagreedStake = LProposals.getTotalRevealedStake(_storage, _proposalId, 2);

    // Note: a "draw" is taken as the community NOT agreeing with the challenge.
    challengeWon_ = totalAgreedStake > totalDisagreedStake;

    // Get deposit now in case it is cleared by marking as fraudulent.
    uint deposit = getExistingAventityDeposit(_storage, _aventityId);

    address challenger = LProposals.getOwner(_storage, _proposalId);
    address challengee = getAventityDepositor(_storage, _aventityId);

    uint winningOption;
    address winner;
    address loser;
    uint totalWinningStake;

    if (challengeWon_) {
      winningOption = 1;
      winner = challenger;
      loser = challengee;
      totalWinningStake = totalAgreedStake;
      setAventityStatusFraudulent(_storage, _aventityId);
    } else {
      winningOption = 2;
      winner = challengee;
      loser = challenger;
      totalWinningStake = totalDisagreedStake;
      setAventityAsClearFromChallenge(_storage, _aventityId);
    }

    bool winningsForVoters = totalWinningStake > 0;
    LAventitiesChallenges.doWinningsDistribution(_storage, _proposalId, winningsForVoters, deposit, winner, loser);

    // Save the information we need to calculate voter winnings when they make their claim.
    LProposals.setWinningProposalOption(_storage, _proposalId, winningOption);
    LProposals.setTotalWinningStake(_storage, _proposalId, totalWinningStake);
  }
}