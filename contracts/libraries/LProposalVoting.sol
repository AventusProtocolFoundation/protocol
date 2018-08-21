pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./zeppelin/LECRecovery.sol";
import "./LProposalsEnact.sol";

library LProposalVoting {

  modifier onlyInVotingPeriodOrAfterRevealingFinished(LProposalsEnact.ProposalStatus _proposalStatus) {
     require(
       LProposalsEnact.onlyInVotingPeriodOrAfterRevealingFinished(_proposalStatus),
       "Proposal must be in the voting period or after revealing finished"
     );
     _;
   }
  /**
  * @dev Cast a vote on one of a given proposal's options
  * @param _storage Storage contract
  * @param _proposalId Proposal ID
  * @param _secret The secret vote: Sha3(signed Sha3(option ID))
  * @param _prevTime The previous entry in the doubly linked list (DLL).
  */
  function castVote(
    IAventusStorage _storage,
    uint _proposalId,
    bytes32 _secret,
    uint _prevTime
  )
    external
    // no modifier checked, because it should have been checked at the top-level
  {
    bytes32 secretKey = keccak256(abi.encodePacked("Voting", msg.sender, "secrets", _proposalId));
    // TODO: Consider allowing users to change their vote before reveal period.
    require(
      _storage.getBytes32(secretKey) == 0,
      "Sender can vote only once for this proposal"
    );
    _storage.setBytes32(secretKey, _secret);

    addSendersVoteToDLL(_storage, _proposalId, _prevTime);
  }

  /**
   * @dev Cancel a non revealed vote
   * @param _storage Storage contract
   * @param _proposalId Proposal ID
   * @param _proposalStatus The proposal status
   */
  function cancelVote(
    IAventusStorage _storage,
    uint _proposalId,
    LProposalsEnact.ProposalStatus _proposalStatus
  )
    external
     onlyInVotingPeriodOrAfterRevealingFinished(_proposalStatus)
  {
    bytes32 secretKey = keccak256(abi.encodePacked("Voting", msg.sender, "secrets", _proposalId));
    bytes32 secret = _storage.getBytes32(secretKey);

    require(
      secret != 0,
      "Sender must have a non revealed vote"
    );

    removeSendersVoteFromDLL(_storage, _proposalId);
  }

  /**
  * @dev Reveal a vote on a proposal
  * @param _storage Storage contract
  * @param _proposalId Proposal ID
  * @param _optId ID of option that was voted on
  * @param _signedMessage a signed message
  * @param _proposalStatus The current status of the proposal
  */
  // TODO: extract the condition to test if the proposal is in the revealing phase to LProposalsEnact
  function revealVote(IAventusStorage _storage, bytes _signedMessage, uint _proposalId, uint8 _optId, LProposalsEnact.ProposalStatus _proposalStatus)
    external
  {
    // this is not a modifier because that would cause a stack too deep error
    require (
      LProposalsEnact.onlyInRevealingPeriodOrLater(_proposalStatus),
      "A vote can only be revealed in the revealing phase or later"
    );
    require (
      _optId == 1 || _optId == 2,
      "Vote must be only 1 or 2"
    );

    // Get voter public key from message and signature
    bytes32 msgHash = keccak256(abi.encodePacked((_proposalId * 10) + _optId));
    msgHash = LECRecovery.toEthSignedMessageHash(msgHash);
    address voter = LECRecovery.recover(msgHash, _signedMessage);
    require(
      voter == msg.sender,
      "Reveal vote must be called only by the voter"
    );

    // Make sure the stored vote is the same as the revealed one.
    require(
      _storage.getBytes32(keccak256(abi.encodePacked("Voting", voter, "secrets", _proposalId))) ==
        keccak256(abi.encodePacked(_signedMessage)),
        "Stored vote must be the same as the revealed one"
    );

    // IFF we are still in the reveal period AND the user has non-zero stake at reveal time...
    uint stake = LAVTManager.getBalance(_storage, voter, "stake");
    if (_proposalStatus == LProposalsEnact.ProposalStatus.Revealing && stake != 0) {
      // ...increment the total stake for this option with the voter's stake...
      bytes32 totalStakeForOptionKey = keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", _optId));
      _storage.setUInt(totalStakeForOptionKey, _storage.getUInt(totalStakeForOptionKey) + stake);

      // ...and store it so we can use it later to calculate winnings.
      bytes32 revealedVotersCountKey = keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVotersCount", _optId));
      uint revealedVotersCount = _storage.getUInt(revealedVotersCountKey) + 1;
      _storage.setUInt(revealedVotersCountKey, revealedVotersCount);
      _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVoter", _optId, voter, "stake")), stake);
    }

    removeSendersVoteFromDLL(_storage, _proposalId);
  }

  /**
   * @dev Get the prevTime parameter that is needed to pass in to castVote, ie
   * the previous entry in the sender's voting DLL.
   * @param _storage Storage contract
   * @param _proposalId Proposal ID
   */
  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId) external view returns (uint prevTime_) {
    address voter = msg.sender;
    uint proposalRevealTime = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    require(
      proposalRevealTime != 0,
      "Proposal must have a reveal starting time"
    ); // Invalid proposal.
    if (_storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count"))) != 0) {
      // We have an entry in the DLL for this time already.
      prevTime_ = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")));
      return;
    }
    // Find where we would insert a new node; start looking at the head.
    prevTime_ = 0;
    while (true) {
      uint nextTime = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, prevTime_, "nextTime")));
      if (nextTime == 0 || proposalRevealTime < nextTime) {
        break;
      }
      prevTime_ = nextTime;
    }
  }

  // Add the vote to the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function addSendersVoteToDLL(IAventusStorage _storage, uint _proposalId, uint _prevTime) private {
    address voter = msg.sender;

    // The proposal's reveal period start time, used for position in the reveal time DLL.
    uint proposalRevealTime = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));

    // The number of proposals, that the voter has voted on, that are revealing at the same time as this one.
    uint numVotes = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")));

    // If no other votes at this time, create new node in the DLL.
    if (numVotes == 0) {
      // Make sure that the prev and next entries are valid first.
      uint nextTime = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, _prevTime, "nextTime")));
      if (_prevTime != 0) {
        require(
          _prevTime < proposalRevealTime && _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, _prevTime, "count"))) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once before the proposal"
        );
      }
      if (nextTime != 0) {
        require(
          proposalRevealTime < nextTime && _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "count"))) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once after the proposal"
        );
      }

      // Create new entry in the DLL betwwen _prevTime and nextTime.
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")), _prevTime);
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "nextTime")), nextTime);
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, _prevTime, "nextTime")), proposalRevealTime);
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "prevTime")), proposalRevealTime);
    }

    _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")), numVotes + 1);
  }

  // Remove the vote from the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function removeSendersVoteFromDLL(IAventusStorage _storage, uint _proposalId) private {
    address voter = msg.sender;
    uint proposalRevealTime = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealingStart")));
    uint numVotes = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")));
    require(numVotes != 0, "Voter must have voted for this proposal"); // Check that the user has actually voted on this proposal.

    // If this was the only vote, remove the entire entry from the DLL.
    if (numVotes == 1) {
      uint prevTime = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")));
      uint nextTime = _storage.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "nextTime")));

      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "nextTime")), nextTime);
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "prevTime")), prevTime);
    } else {
      _storage.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")), numVotes - 1);
    }

    _storage.setBytes32(
      keccak256(abi.encodePacked("Voting", voter, "secrets", _proposalId)),
      0
    );
  }
}
