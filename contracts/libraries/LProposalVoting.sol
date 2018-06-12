pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";

library LProposalVoting {

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
    // no modifier checked, because it should have been checked at the top-level
  {
    bytes32 secretKey = keccak256(abi.encodePacked("Voting", msg.sender, "secrets", proposalId));
    // TODO: Consider allowing users to change their vote before reveal period.
    require(
      s.getBytes32(secretKey) == 0,
      "Sender can vote only once for this proposal"
    );
    s.setBytes32(secretKey, secret);

    addSendersVoteToDLL(s, proposalId, prevTime);
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
  function revealVote(IAventusStorage _storage, uint _proposalId, uint8 _optId, uint8 _ecdsaV, bytes32 _ecdsaR, bytes32 _ecdsaS, uint _proposalStatus) public {
    require (
      _proposalStatus >= 3,
      "A vote can only be revealed in the revealing phase or later"
    );
    require (
      _optId == 1 || _optId == 2,
      "Vote must be only 1 or 2"
    );

    // Get voter public key from message and ECDSA components
    address voter = ecrecover(getPrefixedMessage(keccak256(abi.encodePacked((_proposalId * 10) + _optId))), _ecdsaV, _ecdsaR, _ecdsaS);
    require(
      voter == msg.sender,
      "Reveal vote must be called only by the voter"
    );

    // Make sure the stored vote is the same as the revealed one.
    require(
      _storage.getBytes32(keccak256(abi.encodePacked("Voting", voter, "secrets", _proposalId))) ==
        keccak256(abi.encodePacked(uint(_ecdsaV), _ecdsaR, _ecdsaS)),
        "Stored vote must be the same as the revealed one"
    );

    // IFF we are still in the reveal period AND the user has non-zero stake at reveal time...
    uint stake = _storage.getUInt(keccak256(abi.encodePacked("Lock", "stake", voter)));
    if (_proposalStatus == 3 && stake != 0) {
      // ...increment the total stake for this option with the voter's stake...
      bytes32 totalStakeForOptionKey = keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", _optId));
      _storage.setUInt(totalStakeForOptionKey, _storage.getUInt(totalStakeForOptionKey) + stake);

      // ...and store it so we can use it later to calculate winnings.
      bytes32 revealedVotersCountKey = keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVotersCount", _optId));
      uint revealedVotersCount = _storage.getUInt(revealedVotersCountKey) + 1;
      _storage.setUInt(revealedVotersCountKey, revealedVotersCount);
      _storage.setAddress(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVoter", _optId, revealedVotersCount)), voter);
      _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedVoter", _optId, voter, "stake")), stake);
    }

    // Removing the vote will unlock the user's AVT stake for this proposal.
    removeSendersVoteFromDLL(_storage, _proposalId);
  }

  /**
   * @dev Get the prevTime parameter that is needed to pass in to castVote, ie
   * the previous entry in the sender's voting DLL.
   * @param s Storage contract
   * @param proposalId Proposal ID
   */
  function getPrevTimeParamForCastVote(IAventusStorage s, uint proposalId) public view returns (uint prevTime) {
    address voter = msg.sender;
    uint proposalRevealTime = s.getUInt(keccak256(abi.encodePacked("Proposal", proposalId, "revealingStart")));
    require(
      proposalRevealTime != 0,
      "Proposal must have a reveal starting time"
    ); // Invalid proposal.
    if (s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count"))) != 0) {
      // We have an entry in the DLL for this time already.
      return s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")));
    }
    // Find where we would insert a new node; start looking at the head.
    prevTime = 0;
    while (true) {
      uint nextTime = s.getUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "nextTime")));
      if (nextTime == 0 || proposalRevealTime < nextTime) {
        break;
      }
      prevTime = nextTime;
    }
  }

  // Add the vote to the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function addSendersVoteToDLL(IAventusStorage s, uint proposalId, uint prevTime) private {
    address voter = msg.sender;

    // The proposal's reveal period start time, used for position in the reveal time DLL.
    uint proposalRevealTime = s.getUInt(keccak256(abi.encodePacked("Proposal", proposalId, "revealingStart")));

    // The number of proposals, that the voter has voted on, that are revealing at the same time as this one.
    uint numVotes = s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")));

    // If no other votes at this time, create new node in the DLL.
    if (numVotes == 0) {
      // Make sure that the prev and next entries are valid first.
      uint nextTime = s.getUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "nextTime")));
      if (prevTime != 0) {
        require(
          prevTime < proposalRevealTime && s.getUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "count"))) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once before the proposal"
        );
      }
      if (nextTime != 0) {
        require(
          proposalRevealTime < nextTime && s.getUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "count"))) != 0,
          "In addSendersVoteToDLL, the voter must have voted at least once after the proposal"
        );
      }

      // Create new entry in the DLL betwwen prevTime and nextTime.
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")), prevTime);
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "nextTime")), nextTime);
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "nextTime")), proposalRevealTime);
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "prevTime")), proposalRevealTime);
    }

    s.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")), numVotes + 1);
  }

  // Remove the vote from the doubly linked list of vote counts that this user is
  // currently voting in. The list is sorted in proposal revealTime order.
  function removeSendersVoteFromDLL(IAventusStorage s, uint proposalId) private {
    address voter = msg.sender;
    uint proposalRevealTime = s.getUInt(keccak256(abi.encodePacked("Proposal", proposalId, "revealingStart")));
    uint numVotes = s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")));
    require(numVotes != 0, "Voter must have voted for this proposal"); // Check that the user has actually voted on this proposal.

    // If this was the only vote, remove the entire entry from the DLL.
    if (numVotes == 1) {
      uint prevTime = s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "prevTime")));
      uint nextTime = s.getUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "nextTime")));

      s.setUInt(keccak256(abi.encodePacked("Voting", voter, prevTime, "nextTime")), nextTime);
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, nextTime, "prevTime")), prevTime);
    } else {
      s.setUInt(keccak256(abi.encodePacked("Voting", voter, proposalRevealTime, "count")), numVotes - 1);
    }

    s.deleteBytes32(keccak256(abi.encodePacked("Voting", voter, "secrets", proposalId)));
  }

  // web3.eth.sign prefixes messages with this string; we need to take it into consideration.
  // TODO: Share this with LEvents code, and anywhere else signing is used.
  function getPrefixedMessage(bytes32 _input)
    private
    pure
    returns (bytes32 _prefixedMsg)
  {
    _prefixedMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _input));
  }
}
