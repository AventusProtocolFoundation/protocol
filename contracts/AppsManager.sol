pragma solidity ^0.4.19;

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
    function AppsManager(IAventusStorage s_) public {
      s = s_;
    }

    function appIsRegistered(address appAddress)
      view
      external
      returns (bool)
    {
      return appAddress == owner || LApps.appIsRegistered(s, appAddress);
    }

    function registerApp(address appAddress)
      onlyOwner
      external
    {
      LApps.registerApp(s, appAddress);
    }

    function deregisterApp(address appAddress)
      onlyOwner
      external
    {
      LApps.deregisterApp(s, appAddress);
    }

    function getAppDeposit() view external returns (uint) {
      return LApps.getAppDeposit(s);
    }

    function challengeApp(address /*appAddress*/)
      pure
      external
    {
      // TODO: Create a proposal stating that app address is fraudulent. cf challengeEvent.
    }
}