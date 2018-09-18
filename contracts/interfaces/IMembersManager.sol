pragma solidity ^0.4.24;

interface IMembersManager {

  /**
   * Event emitted for a registerMember transaction.
   */
  event LogMemberRegistered(address indexed memberAddress, string memberType, string evidenceUrl, string desc, uint deposit);

  /**
   * Event emitted for a deregisterMember transaction.
   */
  event LogMemberDeregistered(address indexed memberAddress, string memberType);

  /**
   * Event emitted for a challengeMember transaction.
   */
  event LogMemberChallenged(address indexed memberAddress, string memberType, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * Register the given address and role as a member of the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getMemberDeposit().
   */
  function registerMember(address _memberAddress, string _memberType, string _evidenceUrl, string _desc) external;

  /**
   * Stop the given member from using the Aventus Protocol. This will unlock
   * the deposit that was locked when the member was registered.
   */
  function deregisterMember(address _memberAddress, string _memberType) external;

  /**
   * @return true if the given member is allowed to use the Aventus Protocol.
   * ie registered AND not fraudulent.
   */
  function memberIsActive(address _memberAddress, string _memberType) view external returns (bool isActive_);

  /**
   * Get the deposit value in AVT - to 18 sig fig - required to register a member.
   * See registerMember().
   */
  function getNewMemberDeposit(string _memberType) view external returns (uint memberDepositInAVT_);

  /**
  * @dev Create a challenge for the specified member.
  * @param _memberAddress - address of member to be challenged
  * @param _memberType type of member to be challenged
  * @return proposalId_ id for proposal representing the challenge
  */
  function challengeMember(address _memberAddress, string _memberType) external returns (uint proposalId_);

  /**
   * Gets the deposit paid for the specified member.
   */
  function getExistingMemberDeposit(address _memberAddress, string _memberType) external view returns (uint memberDepositInAVT_);
}