pragma solidity ^0.4.24;

interface IAVTManager {
  /**
  * @dev Withdraw AVT not used in an active vote nor as an event, app or
  * proposal deposit.
  * @param _fund Fund to withdraw from (must be "deposit" or "stake")
  * @param _amount Amount to withdraw.
  */
  function withdraw(string _fund, uint _amount) external;

  /**
  * @dev Deposit AVT for event/proposal deposits and stake weighted votes
  * @param _fund Fund to deposit into (must be "deposit" or "stake")
  * @param _amount Amount to withdraw.
  */
  function deposit(string _fund, uint _amount) external;

  /**
   * @return the current amount of AVT that is locked up for the given AVT holder
   * address in the given fund.
   * @param _fund Fund to deposit into (must be "deposit" or "stake")
   * @param _avtHolder the address that we want the balance of.
   */
  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint balance_);
}