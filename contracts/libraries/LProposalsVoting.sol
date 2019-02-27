pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAVTManager.sol";
import "./zeppelin/LECRecovery.sol";
import "./LProposalsEnact.sol";
import "./LProposalsStorage.sol";
import "./LAventusDLL.sol";

library LProposalsVoting {

  modifier onlyInVotingPeriodOrAfterRevealingFinished(IAventusStorage _storage, uint _proposalId) {
    bool inVotingPeriodOrAfterRevealing = LProposalsEnact.inVotingPeriodOrAfterRevealingFinished(_storage, _proposalId);
    require(inVotingPeriodOrAfterRevealing, "Proposal must be in the voting period or after revealing finished");
    _;
  }

  modifier onlyInRevealingPeriodOrLater(IAventusStorage _storage, uint _proposalId) {
    require(LProposalsEnact.inRevealingPeriodOrLater(_storage, _proposalId), "Must be in revealing phase or later");
    _;
  }

  modifier onlyUnrevealedVote(IAventusStorage _storage, uint _proposalId) {
    bytes32 secret = LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId);
    require(secret != 0, "Sender must have a non revealed vote");
    _;
  }

  modifier onlyWhenVoterIsSender(uint _proposalId, uint _optId, bytes memory _signedMessage) {
    require(checkVoterIsSender(_proposalId, _optId, _signedMessage), "Voter must be the sender");
    _;
  }

  modifier onlyValidOptionId(uint _optId) {
    require (_optId == 1 || _optId == 2, "Invalid option");
    _;
  }

  function castVote(IAventusStorage _storage, uint _proposalId, bytes32 _secret, uint _prevTime)
    external
  {
    require(LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId) == 0, "Already voted");
    LProposalsStorage.setVoterSecret(_storage, msg.sender, _proposalId, _secret);

    uint unrevealedVotesCount = LProposalsStorage.getUnrevealedVotesCount(_storage, _proposalId);
    LProposalsStorage.setUnrevealedVotesCount(_storage, _proposalId, unrevealedVotesCount + 1);
    addSendersVoteToDLL(_storage, _proposalId, _prevTime);
  }

  function cancelVote(IAventusStorage _storage, uint _proposalId)
    external
    onlyInVotingPeriodOrAfterRevealingFinished(_storage, _proposalId)
    onlyUnrevealedVote(_storage, _proposalId)
  {
    doRemoveVote(_storage, _proposalId);
  }

  function getPrevTimeParamForCastVote(IAventusStorage _storage, uint _proposalId)
    external
    view
    returns (uint prevTime_)
  {
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    require(proposalRevealTime != 0, "Proposal does not exist");
    prevTime_ = LAventusDLL.getPreviousValue(_storage, msg.sender, proposalRevealTime);
  }

  function revealVote(IAventusStorage _storage, bytes memory _signedMessage, uint _proposalId, uint _optId)
    public
    onlyInRevealingPeriodOrLater(_storage, _proposalId)
    onlyValidOptionId(_optId)
    onlyWhenVoterIsSender(_proposalId, _optId, _signedMessage)
  {
    bool storedVoteMatches = LProposalsStorage.getVoterSecret(_storage, msg.sender, _proposalId) ==
        keccak256(abi.encodePacked(_signedMessage));
    require(storedVoteMatches, "Stored vote must be the same as the revealed one");

    // IFF we are still in the reveal period then add any stake
    if (LProposalsEnact.inRevealingPeriod(_storage, _proposalId)) {
      addVoterStakeToProposal(_storage, _proposalId, _optId, msg.sender);
    }

    doRemoveVote(_storage, _proposalId);
  }

  // Add the vote to the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function addSendersVoteToDLL(IAventusStorage _storage, uint _proposalId, uint _prevTime)
    private
  {
    // The proposal's reveal period start time, used for position in the reveal time DLL.
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    // update the existing count for this time or insert if no votes exist yet.
    LAventusDLL.incrementCount(_storage, msg.sender, proposalRevealTime, _prevTime);
  }

  // Remove the vote from the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function removeSendersVoteFromDLL(IAventusStorage _storage, uint _proposalId)
    private
  {
    uint proposalRevealTime = LProposalsStorage.getRevealingStart(_storage, _proposalId);
    LAventusDLL.decrementCount(_storage, msg.sender, proposalRevealTime);
  }

  function doRemoveVote(IAventusStorage _storage, uint _proposalId)
    private
  {
    uint unrevealedVotesCount = LProposalsStorage.getUnrevealedVotesCount(_storage, _proposalId);
    LProposalsStorage.setUnrevealedVotesCount(_storage, _proposalId, unrevealedVotesCount - 1);
    removeSendersVoteFromDLL(_storage, _proposalId);
    LProposalsStorage.setVoterSecret(_storage, msg.sender, _proposalId, 0);
  }

  function checkVoterIsSender(uint _proposalId, uint _optId, bytes memory _signedMessage)
    private
    view
    returns (bool voterIsSender_)
  {
    // Get voter public key from message and signature
    bytes32 msgHash = keccak256(abi.encodePacked((_proposalId * 10) + _optId));
    address voter = LECRecovery.recover(msgHash, _signedMessage);
    voterIsSender_ = voter == msg.sender;
  }

  function addVoterStakeToProposal(IAventusStorage _storage, uint _proposalId, uint _optId, address _voter)
    private
  {
    uint stake = LAVTManager.getBalance(_storage, _voter);

    if (stake == 0) return;

    LProposalsStorage.increaseTotalRevealedStake(_storage, _proposalId, _optId, stake);
    LProposalsStorage.incrementNumVotersRevealedWithStake(_storage, _proposalId, _optId);
    LProposalsStorage.setRevealedVoterStake(_storage, _proposalId, _voter, _optId, stake);
  }
}