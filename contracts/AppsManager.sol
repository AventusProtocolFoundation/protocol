pragma solidity ^0.4.24;

import './interfaces/IAppsManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LApps.sol';
import './libraries/LLock.sol';
import './Owned.sol';

contract AppsManager is IAppsManager, Owned {

    // TODO: Consider emitting logging events for these transactions.

    IAventusStorage public s;

    /**
    * @dev Constructor
    * @param s_ Persistent storage contract
    */
    constructor(IAventusStorage s_) public {
      s = s_;
    }

    function registerApp(address appAddress)
      external
      onlyOwner
    {
      LApps.registerApp(s, appAddress);
    }

    function deregisterApp(address appAddress)
      external
      onlyOwner
    {
      LApps.deregisterApp(s, appAddress);
    }

    function challengeApp(address /*appAddress*/)
      external
      pure
    {
      // TODO: Create a proposal stating that app address is fraudulent. cf challengeEvent.
    }

    function appIsRegistered(address appAddress)
      external
      view
      returns (bool)
    {
      return appAddress == owner || LApps.appIsRegistered(s, appAddress);
    }

    function getAppDeposit() external view returns (uint) {
      return LApps.getAppDeposit(s);
    }

}
