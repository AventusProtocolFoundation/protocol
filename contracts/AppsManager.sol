pragma solidity ^0.4.24;

import './interfaces/IAppsManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LApps.sol';
import './Owned.sol';

contract AppsManager is IAppsManager, Owned {
    event LogAppRegistered(address indexed appAddress);
    event LogAppDeregistered(address indexed appAddress);

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
      emit LogAppRegistered(_appAddress);
    }

    function deregisterApp(address _appAddress)
      external
      onlyOwner
    {
      LApps.deregisterApp(s, _appAddress);
      emit LogAppDeregistered(_appAddress);
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