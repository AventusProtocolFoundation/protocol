pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import './LAVTManager.sol';
import './LProposalsStorage.sol';

// Library for extending voting protocol functionality
library LProposalsEnact {
  enum ProposalStatus {NonExistent, Lobbying, Voting, Revealing, RevealingFinishedProposalNotEnded, Ended}

  function doUnlockProposalDeposit(IAventusStorage _storage, uint _proposalId) external {
    address proposalOwner = getProposalOwner(_storage, _proposalId);
    uint proposalDeposit = getProposalDeposit(_storage, _proposalId);
    // TODO: Move this get/check/set to LAVTManager.unlockDeposit.
    uint expectedDeposits = LAVTManager.getExpectedDeposits(_storage, proposalOwner);
    assert(expectedDeposits >= proposalDeposit);
    LAVTManager.setExpectedDeposits(_storage, proposalOwner, expectedDeposits - proposalDeposit);
    LProposalsStorage.setDeposit(_storage, _proposalId, 0);
  }

  /**
  * @dev Create a proposal to be voted on
  * @param _storage Storage contract
  * @param _deposit Deposit that has to have been paid for this proposal
  * @return uint proposalId_ of newly created proposal
  */
  function doCreateProposal(IAventusStorage _storage, uint _deposit, uint numDaysInLobbyingPeriod, uint numDaysInVotingPeriod,
      uint numDaysInRevealingPeriod)
    external
    returns (uint proposalId_)
  {
    address owner = msg.sender;

    // TODO: Move this get/set/check to LAVTManager.lockDeposit.
    uint expectedDeposits = LAVTManager.getExpectedDeposits(_storage, owner) + _deposit;
    LAVTManager.setExpectedDeposits(_storage, owner, expectedDeposits);

    uint actualDeposits = LAVTManager.getBalance(_storage, owner, "deposit");
    require(
      actualDeposits >= expectedDeposits,
      "Owner has insufficient deposit funds to create a proposal"
    );

    uint proposalCount = LProposalsStorage.getProposalCount(_storage);
    proposalId_ = proposalCount + 1;
    LProposalsStorage.setOwner(_storage, proposalId_, owner);
    LProposalsStorage.setDeposit(_storage, proposalId_, _deposit);
    LProposalsStorage.setProposalCount(_storage, proposalId_);
    setProposalTimes(_storage, proposalId_, numDaysInLobbyingPeriod, numDaysInVotingPeriod, numDaysInRevealingPeriod);
  }

  function inRevealingPeriodOrLater(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (bool result_)
  {
    ProposalStatus proposalStatus = doGetProposalStatus(_storage, _proposalId);
    result_ =
      (proposalStatus == ProposalStatus.Revealing) ||
      (proposalStatus == ProposalStatus.RevealingFinishedProposalNotEnded) ||
      (proposalStatus == ProposalStatus.Ended);
  }

  function inRevealingPeriod(IAventusStorage _storage, uint _proposalId) external view returns (bool result_) {
    return doGetProposalStatus(_storage, _proposalId) == LProposalsEnact.ProposalStatus.Revealing;
  }

  function inVotingPeriodOrAfterRevealingFinished(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (bool result_)
  {
    ProposalStatus proposalStatus = doGetProposalStatus(_storage, _proposalId);
    result_ =
      proposalStatus == LProposalsEnact.ProposalStatus.Voting ||
      (proposalStatus == LProposalsEnact.ProposalStatus.RevealingFinishedProposalNotEnded) ||
      (proposalStatus == LProposalsEnact.ProposalStatus.Ended);
  }

  function inVotingPeriod(IAventusStorage _storage, uint _proposalId) external view returns (bool result_) {
    return doGetProposalStatus(_storage, _proposalId) == LProposalsEnact.ProposalStatus.Voting;
  }

  function afterRevealingFinishedAndProposalNotEnded(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (bool result_)
  {
    return doGetProposalStatus(_storage, _proposalId) == LProposalsEnact.ProposalStatus.RevealingFinishedProposalNotEnded;
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
    uint votingStart = LProposalsStorage.getVotingStart(_storage, _proposalId);
    uint revealingStart = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    uint revealingEnd = LProposalsStorage.getRevealingEnd(_storage, _proposalId);
    uint deposit = getProposalDeposit(_storage, _proposalId);

    uint currentTime = LAventusTime.getCurrentTime(_storage);

    if (votingStart == 0)
      status_ = ProposalStatus.NonExistent;
    else if (currentTime < votingStart)
      status_ = ProposalStatus.Lobbying;
    else if (currentTime < revealingStart)
      status_ = ProposalStatus.Voting;
    else if (currentTime < revealingEnd && thereAreUnrevealedVotes(_storage, _proposalId))
      status_ = ProposalStatus.Revealing;
    else if (deposit != 0)
      status_ = ProposalStatus.RevealingFinishedProposalNotEnded;
    else
      status_ = ProposalStatus.Ended;
  }

  function setProposalTimes(IAventusStorage _storage, uint _proposalId, uint numDaysInLobbyingPeriod,
      uint numDaysInVotingPeriod, uint numDaysInRevealingPeriod)
    private
  {
    uint lobbyingStart = LAventusTime.getCurrentTime(_storage);
    uint votingStart = lobbyingStart + (1 days * numDaysInLobbyingPeriod);
    uint revealingStart = votingStart + (1 days * numDaysInVotingPeriod);
    uint revealingEnd = revealingStart + (1 days * numDaysInRevealingPeriod);

    LProposalsStorage.setLobbyingStart(_storage, _proposalId, lobbyingStart);
    LProposalsStorage.setVotingStart(_storage, _proposalId, votingStart);
    LProposalsStorage.setRevealingStart(_storage, _proposalId, revealingStart);
    LProposalsStorage.setRevealingEnd(_storage, _proposalId, revealingEnd);
  }

  function getProposalDeposit(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (uint deposit_)
  {
    deposit_ = LProposalsStorage.getDeposit(_storage, _proposalId);
  }

  function getProposalOwner(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (address owner_)
  {
    owner_ = LProposalsStorage.getOwner(_storage, _proposalId);
  }

  function thereAreUnrevealedVotes(IAventusStorage _storage, uint _proposalId) private view returns (bool result_) {
    result_ = LProposalsStorage.getUnrevealedVotesCount(_storage, _proposalId) > 0;
  }
}