pragma solidity ^0.4.19;

interface IAVTManager {
  /**
  * @dev Withdraw AVT not used in an active vote nor as an event, app or
  * proposal deposit.
  * @param fund Fund to withdraw from (must be "deposit" or "stake")
  * @param amount Amount to withdraw.
  */
  function withdraw(string fund, uint amount) external;

  /**
  * @dev Deposit AVT for event/proposal deposits and stake weighted votes
  * @param fund Fund to deposit into (must be "deposit" or "stake")
  * @param amount Amount to withdraw.
  */
  function deposit(string fund, uint amount) external;

  /**
   * @return the current amount of AVT that is locked up for the given AVT holder
   * address in the given fund.
   * @param _fund Fund to deposit into (must be "deposit" or "stake")
   * @param _avtHolder the address that we want the balance of.
   */
  function getBalance(string _fund, address _avtHolder)
    external
    view
    returns (uint _balance);


  // @dev Toggle the ability to lock funds (For security)
  function toggleLockFreeze() external;

  /**
  * @dev Set up safety controls for initial release of voting
  * @param restricted True if we are in restricted mode
  * @param amount Maximum amount of AVT any account can lock up at a time
  * @param balance Maximum amount of AVT that can be locked up in total
  */
  function setThresholds(bool restricted, uint amount, uint balance) external;
}