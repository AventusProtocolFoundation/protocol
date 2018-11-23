pragma solidity ^0.4.24;

interface IProposalsManager {
  /**
   * @notice Event emitted for a createGovernanceProposal transaction.
   */
  event LogGovernanceProposalCreated(uint indexed proposalId, address indexed sender, string desc, uint lobbyingStart,
      uint votingStart, uint revealingStart, uint revealingEnd, uint deposit);

  /**
   * @notice Event emitted for a castVote transaction.
   */
  event LogVoteCast(uint indexed proposalId, address indexed sender, bytes32 secret, uint prevTime);

  /**
   * @notice Event emitted for a cancelVote transaction.
   */
  event LogVoteCancelled(uint indexed proposalId, address indexed sender);

  /**
   * @notice Event emitted for a revealVote transaction.
   */
  event LogVoteRevealed(uint indexed proposalId, address indexed sender, uint indexed optId, uint revealingStart,
      uint revealingEnd);

  /**
   * @notice Event emitted for a claimVoterWinnings transaction.
   */
  event LogVoterWinningsClaimed(uint indexed proposalId);

  /**
   * @notice Event emitted for an endGovernanceProposal transaction.
   */
  event LogGovernanceProposalEnded(uint indexed proposalId, uint votesFor, uint votesAgainst);

  /**
   * @return the deposit value in AVT - with 18 digits precision - for a corporate
   * governance proposal.
   */
  function getGovernanceProposalDeposit() external view returns (uint proposalDeposit_);

  /**
   * @notice Create a governance proposal to be voted on
   * @param _desc Either just a title or a pointer to IPFS details
   */
  function createGovernanceProposal(string _desc) external;

  /**
   * @notice End the governance proposal: will unlock the deposit.
   * NOTE: Can only be called once vote revealing has finished.
   * @param _proposalId of the proposal to be ended.
   */
  function endGovernanceProposal(uint _proposalId) external;

  /**
   * @notice Cast a vote on one of a given proposal's options
   * NOTE: Vote must be revealed within the proposal revealing period to count.
   * @param _proposalId Proposal ID
   * @param _secret The secret vote: Sha3(signed Sha3(option ID))
   * @param _prevTime The previous time that locked the user's funds - from getPrevTimeParamForCastVote()
   * @dev _prevTime corresponds to the previous entry in the sender's voting DLL.
   */
  function castVote(uint _proposalId, bytes32 _secret, uint _prevTime) external;

  /**
   * @notice Cancel a vote on one of a given proposal's options
   * NOTE: Vote must be cancelled within the voting period.
   * @param _proposalId Proposal ID
   */
  function cancelVote(uint _proposalId) external;

  /**
   * @notice Reveal a vote on a proposal
   * NOTE: Votes only count if the caller has AVT in their stake fund when they reveal their
   * vote (see IAVTManager.sol)
   * @param _signedMessage a signed message
   * @param _proposalId Proposal ID
   * @param _optId ID of option that was voted on
   */
  function revealVote( bytes _signedMessage, uint _proposalId, uint _optId) external;

  /**
   * @notice Claim winnings from a proposal if caller voted on the winning side.
   * Results in the caller's share of any proposal winnings being put into their deposit fund.
   * (see IAVTManager.sol)
   * @param _proposalId Proposal ID
   */
  function claimVoterWinnings(uint _proposalId) external;

  /**
   * @notice Use a (free gas) getter to find the prevTime parameter for castVote.
   * @param _proposalId Proposal ID
   * @return prevTime_ The prevTime param.
   * @dev The return value is the previous entry in the sender's voting DLL.
   */
  function getPrevTimeParamForCastVote(uint _proposalId) external view returns (uint prevTime_);

  /**
   * @notice Gets the current time.
   */
  function getAventusTime() external view returns (uint time_);
}
