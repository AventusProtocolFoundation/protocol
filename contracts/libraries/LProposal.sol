pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LProposalWinnings.sol";
import "./LProposalsEnact.sol";
import "./LEvents.sol";
import "./LProposalVoting.sol";

// Library for extending voting protocol functionality
library LProposal {
  bytes32 constant governanceProposalFixedDepositInUsCentsKey =
      keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUsCents"));
  /// See IProposalsManager interface for events description
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);
  event LogCreateEventChallenge(uint indexed eventId, uint indexed proposalId, string supportingUrl, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);
  event LogCastVote(address indexed sender, uint indexed proposalId, bytes32 secret, uint prevTime);
  event LogRevealVote(address indexed sender, uint indexed proposalId, uint8 indexed optId, uint revealingStart, uint revealingEnd);
  event LogClaimVoterWinnings(uint indexed proposalId);
  event LogEndProposal(uint indexed proposalId, uint votesFor, uint votesAgainst, uint revealingEnd);

  // Verify a proposal's status (see LProposalsEnact.doGetProposalStatus for values)
  modifier onlyInVotingPeriod(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.doGetProposalStatus(_storage, _proposalId) == 2,
      "Proposal has the wrong status"
    );
    _;
  }

  modifier onlyAfterRevealingFinishedAndProposalNotEnded(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.doGetProposalStatus(_storage, _proposalId) == 4,
      "Proposal has the wrong status"
    );
    _;
  }

  modifier eventIsNotUnderChallenge(IAventusStorage _storage, uint _eventId) {
    require(
      LEvents.eventIsNotUnderChallenge(_storage, _eventId),
      "Event is being challenged"
    );
    _;
  }

  function createGovernanceProposal(IAventusStorage _storage, string _desc)
    external
    returns (uint proposalId_)
  {
    proposalId_ = LProposalsEnact.doCreateProposal(_storage, getGovernanceProposalDeposit(_storage));
    uint lobbyingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "lobbyingStart")));
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "revealingEnd")));
    emit LogCreateProposal(msg.sender, _desc, proposalId_, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function castVote(
    IAventusStorage _storage,
    uint _proposalId,
    bytes32 _secret,
    uint _prevTime
  )
    external
    onlyInVotingPeriod(_storage, _proposalId) // Ensure voting period is currently active
  {
    LProposalVoting.castVote(_storage, _proposalId, _secret, _prevTime);
    emit LogCastVote(msg.sender, _proposalId, _secret, _prevTime);
  }

  function revealVote(IAventusStorage _storage, bytes _signedMessage, uint _proposalId, uint8 _optId) external {
    // Make sure proposal status is Reveal or after.
    uint proposalStatus = LProposalsEnact.doGetProposalStatus(_storage, _proposalId);
    LProposalVoting.revealVote(_storage, _signedMessage, _proposalId, _optId, proposalStatus);

    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogRevealVote(msg.sender, _proposalId, _optId, revealingStart, revealingEnd);
  }

  // @return AVT value with 18 decimal places of precision.
  function getGovernanceProposalDeposit(IAventusStorage _storage) view public returns (uint depositInAVT_) {
    uint depositInUSCents = _storage.getUInt(governanceProposalFixedDepositInUsCentsKey);
    depositInAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  /**
  * @dev Create a challenge for the specified event to be voted on.
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(IAventusStorage _storage, uint _eventId)
    external
    eventIsNotUnderChallenge(_storage, _eventId)
    returns (uint challengeProposalId_)
  {
    uint deposit = LEvents.getExistingEventDeposit(_storage, _eventId);
    challengeProposalId_ = LProposalsEnact.doCreateProposal(_storage, deposit);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "ChallengeEvent")), _eventId);
    LEvents.setEventAsChallenged(_storage, _eventId, challengeProposalId_);

    bytes32 supportingUrlKey = keccak256(abi.encodePacked("Event", _eventId, "eventSupportURL"));
    uint lobbyingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "lobbyingStart")));
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "revealingEnd")));
    emit LogCreateEventChallenge(_eventId, challengeProposalId_, _storage.getString(supportingUrlKey), lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
    LProposalWinnings.claimVoterWinnings(_storage, _proposalId);
    emit LogClaimVoterWinnings(_proposalId);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId)
    external
    onlyAfterRevealingFinishedAndProposalNotEnded(_storage, _proposalId)
  {
    if (LProposalsEnact.doProposalIsEventChallenge(_storage, _proposalId)) {
      LProposalsEnact.doEndEventChallenge(_storage, _proposalId);
    }

    LProposalsEnact.doUnlockProposalDeposit(_storage, _proposalId);

    uint votesFor = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint votesAgainst = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst, revealingEnd);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId) external view returns (uint prevTime_) {
    prevTime_ = LProposalVoting.getPrevTimeParamForCastVote(_storage, _proposalId);
  }

}
