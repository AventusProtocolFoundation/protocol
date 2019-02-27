pragma solidity ^0.5.2;

interface IAVTManager {

  /**
   * @notice Event emitted for a withdraw transaction.
   */
  event LogAVTWithdrawn(address indexed sender, uint amount);

  /**
   * @notice Event emitted for a Deposit transaction.
   */
  event LogAVTDeposited(address indexed sender, uint amount);

  /**
   * @notice Withdraw AVT that is not locked up.
   * @param _amount Amount to withdraw.
   */
  function withdraw(uint _amount) external;

  /**
   * @notice Deposit AVT.
   * @param _amount Amount to deposit.
   */
  function deposit(uint _amount) external;

  /**
   * @notice Transfer AVT between two accounts.
   * @param _amount Amount to withdraw.
   * @param _toAddress Address to be credited.
   */
  function transfer(uint _amount, address _toAddress) external;

  /**
   * @return the current amount of AVT stored for the given address.
   * @param _account the address that we want the balance of.
   */
  function getBalance(address _account) external view returns (uint balance_);
}