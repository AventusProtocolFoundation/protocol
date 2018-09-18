pragma solidity ^0.4.24;

interface IProposalsManager {
  // TODO: move proposalId to the first parameter of all logs.
  /**
   * Event emitted for a createGovernanceProposal transaction.
   */
  event LogCreateProposal(address indexed sender, string desc, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd, uint deposit);

  /**
   * Event emitted for a castVote transaction.
   */
  event LogCastVote(address indexed sender, uint indexed proposalId, bytes32 secret, uint prevTime);

  /**
   * Event emitted for a cancelVote transaction.
   */
  event LogCancelVote(address indexed sender, uint indexed proposalId);

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
   * Cancel a vote on one of a given proposal's options
   * NOTE: Vote must be cancelled within the voting period.
   * @param _proposalId Proposal ID
   */
  function cancelVote(uint _proposalId) external;

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
   * Use a (free gas) getter to find the prevTime parameter for castVote.
   * @param _proposalId Proposal ID
   * @return prevTime_ The prevTime param.
   */
  function getPrevTimeParamForCastVote(uint _proposalId) external view returns (uint prevTime_);

  /**
   * Gets the current time.
   */
  function getAventusTime() external view returns (uint time_);
}
