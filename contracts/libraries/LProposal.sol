pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";

// Library for extending voting protocol functionality
library LProposal {
  // Verify a proposal's status (1 finalised, 2 voting, 3 reveal, 4 end)
  modifier isStatus(IAventusStorage s, uint proposalId, uint status) {
    require (status == getProposalStatus(s, proposalId));
    _;
  }

  /**
  * @dev Create a proposal to be voted on
  * @param s Storage contract
  * @param creator Address creating the proposal
  * @param desc Either just a title or a pointer to IPFS details
  * @return uint proposalId of newly created proposal
  */
  function createProposal(IAventusStorage s, address creator, string desc)
    public
    returns (uint)
  {
    uint proposalCount = s.getUInt(keccak256("ProposalCount"));
    uint proposalId = proposalCount + 1;

    s.setString(keccak256("Proposal", proposalId, "description"), desc);
    s.setUInt(keccak256("ProposalCount"), proposalId);
    s.setAddress(keccak256("Proposal", proposalId, "creator"), creator);

    return proposalId;
  }

  /**
  * @dev Add an option to a proposal that voters can choose
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @param option Description of option
  */
  function addProposalOption(IAventusStorage s, uint proposalId, string option)
    public
    isStatus(s, proposalId, 0)
  {
    uint count = s.getUInt(keccak256("Proposal", proposalId, "OptionsCount"));

    // Cannot add more than 5 options
    require (count < 5);

    // Store new options count, and the option + description
    s.setString(keccak256("Proposal", proposalId, "option", count + 1), option);
    s.setUInt(keccak256("Proposal", proposalId, "OptionsCount"), count + 1);
  }

  /**
  * @dev Finish setting up proposal with time intervals & start
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @param start The start date of the cooldown period, after which voting on proposal starts
  * @param interval The amount of time the vote and reveal periods last for
  */
  function finaliseProposal(IAventusStorage s, uint proposalId, uint start, uint interval)
    public
    isStatus(s, proposalId, 0)
  {
    // Make sure start is afer now and that interval is at least a week
    require (start >= now && interval >= 7 days);

    uint optionCount = s.getUInt(keccak256("Proposal", proposalId, "OptionsCount"));

    // Make sure there are more than 2 options to vote on
    require (optionCount >= 2);

    // Cooldown period start, which is always twice the voting interval length
    uint votingStart = start + 2 * interval;
    uint revealingStart = votingStart + interval;
    uint end = revealingStart + interval;

    s.setUInt(keccak256("Proposal", proposalId, "votingStart"), votingStart);
    s.setUInt(keccak256("Proposal", proposalId, "revealingStart"), revealingStart);
    s.setUInt(keccak256("Proposal", proposalId, "end"), end);
  }

  /**
  * @dev Cast a vote on one of a given proposal's options
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @param voter Address of the voter
  * @param secret The secret vote: Sha3(signed Sha3(option ID))
  * @param prevTime The previous revealStart time that locked the user's funds
  */
  function castVote(
    IAventusStorage s,
    uint proposalId,
    address voter,
    bytes32 secret,  // Sign the option id and hash the signature
    uint prevTime // The previous revealStart in the doubly linked list
  )
    public
    isStatus(s, proposalId, 2) // Ensure voting period is currently active
  {
    // The current proposal's start of the reveal time
    uint time = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));
    // The next revealStart referenced by the user's previous revealStart time
    uint nextTime = s.getUInt(keccak256("Voting", voter, prevTime, "nextTime"));
    // the secret stored for the vote with id
    bytes32 currSecret = s.getBytes32(keccak256("Voting", voter, "secrets", proposalId));
    // the number of votes currently relvealing at time
    uint currVotes = s.getUInt(keccak256("Voting", voter, "count", time));

    // Ensure prevTime passed in is correct and that user hasn't yet voted
    require (time > prevTime && (nextTime == 0 || time <= nextTime) && currSecret == 0);

    // If no items insterted at time, create new node in list
    if (currVotes == 0) {
      // Create new entry
      s.setUInt(keccak256("Voting", voter, time, "prevTime"), prevTime);
      s.setUInt(keccak256("Voting", voter, time, "nextTime"), nextTime);
      s.setUInt(keccak256("Voting", voter, prevTime, "nextTime"), time);
      s.setUInt(keccak256("Voting", voter, nextTime, "prevTime"), time);
    }

    // Save the secret vote for the user and proposal
    s.setBytes32(keccak256("Voting", voter, "secrets", proposalId), secret);
    s.setUInt(keccak256("Voting", voter, "count", time), currVotes + 1);
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
  function revealVote(IAventusStorage s, uint proposalId, uint optId, uint8 v, bytes32 r, bytes32 s_)  public {
    // Make sure proposal status is Reveal or end
    uint proposalStatus = getProposalStatus(s, proposalId);

    require (proposalStatus >= 3 && 99 != proposalStatus);

    // Web3.js sign(msg) prefixes msg with the below
    bytes32 prefixedMsg = keccak256("\x19Ethereum Signed Message:\n32", keccak256(optId));

    // Get voter public key from message and ECDSA components
    address voter = ecrecover(prefixedMsg, v, r, s_);
    // Get proposal revealStart
    uint time = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));
    // Get the voter's secret vote for the given proposal
    bytes32 secret = s.getBytes32(keccak256("Voting", voter, "secrets", proposalId));
    // Make sure the original vote is the same as the reveal
    require (secret == keccak256(uint(v), r, s_));

    // Unlock the user's AVT stake for this proposal
    updateList(s, voter, time, proposalId);

    // Key to current voteCount for the optId for the given proposal
    bytes32 key = keccak256("Proposal", proposalId, "option", optId);

    // Increment the vote count of the option by the AVT stake of voter
    // if we are still in the reveal period
    if (proposalStatus == 3)
        s.setUInt(key, s.getUInt(key) + s.getUInt(keccak256("Lock", voter)));
  }

  /**
  * @dev Update the doubly linked list after reveal
  * @param s Storage contract
  * @param voter the Voter whose list to update
  * @param time revealStart time of proposal
  * @param proposalId Proposal ID
  */
  function updateList(IAventusStorage s, address voter, uint time, uint proposalId) private {
    uint currVotes = s.getUInt(keccak256("Voting", voter, "count", time));

    // remove time entry if proposal ID was the only one with that revealStart
    if (currVotes == 1) {
      uint prevTime = s.getUInt(keccak256("Voting", voter, time, "prevTime"));
      uint nextTime = s.getUInt(keccak256("Voting", voter, time, "nextTime"));

      s.setUInt(keccak256("Voting", voter, prevTime, "nextTime"), nextTime);
      s.setUInt(keccak256("Voting", voter, nextTime, "nextTime"), prevTime);
    }

    s.deleteBytes32(keccak256("Voting", voter, "secrets", proposalId));
    s.setUInt(keccak256("Voting", voter, "count", time), currVotes - 1);
  }

  /**
  * @dev Gets a given proposal's current status
  * @param s Storage contract
  * @param proposalId Proposal ID
  * @return Status number: 1 finalised, 2 voting, 3 reveal, 4 end
  */
  function getProposalStatus(IAventusStorage s, uint proposalId)
    private
    constant
    returns (uint8)
  {
    uint votingStart = s.getUInt(keccak256("Proposal", proposalId, "votingStart"));
    uint revealingStart = s.getUInt(keccak256("Proposal", proposalId, "revealingStart"));
    uint end = s.getUInt(keccak256("Proposal", proposalId, "end"));

    if (votingStart == 0)
      return 0;
    else if (now < votingStart)
      return 1; // Finalised
    else if (now >= votingStart && now < revealingStart)
      return 2; // Voting Active
    else if (now >= revealingStart && now < end)
      return 3; // Revealing Active
    else if (now >= end)
      return 4; // End
  }
}
