pragma solidity ^0.4.24;

interface IProposalsManager {
  /**
   * Event emitted for a createGovernanceProposal transaction.
   */
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * Event emitted for a castVote transaction.
   */
  event LogCastVote(address indexed sender, uint indexed proposalId, bytes32 secret, uint prevTime);

  /**
   * Event emitted for a revealVote transaction.
   */
  event LogRevealVote(address indexed sender, uint indexed proposalId, uint8 indexed optId, uint revealingStart, uint revealingEnd);

  /**
   * Event emitted for a claimVoterWinnings transaction.
   */
  event LogClaimVoterWinnings(uint indexed proposalId);

  /**
   * Event emitted for a endProposal transaction.
   */
  event LogEndProposal(uint indexed proposalId, uint votesFor, uint votesAgainst, uint revealingEnd);

  /**
   * Event emitted for a createEventChallenge transaction.
   */
  event LogCreateEventChallenge(uint indexed eventId, uint indexed proposalId, string supportingUrl, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * Event emitted for a createAventityChallenge transaction.
   */
  event LogCreateAventityChallenge(uint indexed aventityId, uint indexed proposalId, string supportingUrl, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * @return the deposit value in AVT - with 18 digits precision - for a corporate
   * governance proposal.
   */
  function getGovernanceProposalDeposit() view external returns (uint proposalDeposit_);

  /**
  * Create a governance proposal to be voted on
  * @param _desc Either just a title or a pointer to IPFS details
  * @return uint proposalID_ of newly created proposal
  */
  function createGovernanceProposal(string _desc) external returns (uint proposalId_);

  /**
  * Create a challenge for the specified event to be voted on.
  * @param _eventId - event id for the event in context
  */
  function createEventChallenge(uint _eventId) external returns (uint proposalId_);

  /**
  * Create a challenge for the specified aventity to be voted on.
  * @param _aventityId - aventity id for the aventity in context
  */
  function createAventityChallenge(uint _aventityId) external returns (uint challengeProposalId_);

  /**
   * End the proposal: will unlock the deposit and distribute any winnings.
   *
   * NOTE: Can only be called once vote revealing has finished.
   * @param _proposalId of the proposal to be ended.
   */
  function endProposal(uint _proposalId) external;

  /**
  * Cast a vote on one of a given proposal's options
  * NOTE: Vote must be revealed within the proposal revealing period to count.
  * @param _proposalId Proposal ID
  * @param _secret The secret vote: Sha3(signed Sha3(option ID))
  * @param _prevTime The previous time that locked the user's funds - from getPrevTimeParamForCastVote()
  */
  function castVote(uint _proposalId, bytes32 _secret, uint _prevTime) external;

  /**
  * Reveal a vote on a proposal
  * NOTE: Votes only count if the caller has AVT in their stake fund when they reveal their
  * vote (see IAVTManager.sol)
  * @param _signedMessage a signed message
  * @param _proposalId Proposal ID
  * @param _optId ID of option that was voted on
  */
  function revealVote( bytes _signedMessage, uint _proposalId, uint8 _optId) external;

  /**
   * Claim winnings from a proposal if caller voted on the winning side.
   * Results in the caller's share of any proposal winnings being put into their deposit fund.
   * (see IAVTManager.sol)
   * @param _proposalId Proposal ID
   */
  function claimVoterWinnings(uint _proposalId) external;

  /**
  * Get the pre-calculated deposit for the specified event
  * @param _eventId - event id for the event in context
  * @return eventDeposit_
  */
  function getExistingEventDeposit(uint _eventId) external view returns(uint eventDeposit_);

  /**
   * Use a (free gas) getter to find the prevTime parameter for castVote.
   * @param _proposalId Proposal ID
   * @return prevTime_ The prevTime param.
   */
  function getPrevTimeParamForCastVote(uint _proposalId) external view returns (uint prevTime_);
}
