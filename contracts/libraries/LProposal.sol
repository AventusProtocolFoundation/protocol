pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LChallengeWinnings.sol";
import "./LEvents.sol";
import './LLock.sol';

// Library for extending voting protocol functionality
library LProposal {
  bytes32 constant governanceProposalFixedDepositInUsCentsKey =
      keccak256("Proposal", "governanceProposalFixedDepositInUsCents");
  bytes32 constant winningsForChallengeWinnerPercentageKey =
      keccak256("Events", "winningsForChallengeWinnerPercentage");
  bytes32 constant winningsForChallengeEnderPercentageKey =
      keccak256("Events", "winningsForChallengeEnderPercentage");
  bytes32 constant proposalCountKey = keccak256("ProposalCount");

  modifier onlyProposalOwner(IAventusStorage _s, uint _proposalId) {
    require (msg.sender == getProposalOwner(_s, _proposalId));
    _;
  }

  // TODO: Change all modifiers to be of "only..." format. Functions that
  // return a boolean should be named like this, not modifiers, ie a statement
  // that can be answered with true or false.
  // TODO: Consider returning true also if all votes have been revealed before
  // the end of the revealing period
  modifier onlyWhenProposalRevealIsComplete(IAventusStorage _s, uint _proposalId) {
    require(getCurrentTime(_s) >= _s.getUInt(keccak256("Proposal", _proposalId, "end")));
    _;
  }

  modifier proposalHasDeposit(IAventusStorage _storage, uint _proposalId) {
    require(getProposalDeposit(_storage, _proposalId) != 0);
    _;
  }

  // Verify a proposal's status (see getProposalStatus for values)
  modifier isStatus(IAventusStorage s, uint proposalId, uint status) {
    require (status == getProposalStatus(s, proposalId));
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

  function setProposalDeposit(IAventusStorage _storage, uint _proposalId, uint _deposit) private {
    _storage.setUInt(keccak256("Proposal", _proposalId, "deposit"), _deposit);
  }

  function getProposalDeposit(IAventusStorage _storage, uint _proposalId)
    private
    view
    returns (uint _deposit)
  {
    _deposit = _storage.getUInt(keccak256("Proposal", _proposalId, "deposit"));
  }

  function unlockProposalDeposit(IAventusStorage _s, uint _proposalId) private
  {
    address proposalOwner = getProposalOwner(_s, _proposalId);
    bytes32 expectedDepositsKey = keccak256("ExpectedDeposits", proposalOwner);
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

    bytes32 expectedDepositsKey = keccak256("ExpectedDeposits", owner);
    _s.setUInt(expectedDepositsKey, _s.getUInt(expectedDepositsKey) + _deposit);

    uint expectedDeposits = _s.getUInt(expectedDepositsKey);
    uint actualDeposits = _s.getUInt(keccak256("Lock", "deposit", owner));
    require(actualDeposits >= expectedDeposits);

    uint proposalCount = _s.getUInt(proposalCountKey);
    uint proposalId = proposalCount + 1;

    _s.setString(keccak256("Proposal", proposalId, "description"), _desc);
    _s.setAddress(keccak256("Proposal", proposalId, "owner"), owner);
    setProposalDeposit(_s, proposalId, _deposit);

    _s.setUInt(proposalCountKey, proposalId);

    setProposalTimes(_s, proposalId);
    return proposalId;
  }

  function getProposalOwner(IAventusStorage _s, uint _proposalId)
    private
    view
    returns (address _owner)
  {
    _owner = _s.getAddress(keccak256("Proposal", _proposalId, "owner"));
  }

  function getCurrentTime(IAventusStorage s) view private returns (uint) {
    return LAventusTime.getCurrentTime(s);
  }

  // NOTE: We allow an event challenge to straddle the ticket sales time on purpose: if
  // the event is under challenge at ticket sale time it will NOT block ticket sales.
  function setProposalTimes(IAventusStorage _s, uint _proposalId)
    private
    onlyProposalOwner(_s, _proposalId)
    isStatus(_s, _proposalId, 0)
  {
    uint lobbyingStart = getCurrentTime(_s);
    uint votingStart = lobbyingStart + (1 days * _s.getUInt(keccak256("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeLobbyingPeriodDays" :
            "governanceProposalLobbyingPeriodDays")));
    uint revealingStart = votingStart + (1 days * _s.getUInt(keccak256("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeVotingPeriodDays" :
            "governanceProposalVotingPeriodDays")));
    uint revealingEnd = revealingStart + (1 days * _s.getUInt(keccak256("Proposal",
        proposalIsEventChallenge(_s, _proposalId) ?
            "eventChallengeRevealingPeriodDays" :
            "governanceProposalRevealingPeriodDays")));

    _s.setUInt(keccak256("Proposal", _proposalId, "lobbyingStart"), lobbyingStart);
    _s.setUInt(keccak256("Proposal", _proposalId, "votingStart"), votingStart);
    _s.setUInt(keccak256("Proposal", _proposalId, "revealingStart"), revealingStart);
    _s.setUInt(keccak256("Proposal", _proposalId, "revealingEnd"), revealingEnd);
  }

  /**
   * @dev Get the prevTime parameter that is needed to pass in to castVote, ie
   * the previous entry in the sender's voting DLL.
   * @param s Storage contract
   * @param proposalId Proposal ID
   */
  function getPrevTimeParamForCastVote(IAventusStorage s, uint proposalId) public view returns (uint prevTime) {
    address voter = msg.sender;
    uint proposalRevealTime = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));
    require(proposalRevealTime != 0); // Invalid proposal.
    if (s.getUInt(keccak256("Voting", voter, proposalRevealTime, "count")) != 0) {
      // We have an entry in the DLL for this time already.
      return s.getUInt(keccak256("Voting", voter, proposalRevealTime, "prevTime"));
    }
    // Find where we would insert a new node; start looking at the head.
    prevTime = 0;
    while (true) {
      uint nextTime = s.getUInt(keccak256("Voting", voter, prevTime, "nextTime"));
      if (nextTime == 0 || proposalRevealTime < nextTime) {
        break;
      }
      prevTime = nextTime;
    }
  }

  /**
  * @dev Cast a vote on one of a given proposal's options
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @param secret The secret vote: Sha3(signed Sha3(option ID))
  * @param prevTime The previous entry in the doubly linked list (DLL).
  */
  function castVote(
    IAventusStorage s,
    uint proposalId,
    bytes32 secret,
    uint prevTime
  )
    public
    isStatus(s, proposalId, 2) // Ensure voting period is currently active
  {
    bytes32 secretKey = keccak256("Voting", msg.sender, "secrets", proposalId);
    // TODO: Consider allowing users to change their vote before reveal period.
    require(s.getBytes32(secretKey) == 0);
    s.setBytes32(secretKey, secret);

    addSendersVoteToDLL(s, proposalId, prevTime);
  }

  // Add the vote to the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function addSendersVoteToDLL(IAventusStorage s, uint proposalId, uint prevTime) private {
    address voter = msg.sender;

    // The proposal's reveal period start time, used for position in the reveal time DLL.
    uint proposalRevealTime = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));

    // The number of proposals, that the voter has voted on, that are revealing at the same time as this one.
    uint numVotes = s.getUInt(keccak256("Voting", voter, proposalRevealTime, "count"));

    // If no other votes at this time, create new node in the DLL.
    if (numVotes == 0) {
      // Make sure that the prev and next entries are valid first.
      uint nextTime = s.getUInt(keccak256("Voting", voter, prevTime, "nextTime"));
      if (prevTime != 0) require(prevTime < proposalRevealTime && s.getUInt(keccak256("Voting", voter, prevTime, "count")) != 0);
      if (nextTime != 0) require(proposalRevealTime < nextTime && s.getUInt(keccak256("Voting", voter, nextTime, "count")) != 0);

      // Create new entry in the DLL betwwen prevTime and nextTime.
      s.setUInt(keccak256("Voting", voter, proposalRevealTime, "prevTime"), prevTime);
      s.setUInt(keccak256("Voting", voter, proposalRevealTime, "nextTime"), nextTime);
      s.setUInt(keccak256("Voting", voter, prevTime, "nextTime"), proposalRevealTime);
      s.setUInt(keccak256("Voting", voter, nextTime, "prevTime"), proposalRevealTime);
    }

    s.setUInt(keccak256("Voting", voter, proposalRevealTime, "count"), numVotes + 1);
  }

  /**
  * @dev Reveal a vote on a proposal
  * @param _storage Storage contract
  * @param _proposalId Proposal ID
  * @param _optId ID of option that was voted on
  * @param _ecdsaV User's ECDSA signature v value
  * @param _ecdsaR User's ECDSA signature r value
  * @param _ecdsaS User's ECDSA signature s value
  */
  // TODO: Consider uint8 for optId: uint is for historical reasons only.
  function revealVote(IAventusStorage _storage, uint _proposalId, uint8 _optId, uint8 _ecdsaV, bytes32 _ecdsaR, bytes32 _ecdsaS) public {
    // Make sure proposal status is Reveal or after.
    uint proposalStatus = getProposalStatus(_storage, _proposalId);
    require (proposalStatus >= 3);
    require (_optId == 1 || _optId == 2);

    // Get voter public key from message and ECDSA components
    address voter = ecrecover(getPrefixedMessage(keccak256((_proposalId * 10) + _optId)), _ecdsaV, _ecdsaR, _ecdsaS);
    require(voter == msg.sender);

    // Make sure the stored vote is the same as the revealed one.
    require(_storage.getBytes32(keccak256("Voting", voter, "secrets", _proposalId)) ==
        keccak256(uint(_ecdsaV), _ecdsaR, _ecdsaS));

    // IFF we are still in the reveal period AND the user has non-zero stake at reveal time...
    uint stake = _storage.getUInt(keccak256("Lock", "stake", voter));
    if (proposalStatus == 3 && stake != 0) {
      // ...increment the total stake for this option with the voter's stake...
      bytes32 totalStakeForOptionKey = keccak256("Proposal", _proposalId, "revealedStake", _optId);
      _storage.setUInt(totalStakeForOptionKey, _storage.getUInt(totalStakeForOptionKey) + stake);

      // ...and store it so we can use it later to calculate winnings.
      bytes32 revealedVotersCountKey = keccak256("Proposal", _proposalId, "revealedVotersCount", _optId);
      uint revealedVotersCount = _storage.getUInt(revealedVotersCountKey) + 1;
      _storage.setUInt(revealedVotersCountKey, revealedVotersCount);
      _storage.setAddress(keccak256("Proposal", _proposalId, "revealedVoter", _optId, revealedVotersCount), voter);
      _storage.setUInt(keccak256("Proposal", _proposalId, "revealedVoter", _optId, voter, "stake"), stake);
    }

    // Removing the vote will unlock the user's AVT stake for this proposal.
    removeSendersVoteFromDLL(_storage, _proposalId);
  }

  // web3.eth.sign prefixes messages with this string; we need to take it into consideration.
  // TODO: Share this with LEvents code, and anywhere else signing is used.
  function getPrefixedMessage(bytes32 _input)
    private
    pure
    returns (bytes32 _prefixedMsg)
  {
    _prefixedMsg = keccak256("\x19Ethereum Signed Message:\n32", _input);
  }


  // Remove the vote from the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function removeSendersVoteFromDLL(IAventusStorage s, uint proposalId) private {
    address voter = msg.sender;
    uint proposalRevealTime = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));
    uint numVotes = s.getUInt(keccak256("Voting", voter, proposalRevealTime, "count"));
    require(numVotes != 0); // Check that the user has actually voted on this proposal.

    // If this was the only vote, remove the entire entry from the DLL.
    if (numVotes == 1) {
      uint prevTime = s.getUInt(keccak256("Voting", voter, proposalRevealTime, "prevTime"));
      uint nextTime = s.getUInt(keccak256("Voting", voter, proposalRevealTime, "nextTime"));

      s.setUInt(keccak256("Voting", voter, prevTime, "nextTime"), nextTime);
      s.setUInt(keccak256("Voting", voter, nextTime, "prevTime"), prevTime);
    } else {
      s.setUInt(keccak256("Voting", voter, proposalRevealTime, "count"), numVotes - 1);
    }

    s.deleteBytes32(keccak256("Voting", voter, "secrets", proposalId));
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
    uint votingStart = _storage.getUInt(keccak256("Proposal", _proposalId, "votingStart"));
    uint revealingStart = _storage.getUInt(keccak256("Proposal", _proposalId, "revealingStart"));
    uint revealingEnd = _storage.getUInt(keccak256("Proposal", _proposalId, "revealingEnd"));
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

  modifier eventIsNotUnderChallenge(IAventusStorage _s, uint _eventId) {
    require(LEvents.eventIsNotUnderChallenge(_s, _eventId));
    _;
  }

  function proposalIsEventChallenge(IAventusStorage _s, uint _proposalId)
    view
    private
    returns (bool _proposalIsAnEventChallenge) {
    _proposalIsAnEventChallenge = getEventIdFromChallengeProposalId(_s, _proposalId) != 0;
  }

  /**
  * @dev Create a challenge for the specified event to be voted on.
  * @param _storage Storage contract address
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(IAventusStorage _storage, uint _eventId)
    eventIsNotUnderChallenge(_storage, _eventId)
    public
    returns (uint challengeProposalId)
  {
    uint deposit = LEvents.getExistingEventDeposit(_storage, _eventId);
    challengeProposalId = createProposal(_storage, "", deposit);
    _storage.setUInt(keccak256("Proposal", challengeProposalId, "ChallengeEvent"), _eventId);
    LEvents.setEventAsChallenged(_storage, _eventId, challengeProposalId);
  }

  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) public {
    LChallengeWinnings.claimVoterWinnings(_storage, _proposalId);
  }

  function getEventIdFromChallengeProposalId(IAventusStorage _s, uint _challengeProposalId) view private
    returns(uint eventId)
  {
    eventId = _s.getUInt(keccak256("Proposal", _challengeProposalId, "ChallengeEvent"));
  }

  function endProposal(IAventusStorage _storage, uint _proposalId) public
    isStatus(_storage, _proposalId, 4)
  {
    if (proposalIsEventChallenge(_storage, _proposalId)) {
      endEventChallenge(_storage, _proposalId);
    }
    unlockProposalDeposit(_storage, _proposalId);
  }

  function challengerIsWinner(uint8 _winningOption) private pure returns(bool _challengerIsWinner) {
    _challengerIsWinner = (_winningOption == 1);
  }

  function endEventChallenge(IAventusStorage _storage, uint _proposalId)
    private
    returns(uint _eventId)
  {
    _eventId = getEventIdFromChallengeProposalId(_storage, _proposalId);

    uint totalAgreedStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint8(1)));
    uint totalDisagreedStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint8(2)));
    doEndEventChallenge(_storage, _proposalId, _eventId, totalAgreedStake, totalDisagreedStake);
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

    doEventWinningsDistribution(_storage, _proposalId, _eventId, winningOption);

    // Save the information we need to calculate voter winnings when they make their claim.
    _storage.setUInt8(keccak256("Proposal", _proposalId, "winningOption"), winningOption);
    _storage.setUInt(keccak256("Proposal", _proposalId, "totalWinningStake"), totalWinningStake);
  }

  function doEventWinningsDistribution(IAventusStorage _storage, uint _proposalId, uint _eventId,
      uint8 _winningOption) private {
    address challenger = getProposalOwner(_storage, _proposalId);
    address eventOwner = LEvents.getEventOwner(_storage, _eventId);
    bool challengeWon = challengerIsWinner(_winningOption);
    LChallengeWinnings.distributeChallengeWinnings(
        _storage,
        _proposalId,
        challengeWon ? challenger : eventOwner, // winner
        challengeWon ? eventOwner : challenger, // loser
        getProposalDeposit(_storage, _proposalId), // winnings
        0 ==_storage.getUInt(keccak256("Proposal", _proposalId, "revealedVotersCount", _winningOption)), // challengeHasNoRevealedVotes
        _storage.getUInt8(winningsForChallengeWinnerPercentageKey),
        _storage.getUInt8(winningsForChallengeEnderPercentageKey)
    );
  }
}