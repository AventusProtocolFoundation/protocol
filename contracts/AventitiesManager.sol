pragma solidity ^0.4.24;

import './interfaces/IAventitiesManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LAventities.sol';
import './Owned.sol';
import './Versioned.sol';

contract AventitiesManager is IAventitiesManager, Owned, Versioned {

    IAventusStorage public s;

    /**
    * @dev Constructor
    * @param _s Persistent storage contract
    */
    constructor(IAventusStorage _s) public {
      s = _s;
    }

    function registerAventity(address _aventityAddress, string _type, string _evidenceUrl, string _desc)
      external
      onlyOwner
    {
      LAventities.registerAventity(s, _aventityAddress, _type, _evidenceUrl, _desc);
    }

    function deregisterAventity(address _aventityAddress, string _type)
      external
      onlyOwner
    {
      LAventities.deregisterAventity(s, _aventityAddress, _type);
    }

    function challengeAventity(address /*_aventityAddress*/)
      external
      pure
    {
      // TODO: Create a proposal stating that aventity address is fraudulent. cf challengeEvent.
    }

    // TODO: rename to aventityIsActive.
    function aventityIsRegistered(address _aventityAddress, string _type)
      external
      view
      returns (bool isRegistered_)
    {
      isRegistered_ = _aventityAddress == owner || LAventities.aventityIsActive(s, _aventityAddress, _type);
    }

    function getAventityDeposit(string _type) external view returns (uint depositinAVT_) {
      depositinAVT_ = LAventities.getAventityDeposit(s, _type);
    }

    function getExistingAventityDeposit(uint _aventityId) external view returns (uint aventityDeposit_) {
      aventityDeposit_ = LAventities.getExistingAventityDeposit(s, _aventityId);
    }

}
