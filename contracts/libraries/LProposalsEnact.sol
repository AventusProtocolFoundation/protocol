pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LProposalWinnings.sol";
import "./LAventities.sol";
import './LAVTManager.sol';

// Library for extending voting protocol functionality
library LProposalsEnact {
  enum ProposalStatus {NonExistent, Lobbying, Voting, Revealing, RevealingFinishedProposalNotEnded, Ended}

  bytes32 constant proposalCountKey = keccak256(abi.encodePacked("ProposalCount"));

  function doUnlockProposalDeposit(IAventusStorage _storage, uint _proposalId) external {
    address proposalOwner = getProposalOwner(_storage, _proposalId);
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", proposalOwner));
    uint expectedDeposits = _storage.getUInt(expectedDepositsKey);
    uint proposalDeposit = getProposalDeposit(_storage, _proposalId);
    assert(expectedDeposits >= proposalDeposit);
    _storage.setUInt(expectedDepositsKey, expectedDeposits - proposalDeposit);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "deposit")), 0);
  }

  /**
  * @dev Create a proposal to be voted on
  * @param _storage Storage contract
  * @param _deposit Deposit that has to have been paid for this proposal
  * @return uint proposalId_ of newly created proposal
  */
  function doCreateProposal(IAventusStorage _storage, uint _deposit)
    external
    returns (uint proposalId_)
  {
    address owner = msg.sender;

    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", owner));
    _storage.setUInt(expectedDepositsKey, _storage.getUInt(expectedDepositsKey) + _deposit);

    uint expectedDeposits = _storage.getUInt(expectedDepositsKey);
    uint actualDeposits = LAVTManager.getBalance(_storage, owner, "deposit");
    require(
      actualDeposits >= expectedDeposits,
      "Owner has insufficient deposit funds to create a proposal"
    );

    uint proposalCount = _storage.getUInt(proposalCountKey);
    proposalId_ = proposalCount + 1;
    _storage.setAddress(keccak256(abi.encodePacked("Proposal", proposalId_, "owner")), owner);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "deposit")), _deposit);
    _storage.setUInt(proposalCountKey, proposalId_);
    setProposalTimes(_storage, proposalId_);
  }

  function doEndAventityChallenge(IAventusStorage _storage, uint _proposalId)
    external
  {
    uint aventityId = getAventityIdFromChallengeProposalId(_storage, _proposalId);
    endAventityChallenge(_storage, _proposalId, aventityId);
  }

  /**
  * @dev Gets a given proposal's current status
  * @param _storage Storage contract
  * @param _proposalId Proposal ID
  * @return proposal Status
  */
  function doGetProposalStatus(IAventusStorage _storage, uint _proposalId)
    public
    view
    returns (ProposalStatus status_)
  {
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    uint deposit = getProposalDeposit(_storage, _proposalId);

    uint currentTime = LAventusTime.getCurrentTime(_storage);

    if (votingStart == 0)
      status_ = ProposalStatus.NonExistent;
    else if (currentTime < votingStart)
      status_ = ProposalStatus.Lobbying;
    else if (currentTime < revealingStart)
      status_ = ProposalStatus.Voting;
    else if (currentTime < revealingEnd)
      status_ = ProposalStatus.Revealing;
    else if (deposit != 0)
      status_ = ProposalStatus.RevealingFinishedProposalNotEnded;
    else
      status_ = ProposalStatus.Ended;
  }

  function onlyInRevealingPeriodOrLater(ProposalStatus _proposalStatus) public pure returns (bool result_) {
    result_ =
      (_proposalStatus == ProposalStatus.Revealing) ||
      (_proposalStatus == ProposalStatus.RevealingFinishedProposalNotEnded) ||
      (_proposalStatus == ProposalStatus.Ended);
  }

  function onlyInVotingPeriodOrAfterRevealingFinished(ProposalStatus _proposalStatus) public pure returns (bool result_) {
    result_ =
      _proposalStatus == LProposalsEnact.ProposalStatus.Voting ||
      (_proposalStatus == LProposalsEnact.ProposalStatus.RevealingFinishedProposalNotEnded) ||
      (_proposalStatus == LProposalsEnact.ProposalStatus.Ended);
  }

  function inVotingPeriod(IAventusStorage _storage, uint _proposalId) public view returns (bool result_) {
    return doGetProposalStatus(_storage, _proposalId) == LProposalsEnact.ProposalStatus.Voting;
  }

  function afterRevealingFinishedAndProposalNotEnded(IAventusStorage _storage, uint _proposalId) public view returns (bool result_) {
    return doGetProposalStatus(_storage, _proposalId) == LProposalsEnact.ProposalStatus.RevealingFinishedProposalNotEnded;
  }

  function doProposalIsAventityChallenge(IAventusStorage _storage, uint _proposalId)
    public
    view
    returns (bool proposalIsAnAventityChallenge_)
  {
    proposalIsAnAventityChallenge_ = getAventityIdFromChallengeProposalId(_storage, _proposalId) != 0;
  }

  // NOTE: We allow an event challenge to straddle the ticket sales time on purpose: if
  // the event is under challenge at ticket sale time it will NOT block ticket sales.
  function setProposalTimes(IAventusStorage _storage, uint _proposalId)
    private
  {
    uint lobbyingStart = LAventusTime.getCurrentTime(_storage);
    uint votingStart = lobbyingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        doProposalIsAventityChallenge(_storage, _proposalId) ?
            "aventityChallengeLobbyingPeriodDays" :
            "governanceProposalLobbyingPeriodDays"))));
    uint revealingStart = votingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        doProposalIsAventityChallenge(_storage, _proposalId) ?
            "aventityChallengeVotingPeriodDays" :
            "governanceProposalVotingPeriodDays"))));
    uint revealingEnd = revealingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        doProposalIsAventityChallenge(_storage, _proposalId) ?
            "aventityChallengeRevealingPeriodDays" :
            "governanceProposalRevealingPeriodDays"))));

    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "lobbyingStart")), lobbyingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")), votingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")), revealingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")), revealingEnd);
  }

  function getProposalDeposit(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (uint deposit_)
  {
    deposit_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "deposit")));
  }

  function getProposalOwner(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (address owner_)
  {
    owner_ = _storage.getAddress(keccak256(abi.encodePacked("Proposal", _proposalId, "owner")));
  }

  function challengerIsWinner(uint8 _winningOption) private pure returns (bool challengerIsWinner_) {
    challengerIsWinner_ = (_winningOption == 1);
  }

  function getAventityIdFromChallengeProposalId(IAventusStorage _storage, uint _challengeProposalId)
    private
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _challengeProposalId, "ChallengeAventity")));
  }

  function endAventityChallenge(IAventusStorage _storage, uint _proposalId, uint _aventityId)
    private
  {
    uint totalAgreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint totalDisagreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));

    // Note: a "draw" is taken as not agreeing with the challenge.
    uint8 winningOption = totalAgreedStake > totalDisagreedStake ? 1 : 2;

    uint totalWinningStake;
    bool challengeWon = challengerIsWinner(winningOption);
    if (challengeWon) {
      LAventities.setAventityStatusFraudulent(_storage, _aventityId);
      totalWinningStake = totalAgreedStake;
    } else {
      LAventities.setAventityAsClearFromChallenge(_storage, _aventityId);
      totalWinningStake = totalDisagreedStake;
    }

    uint deposit = getProposalDeposit(_storage, _proposalId);
    address challenger = getProposalOwner(_storage, _proposalId);
    address challengee = LAventities.getAventityOwner(_storage, _aventityId);
    LProposalWinnings.doWinningsDistribution(_storage, _proposalId, winningOption, challengeWon, deposit, challenger, challengee);

    // Save the information we need to calculate voter winnings when they make their claim.
    _storage.setUInt8(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")), winningOption);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")), totalWinningStake);
  }
}