pragma solidity ^0.4.24;

interface IAVTManager {

  /**
   * @notice Event emitted for a withdraw transaction.
   */
  event LogAVTWithdrawn(address indexed sender, string fund, uint amount);

  /**
   * @notice Event emitted for a Deposit transaction.
   */
  event LogAVTDeposited(address indexed sender, string fund, uint amount);

  /**
   * @notice Withdraw AVT not locked up in stake or deposit fund.
   * @param _fund Fund to withdraw from (must be "deposit" or "stake")
   * @param _amount Amount to withdraw.
   */
  function withdraw(string _fund, uint _amount) external;

  /**
   * @notice Deposit AVT for aventity/proposal deposits and stake weighted votes
   * @param _fund Fund to deposit into (must be "deposit" or "stake")
   * @param _amount Amount to deposit.
   */
  function deposit(string _fund, uint _amount) external;

  /**
   * @notice Transfer AVT for aventity/proposal deposits and stake weighted votes between two accounts
   * @param _fund Fund to withdraw from (must be "deposit" or "stake")
   * @param _amount Amount to withdraw.
   * @param _toAddress Address to be credited.
   * @param _toFund Fund to be credited (must be "deposit" or "stake")
   */
  function transfer(string _fund, uint _amount, address _toAddress, string _toFund) external;

  /**
   * @return the current amount of AVT stored for the given address in the given fund.
   * @param _fund Fund to get balance for (must be "deposit" or "stake")
   * @param _avtHolder the address that we want the balance of.
   */
  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint balance_);
}
