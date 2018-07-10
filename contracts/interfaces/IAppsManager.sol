pragma solidity ^0.4.24;

interface IAppsManager {

  /**
   * Event emitted for a registerApp transaction.
   */
  event LogAppRegistered(address indexed appAddress);

  /**
   * Event emitted for a deregisterApp transaction.
   */
  event LogAppDeregistered(address indexed appAddress);

  /**
   * Register the given app address to use the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getAppDeposit().
   */
  function registerApp(address _appAddress) external;

  /**
   * Stop the given app address from using the Aventus Protoco. This will unlock
   * the deposit that was locked when the address was registered.
   */
  function deregisterApp(address _appAddress) external;

  /**
   * @return true if the given app address is registered to use the Aventus Protocol.
   */
  function appIsRegistered(address _appAddress) view external returns (bool isRegistered_);

  /**
   * Get the deposit value in AVT - to 18 sig fig - required to register an app.
   * See registerApp().
   */
  function getAppDeposit() view external returns (uint depositinAVT_);

  /**
   * Create a challenge proposal stating that the given app address is fraudulent.
   */
  function challengeApp(address /*_appAddress*/) external pure;
}