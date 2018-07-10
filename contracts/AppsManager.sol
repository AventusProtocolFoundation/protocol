pragma solidity ^0.4.24;

import './interfaces/IAppsManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LApps.sol';
import './Owned.sol';
import './Versioned.sol';

contract AppsManager is IAppsManager, Owned, Versioned {

    IAventusStorage public s;

    /**
    * @dev Constructor
    * @param _s Persistent storage contract
    */
    constructor(IAventusStorage _s) public {
      s = _s;
    }

    function registerApp(address _appAddress)
      external
      onlyOwner
    {
      LApps.registerApp(s, _appAddress);
    }

    function deregisterApp(address _appAddress)
      external
      onlyOwner
    {
      LApps.deregisterApp(s, _appAddress);
    }

    function challengeApp(address /*_appAddress*/)
      external
      pure
    {
      // TODO: Create a proposal stating that app address is fraudulent. cf challengeEvent.
    }

    function appIsRegistered(address _appAddress)
      external
      view
      returns (bool isRegistered_)
    {
      isRegistered_ = _appAddress == owner || LApps.appIsRegistered(s, _appAddress);
    }

    function getAppDeposit() external view returns (uint depositinAVT_) {
      depositinAVT_ = LApps.getAppDeposit(s);
    }

}