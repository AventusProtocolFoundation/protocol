pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LProposalsEnact.sol";
import "./LProposalVoting.sol";

// Library for extending voting protocol functionality
library LProposal {

  bytes32 constant governanceProposalFixedDepositInUSCentsKey =
      keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUSCents"));
  /// See IProposalsManager interface for logs description.
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd, uint deposit);
  event LogCastVote(address indexed sender, uint indexed proposalId, bytes32 secret, uint prevTime);
  event LogCancelVote(address indexed sender, uint indexed proposalId);
  event LogRevealVote(address indexed sender, uint indexed proposalId, uint8 indexed optId, uint revealingStart,
      uint revealingEnd);
  event LogEndProposal(uint indexed proposalId, uint votesFor, uint votesAgainst, uint revealingEnd);

  // See Members/Events/MerkleRoots Managers for logs description.
  // TODO: Move to the respective libraries, eg LMembers, when the Period problem is fixed.
  event LogMemberChallenged(address indexed memberAddress, string memberType, uint indexed proposalId, uint lobbyingStart,
      uint votingStart, uint revealingStart, uint revealingEnd);
  event LogMerkleRootChallenged(bytes32 indexed rootHash, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd);
  event LogEventChallenged(uint indexed eventId, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd);

  struct Timestamps {
    uint lobbyingStart;
    uint votingStart;
    uint revealingStart;
    uint revealingEnd;
  }

  // Verify a proposal's status (see LProposalsEnact.doGetProposalStatus for values)
  modifier onlyInVotingPeriod(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.inVotingPeriod(_storage, _proposalId),
      "Proposal has the wrong status"
    );
    _;
  }

  modifier onlyAfterRevealingFinishedAndProposalNotEnded(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.afterRevealingFinishedAndProposalNotEnded(_storage, _proposalId),
      "Proposal has the wrong status"
    );
    _;
  }

  function createGovernanceProposal(IAventusStorage _storage, string _desc)
    external
    returns (uint proposalId_)
  {
    uint deposit = getGovernanceProposalDeposit(_storage);
    uint numDaysInLobbyingPeriod = _storage.getUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalLobbyingPeriodDays")));
    uint numDaysInVotingPeriod =_storage.getUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalVotingPeriodDays")));
    uint numDaysInRevealingPeriod =_storage.getUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalRevealingPeriodDays")));

    proposalId_ = LProposalsEnact.doCreateProposal(_storage, deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
    Timestamps memory timestamps = getTimestamps(_storage, proposalId_);
    emit LogCreateProposal(msg.sender, _desc, proposalId_, timestamps.lobbyingStart, timestamps.votingStart,
        timestamps.revealingStart, timestamps.revealingEnd, deposit);
  }

  function createProposal(IAventusStorage _storage, uint deposit, uint numDaysInLobbyingPeriod, uint numDaysInVotingPeriod,
      uint numDaysInRevealingPeriod)
    external
    returns (uint proposalId_)
  {
    proposalId_ = LProposalsEnact.doCreateProposal(_storage, deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
  }

  // TODO: do this in LMembers when we can pass the Timestamps struct.
  function emitLogMemberChallenge(
      IAventusStorage _storage, address _memberAddress, string _memberType, uint _proposalId)
    external
  {
    LProposal.Timestamps memory timestamps = getTimestamps(_storage, _proposalId);
    emit LogMemberChallenged(_memberAddress, _memberType, _proposalId, timestamps.lobbyingStart, timestamps.votingStart,
        timestamps.revealingStart, timestamps.revealingEnd);
  }

  // TODO: do this in LEvents when we can pass the Timestamps struct.
  function emitLogEventChallenged(IAventusStorage _storage, uint _eventId, uint _proposalId) external {
    LProposal.Timestamps memory timestamps = getTimestamps(_storage, _proposalId);
    emit LogEventChallenged(_eventId, _proposalId, timestamps.lobbyingStart, timestamps.votingStart, timestamps.revealingStart,
        timestamps.revealingEnd);
  }

  // TODO: do this in LMerkleRoots when we can pass the Timestamps struct.
  function emitLogMerkleRootChallenged(IAventusStorage _storage, bytes32 _rootHash, uint _proposalId) external {
    LProposal.Timestamps memory timestamps = getTimestamps(_storage, _proposalId);
    emit LogMerkleRootChallenged(_rootHash, _proposalId, timestamps.lobbyingStart, timestamps.votingStart,
        timestamps.revealingStart, timestamps.revealingEnd);
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

  // TODO: get the proposal status inside LProposalVoting.cancelVote,
  // instead of passing it from the outside
  function cancelVote(
    IAventusStorage _storage,
    uint _proposalId
  )
    external
  {
    LProposalsEnact.ProposalStatus proposalStatus = LProposalsEnact.doGetProposalStatus(_storage, _proposalId);
    LProposalVoting.cancelVote(_storage, _proposalId, proposalStatus);
    emit LogCancelVote(msg.sender, _proposalId);
  }

  // TODO: get the proposal status inside LProposalVoting.revealVote,
  // instead of passing it from the outside
  function revealVote(IAventusStorage _storage, bytes _signedMessage, uint _proposalId, uint8 _optId) external {
    // Make sure proposal status is Reveal or after.
    LProposalsEnact.ProposalStatus proposalStatus = LProposalsEnact.doGetProposalStatus(_storage, _proposalId);
    LProposalVoting.revealVote(_storage, _signedMessage, _proposalId, _optId, proposalStatus);

    uint revealingStart = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogRevealVote(msg.sender, _proposalId, _optId, revealingStart, revealingEnd);
  }

  // @return AVT value with 18 decimal places of precision.
  function getGovernanceProposalDeposit(IAventusStorage _storage) view public returns (uint depositInAVT_) {
    uint depositInUSCents = _storage.getUInt(governanceProposalFixedDepositInUSCentsKey);
    depositInAVT_ = LAVTManager.getAVTDecimals(_storage, depositInUSCents);
  }

  function endProposal(IAventusStorage _storage, uint _proposalId)
    external
    onlyAfterRevealingFinishedAndProposalNotEnded(_storage, _proposalId)
  {
    LProposalsEnact.doUnlockProposalDeposit(_storage, _proposalId);

    uint votesFor = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint votesAgainst = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));
    uint revealingEnd = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")));
    emit LogEndProposal(_proposalId, votesFor, votesAgainst, revealingEnd);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId) external view returns (uint prevTime_) {
    prevTime_ = LProposalVoting.getPrevTimeParamForCastVote(_storage, _proposalId);
  }

  function getTimestamps(IAventusStorage _storage, uint _proposalId) private view returns (Timestamps) {
    return Timestamps({
      lobbyingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "lobbyingStart"))),
      votingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "votingStart"))),
      revealingStart: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart"))),
      revealingEnd: _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingEnd")))
    });
  }

  function getAventusTime(IAventusStorage _storage) external view returns (uint time_) {
    time_ = LAventusTime.getCurrentTime(_storage);
  }
}
