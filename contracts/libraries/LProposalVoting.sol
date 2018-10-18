pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./zeppelin/LECRecovery.sol";
import "./LProposalsEnact.sol";
import "./LProposalsStorage.sol";

library LProposalVoting {

  modifier onlyInVotingPeriodOrAfterRevealingFinished(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.inVotingPeriodOrAfterRevealingFinished(_storage, _proposalId),
      "Proposal must be in the voting period or after revealing finished"
    );
    _;
  }

  modifier onlyInRevealingPeriodOrLater(IAventusStorage _storage, uint _proposalId) {
    require(
      LProposalsEnact.inRevealingPeriodOrLater(_storage, _proposalId),
      "A vote can only be revealed in the revealing phase or later"
    );
    _;
  }

  modifier onlyUnrevealedVote(IAventusStorage _storage, uint _proposalId) {
    bytes32 secret = LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId);
    require(secret != 0, "Sender must have a non revealed vote");
    _;
  }

  modifier onlyWhenVoterIsSender(uint _proposalId, uint _optId, bytes _signedMessage) {
    require (checkVoterIsSender(_proposalId, _optId, _signedMessage), "Voter must be the sender");
    _;
  }

  function castVote(
    IAventusStorage _storage,
    uint _proposalId,
    bytes32 _secret,
    uint _prevTime
  )
    external
    // no modifier checked, because it should have been checked at the top-level
  {
    require(
      LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId) == 0,
      "Must cancel existing vote for this proposal"
    );
    LProposalsStorage.setVoterSecret(_storage, msg.sender, _proposalId, _secret);

    uint unrevealedVotesCount = LProposalsStorage.getUnrevealedVotesCount(_storage, _proposalId);
    LProposalsStorage.setUnrevealedVotesCount(_storage, _proposalId, unrevealedVotesCount + 1);
    addSendersVoteToDLL(_storage, _proposalId, _prevTime);
  }

  function cancelVote(IAventusStorage _storage, uint _proposalId) external
    onlyInVotingPeriodOrAfterRevealingFinished(_storage, _proposalId)
    onlyUnrevealedVote(_storage, _proposalId)
  {
    doRemoveVote(_storage, _proposalId);
  }

  function revealVote(IAventusStorage _storage, bytes _signedMessage, uint _proposalId, uint _optId)
    public
    onlyInRevealingPeriodOrLater(_storage, _proposalId)
    onlyWhenVoterIsSender(_proposalId, _optId, _signedMessage)
  {
    // Make sure the stored vote is the same as the revealed one.
    require(
      LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId) ==
        keccak256(abi.encodePacked(_signedMessage)),
        "Stored vote must be the same as the revealed one"
    );

    // IFF we are still in the reveal period then add any stake
    if (LProposalsEnact.inRevealingPeriod(_storage, _proposalId)) {
      addVoterStakeToProposal(_storage, _proposalId, _optId, msg.sender);
    }

    doRemoveVote(_storage, _proposalId);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId) external view returns (uint prevTime_) {
    address voter = msg.sender;
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    require(
      proposalRevealTime != 0,
      "Proposal must have a reveal starting time"
    ); // Invalid proposal.
    if (LProposalsStorage.getVoteCountForRevealTime(_storage, voter, proposalRevealTime) != 0) {
      // We have an entry in the DLL for this time already.
      prevTime_ = LProposalsStorage.getPreviousRevealTime(_storage, voter, proposalRevealTime);
      return;
    }
    // Find where we would insert a new node; start looking at the head.
    prevTime_ = 0;
    while (true) {
      uint nextTime = LProposalsStorage.getNextRevealTime(_storage, voter, prevTime_);
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
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);

    // The number of proposals, that the voter has voted on, that are revealing at the same time as this one.
    uint numVotes = LProposalsStorage.getVoteCountForRevealTime(_storage, voter, proposalRevealTime);

    // If no other votes at this time, create new node in the DLL.
    if (numVotes == 0) {
      // Make sure that the prev and next entries are valid first.
      uint nextTime = LProposalsStorage.getNextRevealTime(_storage, voter, _prevTime);
      if (_prevTime != 0) {
        require(
          _prevTime < proposalRevealTime &&
              LProposalsStorage.getVoteCountForRevealTime(_storage, voter, _prevTime) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once before the proposal"
        );
      }
      if (nextTime != 0) {
        require(
          proposalRevealTime < nextTime &&
              LProposalsStorage.getVoteCountForRevealTime(_storage, voter, nextTime) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once after the proposal"
        );
      }

      // Create new entry in the DLL betwwen _prevTime and nextTime.
      LProposalsStorage.setPreviousRevealTime(_storage, voter, proposalRevealTime, _prevTime);
      LProposalsStorage.setNextRevealTime(_storage, voter, proposalRevealTime, nextTime);
      LProposalsStorage.setNextRevealTime(_storage, voter, _prevTime, proposalRevealTime);
      LProposalsStorage.setPreviousRevealTime(_storage, voter, nextTime, proposalRevealTime);
    }

    LProposalsStorage.setVoteCountForRevealTime(_storage, voter, proposalRevealTime, numVotes + 1);
  }

  // Remove the vote from the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function removeSendersVoteFromDLL(IAventusStorage _storage, uint _proposalId) private {
    address voter = msg.sender;
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    uint numVotes = LProposalsStorage.getVoteCountForRevealTime(_storage, voter, proposalRevealTime);
    require(numVotes != 0, "Voter must have voted for this proposal");

    // If this was the only vote, remove the entire entry from the DLL.
    if (numVotes == 1) {
      uint prevTime = LProposalsStorage.getPreviousRevealTime(_storage, voter, proposalRevealTime);
      uint nextTime = LProposalsStorage.getNextRevealTime(_storage, voter, proposalRevealTime);

      LProposalsStorage.setNextRevealTime(_storage, voter, prevTime, nextTime);
      LProposalsStorage.setPreviousRevealTime(_storage, voter, nextTime, prevTime);
    } else {
      LProposalsStorage.setVoteCountForRevealTime(_storage, voter, proposalRevealTime, numVotes - 1);
    }
  }

  function doRemoveVote(IAventusStorage _storage, uint _proposalId) private {
    uint unrevealedVotesCount = LProposalsStorage.getUnrevealedVotesCount(_storage, _proposalId);
    LProposalsStorage.setUnrevealedVotesCount(_storage, _proposalId, unrevealedVotesCount - 1);
    removeSendersVoteFromDLL(_storage, _proposalId);
    LProposalsStorage.setVoterSecret(_storage, msg.sender, _proposalId, 0);
  }

  function checkVoterIsSender(uint _proposalId, uint _optId, bytes _signedMessage) private view returns (bool)
  {
    // Get voter public key from message and signature
    bytes32 msgHash = keccak256(abi.encodePacked((_proposalId * 10) + _optId));
    address voter = LECRecovery.recover(msgHash, _signedMessage);
    return voter == msg.sender;
  }

  function addVoterStakeToProposal(IAventusStorage _storage, uint _proposalId, uint _optId, address _voter)
    private
  {
    uint stake = LAVTManager.getBalance(_storage, _voter, "stake");

    if (stake == 0) return;
    // increment the total stake for this option with the voter's stake...
    uint totalStakeForOption = LProposalsStorage.getTotalRevealedStake(_storage, _proposalId, _optId);
    LProposalsStorage.setTotalRevealedStake(_storage, _proposalId, _optId, totalStakeForOption + stake);
    // ...and store it so we can use it later to calculate winnings.
    uint revealedVotersCount = LProposalsStorage.getRevealedVotersCount(_storage, _proposalId, _optId);
    LProposalsStorage.setRevealedVotersCount(_storage, _proposalId, _optId, revealedVotersCount + 1);
    LProposalsStorage.setRevealedVoterStake(_storage, _proposalId, _voter, _optId, stake);
  }
}