pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LProposalWinnings.sol";
import "./LEvents.sol";
import './LAVTManager.sol';
import "./LProposalVoting.sol";

// Library for extending voting protocol functionality
library LProposal {
  bytes32 constant governanceProposalFixedDepositInUsCentsKey =
      keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUsCents"));
  bytes32 constant proposalCountKey = keccak256(abi.encodePacked("ProposalCount"));

  /// See IProposalsManager interface for events description
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);
  event LogCreateEventChallenge(uint indexed eventId, uint indexed proposalId, string supportingUrl, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);
  event LogCastVote(uint indexed proposalId, address indexed sender, bytes32 secret, uint prevTime);
  event LogRevealVote(uint indexed proposalId, uint8 indexed optId, uint revealingStart, uint revealingEnd);
  event LogClaimVoterWinnings(uint indexed proposalId);
  event LogEndProposal(uint indexed proposalId, uint votesFor, uint votesAgainst, uint revealingEnd);

  modifier onlyProposalOwner(IAventusStorage _storage, uint _proposalId) {
    require(
      msg.sender == getProposalOwner(_storage, _proposalId),
      "Method must be called by proposal owner"
    );
    _;
  }

  // TODO: Change all modifiers to be of "only..." format. Functions that
  // return a boolean should be named like this, not modifiers, ie a statement
  // that can be answered with true or false.
  // TODO: Consider returning true also if all votes have been revealed before
  // the end of the revealing period
  modifier onlyWhenProposalRevealIsComplete(IAventusStorage _storage, uint _proposalId) {
    require(LAventusTime.getCurrentTime(_storage) >= _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "end"))),
      "Proposal reveal is not complete yet"
    );
    _;
  }

  modifier proposalHasDeposit(IAventusStorage _storage, uint _proposalId) {
    require(
      getProposalDeposit(_storage, _proposalId) != 0,
      "Proposal does not have a deposit"
    );
    _;
  }

  // Verify a proposal's status (see getProposalStatus for values)
  modifier isStatus(IAventusStorage _storage, uint _proposalId, uint _status) {
    require(
      _status == getProposalStatus(_storage, _proposalId),
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
    proposalId_ = createProposal(_storage, _desc, getGovernanceProposalDeposit(_storage));

    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "revealingEnd")));
    uint lobbyingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "lobbyingStart")));

    emit LogCreateProposal(msg.sender, _desc, proposalId_, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function castVote(
    IAventusStorage _storage,
    uint _proposalId,
    bytes32 _secret,
    uint _prevTime
  )
    external
    isStatus(_storage, _proposalId, 2) // Ensure voting period is currently active
  {
    LProposalVoting.castVote(_storage, _proposalId, _secret, _prevTime);
    emit LogCastVote(_proposalId, msg.sender, _secret, _prevTime);
  }

  function revealVote(IAventusStorage _storage, bytes _signedMessage, uint _proposalId, uint8 _optId) external {
    // Make sure proposal status is Reveal or after.
    uint proposalStatus = getProposalStatus(_storage, _proposalId);
    LProposalVoting.revealVote(_storage, _signedMessage, _proposalId, _optId, proposalStatus);

    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogRevealVote(_proposalId, _optId, revealingStart, revealingEnd);
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
    challengeProposalId_ = createProposal(_storage, "", deposit);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "ChallengeEvent")), _eventId);
    LEvents.setEventAsChallenged(_storage, _eventId, challengeProposalId_);

    bytes32 supportingUrlKey = keccak256(abi.encodePacked("Event", _eventId, "eventSupportURL"));
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "revealingEnd")));
    uint lobbyingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "lobbyingStart")));
    emit LogCreateEventChallenge(_eventId, challengeProposalId_, _storage.getString(supportingUrlKey), lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
    LProposalWinnings.claimVoterWinnings(_storage, _proposalId);
    emit LogClaimVoterWinnings(_proposalId);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId) external
    isStatus(_storage, _proposalId, 4)
  {
    if (proposalIsEventChallenge(_storage, _proposalId)) {
      endEventChallenge(_storage, _proposalId);
    }
    unlockProposalDeposit(_storage, _proposalId);

    uint votesFor = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint votesAgainst = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst, revealingEnd);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId) external view returns (uint prevTime_) {
    prevTime_ = LProposalVoting.getPrevTimeParamForCastVote(_storage, _proposalId);
  }

  // @return AVT value with 18 decimal places of precision.
  function getGovernanceProposalDeposit(IAventusStorage _storage) view public returns (uint depositInAVT_) {
    uint depositInUSCents = _storage.getUInt(governanceProposalFixedDepositInUsCentsKey);
    depositInAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function unlockProposalDeposit(IAventusStorage _storage, uint _proposalId) private
  {
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
  * @param _desc Either just a title or a pointer to IPFS details
  * @param _deposit Deposit that has to have been paid for this proposal
  * @return uint proposalId_ of newly created proposal
  */
  function createProposal(IAventusStorage _storage, string _desc, uint _deposit)
    private
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

    _storage.setString(keccak256(abi.encodePacked("Proposal", proposalId_, "description")), _desc);
    _storage.setAddress(keccak256(abi.encodePacked("Proposal", proposalId_, "owner")), owner);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", proposalId_, "deposit")), _deposit);
    _storage.setUInt(proposalCountKey, proposalId_);
    setProposalTimes(_storage, proposalId_);
  }

  // NOTE: We allow an event challenge to straddle the ticket sales time on purpose: if
  // the event is under challenge at ticket sale time it will NOT block ticket sales.
  function setProposalTimes(IAventusStorage _storage, uint _proposalId)
    private
    onlyProposalOwner(_storage, _proposalId)
    isStatus(_storage, _proposalId, 0)
  {
    uint lobbyingStart = LAventusTime.getCurrentTime(_storage);
    uint votingStart = lobbyingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_storage, _proposalId) ?
            "eventChallengeLobbyingPeriodDays" :
            "governanceProposalLobbyingPeriodDays"))));
    uint revealingStart = votingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_storage, _proposalId) ?
            "eventChallengeVotingPeriodDays" :
            "governanceProposalVotingPeriodDays"))));
    uint revealingEnd = revealingStart + (1 days * _storage.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_storage, _proposalId) ?
            "eventChallengeRevealingPeriodDays" :
            "governanceProposalRevealingPeriodDays"))));

    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "lobbyingStart")), lobbyingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")), votingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")), revealingStart);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")), revealingEnd);
  }

  function doEndEventChallenge(IAventusStorage _storage, uint _proposalId, uint _eventId,
      uint _totalAgreedStake, uint _totalDisagreedStake) private {
    // Note: a "draw" is taken as not agreeing with the challenge.
    uint8 winningOption = _totalAgreedStake > _totalDisagreedStake ? 1 : 2;

    uint totalWinningStake;
    bool challengeWon = challengerIsWinner(winningOption);
    if (challengeWon) {
      LEvents.setEventStatusFraudulent(_storage, _eventId);
      totalWinningStake = _totalAgreedStake;
    } else {
      LEvents.setEventAsClearFromChallenge(_storage, _eventId);
      totalWinningStake = _totalDisagreedStake;
    }

    uint deposit = getProposalDeposit(_storage, _proposalId);
    address challenger = getProposalOwner(_storage, _proposalId);
    address eventOwner = LEvents.getEventOwner(_storage, _eventId);
    LProposalWinnings.doEventWinningsDistribution(_storage, _proposalId, winningOption, challengeWon, deposit, challenger, eventOwner);

    // Save the information we need to calculate voter winnings when they make their claim.
    _storage.setUInt8(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")), winningOption);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")), totalWinningStake);
  }

  function endEventChallenge(IAventusStorage _storage, uint _proposalId)
    private
    returns (uint eventId_)
  {
    eventId_ = getEventIdFromChallengeProposalId(_storage, _proposalId);

    uint totalAgreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint totalDisagreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    doEndEventChallenge(_storage, _proposalId, eventId_, totalAgreedStake, totalDisagreedStake);
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

  /**
  * @dev Gets a given proposal's current status
  * @param _storage Storage contract
  * @param _proposalId Proposal ID
  * @return Status number: 0 non-existent, 1 lobbying; 2 voting; 3 revealing; 4 revealing finished, 5 ended
  */
  function getProposalStatus(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (uint8 statusNum_)
  {
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    uint deposit = getProposalDeposit(_storage, _proposalId);

    uint currentTime = LAventusTime.getCurrentTime(_storage);

    if (votingStart == 0)
      statusNum_ = 0;
    else if (currentTime < votingStart)
      statusNum_ = 1; // Lobbying
    else if (currentTime < revealingStart)
      statusNum_ = 2; // Voting
    else if (currentTime < revealingEnd)
      statusNum_ = 3; // Revealing
    else if (deposit != 0)
      statusNum_ = 4; // Revealing Finished, proposal not ended
    else
      statusNum_ = 5; // Proposal ended
  }

  function proposalIsEventChallenge(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (bool proposalIsAnEventChallenge_) {
    proposalIsAnEventChallenge_ = getEventIdFromChallengeProposalId(_storage, _proposalId) != 0;
  }

  function getEventIdFromChallengeProposalId(IAventusStorage _storage, uint _challengeProposalId) private view
    returns (uint eventId_)
  {
    eventId_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _challengeProposalId, "ChallengeEvent")));
  }

  function challengerIsWinner(uint8 _winningOption) private pure returns (bool challengerIsWinner_) {
    challengerIsWinner_ = (_winningOption == 1);
  }
}
