pragma solidity ^0.5.2;

interface IMembersManager {

  /**
   * @notice Event emitted for a registerMember transaction.
   */
  event LogMemberRegistered(address indexed memberAddress, string memberType, string evidenceUrl, string desc, uint deposit);

  /**
   * @notice Event emitted for a deregisterMember transaction.
   */
  event LogMemberDeregistered(address indexed memberAddress, string memberType);

  /**
   * @notice Event emitted for a challengeMember transaction.
   */
  event LogMemberChallenged(address indexed memberAddress, string memberType, uint indexed proposalId, uint lobbyingStart,
      uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * Event emitted for a endMemberChallenge transaction.
   */
  event LogMemberChallengeEnded(address indexed memberAddress, string memberType, uint indexed proposalId, uint votesFor,
      uint votesAgainst);

  /**
   * @notice Register the given address and member type on the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getMemberDeposit().
   */
  function registerMember(address _memberAddress, string calldata _memberType, string calldata _evidenceUrl,
      string calldata _desc) external;

  /**
   * @notice Stop the given member from using the Aventus Protocol. This will unlock
   * the deposit that was locked when the member was registered.
   */
  function deregisterMember(address _memberAddress, string calldata _memberType) external;

  /**
   * @notice Get the deposit value in AVT - to 18 sig fig - required to register a member.
   * See registerMember().
   */
  function getNewMemberDeposit(string calldata _memberType) external view returns (uint memberDepositInAVT_);

  /**
   * @notice Create a challenge for the specified member.
   * @param _memberAddress address of member to be challenged
   * @param _memberType type of member to be challenged
   */
  function challengeMember(address _memberAddress, string calldata _memberType) external;

  /**
   * @notice Ends a challenge on the specified member.
   * @param _memberAddress address of member to be cleared of challenge
   * @param _memberType type of member to be cleared of challenge
   */
  function endMemberChallenge(address _memberAddress, string calldata _memberType) external;

  /**
   * @notice Gets the deposit paid for the specified member.
   */
  function getExistingMemberDeposit(address _memberAddress, string calldata _memberType) external view
      returns (uint memberDepositInAVT_);

  /**
   * @return true if the given member is allowed to use the Aventus Protocol.
   * ie registered AND not fraudulent.
   */
  function memberIsActive(address _memberAddress, string calldata _memberType) external view returns (bool isActive_);
}