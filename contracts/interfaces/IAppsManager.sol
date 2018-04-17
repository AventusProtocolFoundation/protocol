pragma solidity ^0.4.19;

interface IAppsManager {
  /**
   * @return true if the given app address is registered to use the Aventus Protocol.
   */
  function appIsRegistered(address appAddress) view external returns (bool);

  /**
   * Register the given app address to use the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getAppDeposit().
   */
  function registerApp(address appAddress) external;

  /**
   * Stop the given app address from using the Aventus Protoco. This will unlock
   * the deposit that was locked when the address was registered.
   */
  function deregisterApp(address appAddress) external;

  /**
   * Get the deposit value in AVT - to 18 sig fig - required to register an app.
   * See registerApp().
   */
  function getAppDeposit() view external returns (uint);

  /**
   * Create a challenge proposal stating that the given app address is fraudulent.
   */
  function challengeApp(address /*appAddress*/) pure external;
}