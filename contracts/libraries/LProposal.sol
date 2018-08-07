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
  event LogCreateAventityChallenge(uint indexed aventityId, uint indexed proposalId, string supportingUrl, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);
  event LogCastVote(address indexed sender, uint indexed proposalId, bytes32 secret, uint prevTime);
  event LogRevealVote(address indexed sender, uint indexed proposalId, uint8 indexed optId, uint revealingStart, uint revealingEnd);
  event LogClaimVoterWinnings(uint indexed proposalId);
  event LogEndProposal(uint indexed proposalId, uint votesFor, uint votesAgainst, uint revealingEnd);

  struct Periods {
    uint lobbyingStart;
    uint votingStart;
    uint revealingStart;
    uint revealingEnd;
  }

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

  modifier aventityIsActiveAndNotUnderChallenge(IAventusStorage _storage, uint _aventityId) {
    require(
      LAventities.aventityIsActiveAndNotUnderChallenge(_storage, _aventityId),
      "Aventity must be valid and not under challenge"
    );
    _;
  }

  function createGovernanceProposal(IAventusStorage _storage, string _desc)
    external
    returns (uint proposalId_)
  {
    proposalId_ = LProposalsEnact.doCreateProposal(_storage, getGovernanceProposalDeposit(_storage));
    Periods memory periods = getPeriods(_storage, proposalId_);
    emit LogCreateProposal(msg.sender, _desc, proposalId_, periods.lobbyingStart, periods.votingStart, periods.revealingStart, periods.revealingEnd);
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
    returns (uint challengeProposalId_)
  {
    uint aventityId = LAventities.getAventityIdFromEventId(_storage, _eventId, "Event");
    challengeProposalId_ = createAventityChallenge(_storage, aventityId);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
    LProposalWinnings.claimVoterWinnings(_storage, _proposalId);
    emit LogClaimVoterWinnings(_proposalId);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId)
    external
    onlyAfterRevealingFinishedAndProposalNotEnded(_storage, _proposalId)
  {
    if (LProposalsEnact.doProposalIsAventityChallenge(_storage, _proposalId)) {
      LProposalsEnact.doEndAventityChallenge(_storage, _proposalId);
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

  /**
  * @dev Create an aventity challenge for the specified aventity to be voted on.
  * @param _storage Storage contract address
  * @param _aventityId - aventity id for the aventity in context
  */
  function createAventityChallenge(IAventusStorage _storage, uint _aventityId)
    public
    aventityIsActiveAndNotUnderChallenge(_storage, _aventityId)
    returns (uint challengeProposalId_)
  {
    uint deposit = LAventities.getExistingAventityDeposit(_storage, _aventityId);
    challengeProposalId_ = LProposalsEnact.doCreateProposal(_storage, deposit);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "ChallengeAventity")), _aventityId);
    LAventities.setAventityAsChallenged(_storage, _aventityId, challengeProposalId_);

    bytes32 supportingUrlKey = keccak256(abi.encodePacked("Aventity", _aventityId, "evidenceURL"));
    Periods memory periods = getPeriods(_storage, challengeProposalId_);

    uint entityId = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "entityId")));
    if (entityId != 0)
      emit LogCreateEventChallenge(entityId, challengeProposalId_, _storage.getString(supportingUrlKey), periods.lobbyingStart, periods.votingStart, periods.revealingStart, periods.revealingEnd);
    else
      emit LogCreateAventityChallenge(_aventityId, challengeProposalId_, _storage.getString(supportingUrlKey), periods.lobbyingStart, periods.votingStart, periods.revealingStart, periods.revealingEnd);
  }

  function getPeriods(IAventusStorage _storage, uint _proposalId) private view returns (Periods) {
    return Periods({
      lobbyingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "lobbyingStart"))),
      votingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart"))),
      revealingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart"))),
      revealingEnd: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")))
    });
  }
}
