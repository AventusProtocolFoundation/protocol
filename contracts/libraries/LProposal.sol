pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEvents.sol";
import './LLock.sol';

// Library for extending voting protocol functionality
library LProposal {
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
    uint depositInUSCents = _storage.getUInt(keccak256("Proposal", "governanceProposalFixedDepositInUsCents"));
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

  function unlockProposalDeposit(IAventusStorage _s, uint _proposalId)
    private
    isStatus(_s, _proposalId, 4)
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

    uint proposalCount = _s.getUInt(keccak256("ProposalCount"));
    uint proposalId = proposalCount + 1;

    _s.setString(keccak256("Proposal", proposalId, "description"), _desc);
    _s.setAddress(keccak256("Proposal", proposalId, "owner"), owner);
    setProposalDeposit(_s, proposalId, _deposit);

    _s.setUInt(keccak256("ProposalCount"), proposalId);

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

  // TODO: Consider moving this somewhere shared for other contracts (not
  // LAventusTime as we don't want to have to duplicate it in the mock
  // version...) or removing if remove the ability to specify a lobbying start
  // time.
  function timeIsAlmostNow(IAventusStorage s, uint time) view private returns (bool) {
    // Allow a reasonable window before "now" to handle the blockchain's concept of "now".
    // Without this, a user trying to pass a timestamp that they think is "now" may be thwarted
    // by this transaction taking too long to be mined and having "now" much later
    // than expected.
    uint window = s.getUInt(keccak256("TimeIsNowWindow"));
    return (getCurrentTime(s) >= time) &&  getCurrentTime(s) - time <= window;
  }

  // NOTE: We allow an event challenge to straddle the ticket sales time on purpose: if
  // the event is under challenge at ticket sale time it will NOT block ticket sales.
  function finaliseProposal(IAventusStorage _s, uint _proposalId, uint _lobbyingStart,
      uint /*interval: TODO: remove now unused parameter*/)
    public // TODO: Consider making this private and fixing _lobbyingStart.
    onlyProposalOwner(_s, _proposalId)
    isStatus(_s, _proposalId, 0)
  {
    if (timeIsAlmostNow(_s, _lobbyingStart)) {
      _lobbyingStart = getCurrentTime(_s);
    } else {
      require(_lobbyingStart > getCurrentTime(_s));
    }
    uint votingStart = _lobbyingStart + (1 days * _s.getUInt(keccak256("Proposal",
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

    _s.setUInt(keccak256("Proposal", _proposalId, "lobbyingStart"), _lobbyingStart);
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
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @param optId ID of option that was voted on
  * @param v User's ECDSA signature(keccak256(optID)) v value
  * @param r User's ECDSA signature(keccak256(optID)) r value
  * @param s_ User's ECDSA signature(keccak256(optID)) s value
  */
  // TODO: Consider uint8 for optId: uint is for historical reasons only.
  function revealVote(IAventusStorage s, uint proposalId, uint optId, uint8 v, bytes32 r, bytes32 s_) public {
    // Make sure proposal status is Reveal or after.
    uint proposalStatus = getProposalStatus(s, proposalId);
    require (proposalStatus >= 3);
    require (optId == 1 || optId == 2);

    // Get voter public key from message and ECDSA components
    address voter = ecrecover(getPrefixedMessage(keccak256(proposalId * 10 + optId)), v, r, s_);
    require(voter == msg.sender);

    // Make sure the stored vote is the same as the revealed one.
    require (s.getBytes32(keccak256("Voting", voter, "secrets", proposalId)) ==
        keccak256(uint(v), r, s_));

    // IFF we are still in the reveal period AND the user has non-zero stake at reveal time...
    uint stake = s.getUInt(keccak256("Lock", "stake", voter));
    if (proposalStatus == 3 && stake != 0) {
      // ...increment the total stake for this option with the voter's stake...
      bytes32 totalStakeForOptionKey = keccak256("Proposal", proposalId, "revealedStake", optId);
      s.setUInt(totalStakeForOptionKey, s.getUInt(totalStakeForOptionKey) + stake);

      // ...and store it so we can use it later to calculate winnings.
      bytes32 revealedVotersCountKey = keccak256("Proposal", proposalId, "revealedVotersCount", optId);
      uint revealedVotersCount = s.getUInt(revealedVotersCountKey) + 1;
      s.setUInt(revealedVotersCountKey, revealedVotersCount);
      s.setAddress(keccak256("Proposal", proposalId, "revealedVoter", optId, revealedVotersCount), voter);
      s.setUInt(keccak256("Proposal", proposalId, "revealedVoter", optId, voter, "stake"), stake);
    }

    // Removing the vote will unlock the user's AVT stake for this proposal.
    removeSendersVoteFromDLL(s, proposalId);
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
  * @return Status number: 0 non-existent, or not finalised; 1 finalised; 2 voting; 3 revealing; 4 revealing finished, 5 ended
  */
  // TODO: Consider distinguishing between non-existent and not-finalised. Will
  // become a moot point if finalise becomes a private method.
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
      return 1; // Finalised
    else if (currentTime < revealingStart)
      return 2; // Voting Active
    else if (currentTime < revealingEnd)
      return 3; // Revealing Active
    else if (deposit != 0)
      return 4; // Revealing Finished, proposal not ended
    else
      return 5; // Proposal ended
  }

  modifier eventIsNotUnderChallenge(IAventusStorage _s, uint _eventId) {
    require(LEvents.eventIsNotUnderChallenge(_s, _eventId));
    _;
  }

  modifier onlyEventChallengeProposal(IAventusStorage _s, uint _proposalId) {
    require(proposalIsEventChallenge(_s, _proposalId));
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

  function getEventIdFromChallengeProposalId(IAventusStorage _s, uint _challengeProposalId) view private
    returns(uint eventId)
  {
    eventId = _s.getUInt(keccak256("Proposal", _challengeProposalId, "ChallengeEvent"));
  }

  function endProposal(IAventusStorage _storage, uint _proposalId) public
  {
    if (proposalIsEventChallenge(_storage, _proposalId)) {
      endEventChallenge(_storage, _proposalId);
    }
    unlockProposalDeposit(_storage, _proposalId);
  }

  function endEventChallenge(IAventusStorage _storage, uint _proposalId)
    onlyEventChallengeProposal(_storage, _proposalId)
    isStatus(_storage, _proposalId, 4)
    private
    returns(uint _eventId)
  {
    _eventId = getEventIdFromChallengeProposalId(_storage, _proposalId);

    uint totalAgreedStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint(1)));
    uint totalDisagreedStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedStake", uint(2)));
    uint winningOption = totalAgreedStake > totalDisagreedStake ? 1 : 2;
    bool votersAgreedWithChallenger = winningOption == 1;
    if (votersAgreedWithChallenger) {
      LEvents.setEventStatusFraudulent(_storage, _eventId);
    } else {
      LEvents.setEventAsClearFromChallenge(_storage, _eventId);
    }
    address eventOwner = LEvents.getEventOwner(_storage, _eventId);
    uint totalWinningStake = votersAgreedWithChallenger ? totalAgreedStake : totalDisagreedStake;
    distributeChallengeWinnings(_storage, _proposalId, eventOwner, votersAgreedWithChallenger, winningOption, totalWinningStake);
  }

  function distributeChallengeWinnings(
      IAventusStorage _storage,
      uint _proposalId,
      address _eventOwner,
      bool _votersAgreedWithChallenger,
      uint _winningOption,
      uint _totalWinningStake)
    private
  {
    uint winnings = getProposalDeposit(_storage, _proposalId);
    address proposalOwner = getProposalOwner(_storage, _proposalId);

    address loser = _votersAgreedWithChallenger ? _eventOwner : proposalOwner;
    takeAllWinningsFromProposalLoser(_storage, winnings, loser);

    address winner = _votersAgreedWithChallenger ? proposalOwner : _eventOwner;

    uint winningsToProposalWinnerAVT = giveFixedWinningsToProposalWinner(_storage, winner, winnings);
    uint8 winningsToChallengeEnderPercentage = _storage.getUInt8(keccak256("Events", "winningsForChallengeEnderPercentage"));
    uint winningsToChallengeEnderAVT =  (winnings * winningsToChallengeEnderPercentage) / 100;

    winnings -= winningsToProposalWinnerAVT + winningsToChallengeEnderAVT;
    winnings -= distributeWinningsAmongVoters(_storage, _proposalId, _winningOption, _totalWinningStake, winnings);

    // Give anything remaining to the address that initiated the challenge end, along with their winnings.
    giveWinningsToStakeHolder(_storage, winningsToChallengeEnderAVT + winnings, msg.sender);
  }

  // TODO: Consider keccak256("Lock", address, "deposit") format for all of
  // these calls and elsewhere: makes it clearer that deposit and stake are
  // owned by the same address, also means we will not use "LockDeposit" or
  // "LockStake" combined strings.
  // TODO: Consider usingLLock for all these get/set calls.
  function takeAllWinningsFromProposalLoser(
      IAventusStorage _storage,
      uint _winnings,
      address _loser)
    private
  {
    bytes32 depositLockKey = keccak256("Lock", "deposit", _loser);
    uint depositLock = _storage.getUInt(depositLockKey);
    assert(depositLock >= _winnings);
    _storage.setUInt(depositLockKey, depositLock - _winnings);
  }

  function giveFixedWinningsToProposalWinner(
    IAventusStorage _storage,
    address _winner,
    uint _winnings)
    private
    returns (uint _fixedWinnings)
  {
    uint8 winningsPercentage = _storage.getUInt8(keccak256("Events", "winningsForChallengeWinnerPercentage"));
    _fixedWinnings = (_winnings * winningsPercentage) / 100;
    bytes32 depositLockKey = keccak256("Lock", "deposit", _winner);
    uint depositLock = _storage.getUInt(depositLockKey);
    _storage.setUInt(depositLockKey, depositLock + _fixedWinnings);
  }

  function giveWinningsToStakeHolder(
      IAventusStorage _storage,
      uint _winnings,
      address _stakeHolder)
    private
  {
    bytes32 stakeLockKey = keccak256("Lock", "deposit", _stakeHolder);
    uint stakeLock = _storage.getUInt(stakeLockKey);
    _storage.setUInt(stakeLockKey, stakeLock + _winnings);
  }

  function distributeWinningsAmongVoters(
      IAventusStorage _storage,
      uint _proposalId,
      uint _winningOption,
      uint _totalWinningStake,
      uint _winnings)
    private
    returns (uint _winningsPaid)
  {
    uint numWinningVoters = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedVotersCount", _winningOption));
    for (uint i = 1; i <= numWinningVoters; ++i) {
      address voter = _storage.getAddress(keccak256("Proposal", _proposalId, "revealedVoter", _winningOption, i));
      uint voterStake = _storage.getUInt(keccak256("Proposal", _proposalId, "revealedVoter", _winningOption, voter, "stake"));
      uint voterReward = (_winnings * voterStake) / _totalWinningStake;
      giveWinningsToStakeHolder(_storage, voterReward, voter);
      _winningsPaid += voterReward;
    }
  }
}