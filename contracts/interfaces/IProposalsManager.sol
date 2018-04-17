pragma solidity ^0.4.19;

interface IProposalsManager {
  /**
   * @return the deposit value in AVT - with 18 digits precision - for a corporate
   * governance proposal.
   */
  function getGovernanceProposalDeposit() view external returns (uint proposalDeposit);

  /**
  * @dev Create a governance proposal to be voted on
  * @param desc Either just a title or a pointer to IPFS details
  * @return uint proposalID of newly created proposal
  */
  function createGovernanceProposal(string desc) external returns (uint proposalId);

  /**
  * @dev Get the pre-calculated deposit for the specified event
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(uint _eventId) external view returns(uint);

  /**
  * @dev Create a challenge for the specified event to be voted on.
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(uint _eventId) external returns (uint _proposalId);

  /**
  * @dev Finish setting up proposal with time intervals & start
  * @param proposalId Proposal ID
  * @param lobbyPeriodStart timestamp of the start of the lobbying period, after which voting on proposal starts
  * @param interval The amount of time the vote and reveal periods last for in seconds
  * TODO: Consider removing finalise from the interface; use fixed lobbyPeriodStart and interval.
  */
  function finaliseProposal(uint proposalId, uint lobbyPeriodStart, uint interval) external;

  /**
   * End the proposal: will unlock the deposit and distribute any winnings.
   *
   * NOTE: Can only be called once vote revealing has finished.
   * @param _proposalId of the proposal to be ended.
   */
   function endProposal(uint _proposalId) external;

  /**
   * @dev Use a (free gas) getter to find the prevTime parameter for castVote.
   * @param proposalId Proposal ID
   * @return prevTime The prevTime param.
   */
  function getPrevTimeParamForCastVote(uint proposalId) external view returns (uint prevTime);

  /**
  * @dev Cast a vote on one of a given proposal's options
  * @param proposalId Proposal ID
  * @param secret The secret vote: Sha3(signed Sha3(option ID))
  * @param prevTime The previous time that locked the user's funds - from getPrevTimeParamForCastVote()
  */
  function castVote(uint proposalId, bytes32 secret, uint prevTime) external;

  /**
  * @dev Reveal a vote on a proposal
  * @param proposalId Proposal ID
  * @param optId ID of option that was voted on
  * @param v User's ECDSA signature(keccak(optID)) v value
  * @param r User's ECDSA signature(keccak(optID)) r value
  * @param s_ User's ECDSA signature(keccak(optID)) s value
  */
  function revealVote(uint proposalId, uint optId, uint8 v, bytes32 r, bytes32 s_) external;
}
