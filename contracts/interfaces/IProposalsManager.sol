pragma solidity ^0.4.19;

interface IProposalsManager {
  /**
   * @return the deposit value in AVT - with 18 digits precision - for a corporate
   * governance proposal.
   */
  function getGovernanceProposalDeposit() view external returns (uint proposalDeposit);

  /**
  * Create a governance proposal to be voted on
  * @param desc Either just a title or a pointer to IPFS details
  * @return uint proposalID of newly created proposal
  */
  function createGovernanceProposal(string desc) external returns (uint proposalId);

  /**
  * Get the pre-calculated deposit for the specified event
  * @param _eventId - event id for the event in context
  */
  function getExistingEventDeposit(uint _eventId) external view returns(uint);

  /**
  * Create a challenge for the specified event to be voted on.
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(uint _eventId) external returns (uint _proposalId);

  /**
   * End the proposal: will unlock the deposit and distribute any winnings.
   *
   * NOTE: Can only be called once vote revealing has finished.
   * @param _proposalId of the proposal to be ended.
   */
   function endProposal(uint _proposalId) external;

  /**
   * Use a (free gas) getter to find the prevTime parameter for castVote.
   * @param proposalId Proposal ID
   * @return prevTime The prevTime param.
   */
  function getPrevTimeParamForCastVote(uint proposalId) external view returns (uint prevTime);

  /**
  * Cast a vote on one of a given proposal's options
  * NOTE: Vote must be revealed within the proposal revealing period to count.
  * @param proposalId Proposal ID
  * @param secret The secret vote: Sha3(signed Sha3(option ID))
  * @param prevTime The previous time that locked the user's funds - from getPrevTimeParamForCastVote()
  */
  function castVote(uint proposalId, bytes32 secret, uint prevTime) external;

  /**
  * Reveal a vote on a proposal
  * NOTE: Votes only count if the caller has AVT locked in their stake fund when they reveal their
  * vote (see IAVTManager.sol)
  * @param proposalId Proposal ID
  * @param optId ID of option that was voted on
  * @param v User's ECDSA signature(keccak(optID)) v value
  * @param r User's ECDSA signature(keccak(optID)) r value
  * @param s_ User's ECDSA signature(keccak(optID)) s value
  */
  function revealVote(uint proposalId, uint8 optId, uint8 v, bytes32 r, bytes32 s_) external;

  /**
   * Claim winnings from a proposal if caller voted on the winning side.
   * Results in the caller's share of any proposal winnings being put into their deposit fund.
   * (see IAVTManager.sol)
   * @param _proposalId Proposal ID
   */
  function claimVoterWinnings(uint _proposalId) external;
}
