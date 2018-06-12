pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LProposalWinnings.sol";
import "./LEvents.sol";
import './LLock.sol';
import "./LProposalVoting.sol";

// Library for extending voting protocol functionality
library LProposal {
  bytes32 constant governanceProposalFixedDepositInUsCentsKey =
      keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUsCents"));
  bytes32 constant proposalCountKey = keccak256(abi.encodePacked("ProposalCount"));

  modifier onlyProposalOwner(IAventusStorage _s, uint _proposalId) {
    require(
      msg.sender == getProposalOwner(_s, _proposalId),
      "Method must be called by proposal's owner"
    );
    _;
  }

  // TODO: Change all modifiers to be of "only..." format. Functions that
  // return a boolean should be named like this, not modifiers, ie a statement
  // that can be answered with true or false.
  // TODO: Consider returning true also if all votes have been revealed before
  // the end of the revealing period
  modifier onlyWhenProposalRevealIsComplete(IAventusStorage _s, uint _proposalId) {
    require(getCurrentTime(_s) >= _s.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "end"))),
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
  modifier isStatus(IAventusStorage _s, uint _proposalId, uint _status) {
    require(
      _status == getProposalStatus(_s, _proposalId),
      "Proposal has the wrong status"
    );
    _;
  }

  modifier eventIsNotUnderChallenge(IAventusStorage _s, uint _eventId) {
    require(
      LEvents.eventIsNotUnderChallenge(_s, _eventId),
      "Event is being challenged"
    );
    _;
  }

  // @return AVT value with 18 decimal places of precision.
  function getGovernanceProposalDeposit(IAventusStorage _storage) view public returns (uint _depositInAVT) {
    uint depositInUSCents = _storage.getUInt(governanceProposalFixedDepositInUsCentsKey);
    _depositInAVT = LLock.getAVTDecimals(_storage, depositInUSCents);
  }

  function createGovernanceProposal(IAventusStorage s, string desc)
    public
    returns (uint)
  {
    return createProposal(s, desc, getGovernanceProposalDeposit(s));
  }

  function castVote(
    IAventusStorage s,
    uint proposalId,
    bytes32 secret,
    uint prevTime
  )
    public
    isStatus(s, proposalId, 2) // Ensure voting period is currently active
  {
    LProposalVoting.castVote(s, proposalId, secret, prevTime);
  }

  function revealVote(IAventusStorage _storage, uint _proposalId, uint8 _optId, uint8 _ecdsaV, bytes32 _ecdsaR, bytes32 _ecdsaS) public {
    // Make sure proposal status is Reveal or after.
    uint proposalStatus = getProposalStatus(_storage, _proposalId);
    return LProposalVoting.revealVote(_storage, _proposalId, _optId, _ecdsaV, _ecdsaR, _ecdsaS, proposalStatus);
  }

  /**
  * @dev Create a challenge for the specified event to be voted on.
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(IAventusStorage _storage, uint _eventId)
    public
    eventIsNotUnderChallenge(_storage, _eventId)
    returns (uint challengeProposalId)
  {
    uint deposit = LEvents.getExistingEventDeposit(_storage, _eventId);
    challengeProposalId = createProposal(_storage, "", deposit);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId, "ChallengeEvent")), _eventId);
    LEvents.setEventAsChallenged(_storage, _eventId, challengeProposalId);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) public {
    LProposalWinnings.claimVoterWinnings(_storage, _proposalId);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId) public
    isStatus(_storage, _proposalId, 4)
  {
    if (proposalIsEventChallenge(_storage, _proposalId)) {
      endEventChallenge(_storage, _proposalId);
    }
    unlockProposalDeposit(_storage, _proposalId);
  }

  function getPrevTimeParamForCastVote(IAventusStorage s, uint proposalId) public view returns (uint) {
    return LProposalVoting.getPrevTimeParamForCastVote(s, proposalId);
  }

  function setProposalDeposit(IAventusStorage _storage, uint _proposalId, uint _deposit) private {
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "deposit")), _deposit);
  }

  function unlockProposalDeposit(IAventusStorage _s, uint _proposalId) private
  {
    address proposalOwner = getProposalOwner(_s, _proposalId);
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", proposalOwner));
    uint expectedDeposits = _s.getUInt(expectedDepositsKey);
    uint proposalDeposit = getProposalDeposit(_s, _proposalId);
    assert(expectedDeposits >= proposalDeposit);
    _s.setUInt(expectedDepositsKey, expectedDeposits - proposalDeposit);
    setProposalDeposit(_s, _proposalId, 0);
  }

  /**
  * @dev Create a proposal to be voted on
  * @param _s Storage contract
  * @param _desc Either just a title or a pointer to IPFS details
  * @param _deposit Deposit that has to have been paid for this proposal
  * @return uint proposalId of newly created proposal
  */
  function createProposal(IAventusStorage _s, string _desc, uint _deposit)
    private
    returns (uint)
  {
    address owner = msg.sender;

    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", owner));
    _s.setUInt(expectedDepositsKey, _s.getUInt(expectedDepositsKey) + _deposit);

    uint expectedDeposits = _s.getUInt(expectedDepositsKey);
    uint actualDeposits = _s.getUInt(keccak256(abi.encodePacked("Lock", "deposit", owner)));
    require(
      actualDeposits >= expectedDeposits,
      "Owner has insufficient deposit funds to create a proposal"
    );

    uint proposalCount = _s.getUInt(proposalCountKey);
    uint proposalId = proposalCount + 1;

    _s.setString(keccak256(abi.encodePacked("Proposal", proposalId, "description")), _desc);
    _s.setAddress(keccak256(abi.encodePacked("Proposal", proposalId, "owner")), owner);
    setProposalDeposit(_s, proposalId, _deposit);

    _s.setUInt(proposalCountKey, proposalId);

    setProposalTimes(_s, proposalId);
    return proposalId;
  }


  // NOTE: We allow an event challenge to straddle the ticket sales time on purpose: if
  // the event is under challenge at ticket sale time it will NOT block ticket sales.
  function setProposalTimes(IAventusStorage _s, uint _proposalId)
    private
    onlyProposalOwner(_s, _proposalId)
    isStatus(_s, _proposalId, 0)
  {
    uint lobbyingStart = getCurrentTime(_s);
    uint votingStart = lobbyingStart + (1 days * _s.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeLobbyingPeriodDays" :
            "governanceProposalLobbyingPeriodDays"))));
    uint revealingStart = votingStart + (1 days * _s.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeVotingPeriodDays" :
            "governanceProposalVotingPeriodDays"))));
    uint revealingEnd = revealingStart + (1 days * _s.getUInt(keccak256(abi.encodePacked("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeRevealingPeriodDays" :
            "governanceProposalRevealingPeriodDays"))));

    _s.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "lobbyingStart")), lobbyingStart);
    _s.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")), votingStart);
    _s.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")), revealingStart);
    _s.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")), revealingEnd);
  }

  function doEndEventChallenge(IAventusStorage _storage, uint _proposalId, uint _eventId,
      uint totalAgreedStake, uint totalDisagreedStake) private {
    // Note: a "draw" is taken as not agreeing with the challenge.
    uint8 winningOption = totalAgreedStake > totalDisagreedStake ? 1 : 2;

    uint totalWinningStake;
    bool challengeWon = challengerIsWinner(winningOption);
    if (challengeWon) {
      LEvents.setEventStatusFraudulent(_storage, _eventId);
      totalWinningStake = totalAgreedStake;
    } else {
      LEvents.setEventAsClearFromChallenge(_storage, _eventId);
      totalWinningStake = totalDisagreedStake;
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
    returns(uint _eventId)
  {
    _eventId = getEventIdFromChallengeProposalId(_storage, _proposalId);

    uint totalAgreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint totalDisagreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    doEndEventChallenge(_storage, _proposalId, _eventId, totalAgreedStake, totalDisagreedStake);
  }

  function getCurrentTime(IAventusStorage s) private view returns (uint) {
    return LAventusTime.getCurrentTime(s);
  }

  function getProposalDeposit(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (uint _deposit)
  {
    _deposit = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "deposit")));
  }

  function getProposalOwner(IAventusStorage _s, uint _proposalId)
    private
    view
    returns (address _owner)
  {
    _owner = _s.getAddress(keccak256(abi.encodePacked("Proposal", _proposalId, "owner")));
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
    returns (uint8)
  {
    uint votingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart")));
    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    uint deposit = getProposalDeposit(_storage, _proposalId);

    uint currentTime = getCurrentTime(_storage);

    if (votingStart == 0)
      return 0;
    else if (currentTime < votingStart)
      return 1; // Lobbying
    else if (currentTime < revealingStart)
      return 2; // Voting
    else if (currentTime < revealingEnd)
      return 3; // Revealing
    else if (deposit != 0)
      return 4; // Revealing Finished, proposal not ended
    else
      return 5; // Proposal ended
  }

  function proposalIsEventChallenge(IAventusStorage _s, uint _proposalId)
    private
    view
    returns (bool _proposalIsAnEventChallenge) {
    _proposalIsAnEventChallenge = getEventIdFromChallengeProposalId(_s, _proposalId) != 0;
  }

  function getEventIdFromChallengeProposalId(IAventusStorage _s, uint _challengeProposalId) private view
    returns(uint eventId)
  {
    eventId = _s.getUInt(keccak256(abi.encodePacked("Proposal", _challengeProposalId, "ChallengeEvent")));
  }

  function challengerIsWinner(uint8 _winningOption) private pure returns(bool _challengerIsWinner) {
    _challengerIsWinner = (_winningOption == 1);
  }
}
