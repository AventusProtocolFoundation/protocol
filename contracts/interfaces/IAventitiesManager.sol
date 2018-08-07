pragma solidity ^0.4.24;

interface IAventitiesManager {

  /**
   * Event emitted for a registerAventity transaction.
   */
  event LogAventityMemberRegistered(uint indexed aventityId, address indexed aventityAddress, string _type, string evidenceUrl, string desc, uint deposit);

  /**
   * Event emitted for a deregisterAventity transaction.
   */
  event LogAventityMemberDeregistered(uint indexed aventityId, address indexed aventityAddress, string _type);

  /**
   * Event emitted for a registerEventAventity transaction.
   */
  event LogAventityEventRegistered(uint indexed aventityId, address indexed ownerAddress, uint indexed entityId, string _type, string evidenceUrl, string desc, uint deposit);

  /**
   * Event emitted for a deregisterEventAventity transaction.
   */
  event LogAventityEventDeregistered(uint indexed aventityId, address indexed ownerAddress, uint indexed entityId, string _type);

  /**
   * Register the given aventity address to use the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getAventityDeposit().
   */
  function registerAventity(address _aventityAddress, string _type, string _evidenceUrl, string _desc) external;

  /**
   * Stop the given aventity address from using the Aventus Protocol. This will unlock
   * the deposit that was locked when the aventity was registered.
   */
  function deregisterAventity(address _aventityAddress, string _type) external;

  /**
   * @return true if the given aventity address is registered to use the Aventus Protocol.
   */
  function aventityIsRegistered(address _aventityAddress, string _type) view external returns (bool isRegistered_);

  /**
   * Get the deposit value in AVT - to 18 sig fig - required to register an aventity.
   * See registerAventity().
   */
  function getAventityDeposit(string _type) view external returns (uint depositinAVT_);

  /**
   * Create a challenge proposal stating that the given aventity address is fraudulent.
   */
  function challengeAventity(address /*_aventityAddress*/) external pure;

  /**
   * Gets the deposit paid for the specified aventity.
   */
  function getExistingAventityDeposit(uint _aventityId) external view returns (uint aventityDeposit_);
}