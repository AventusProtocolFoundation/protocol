pragma solidity ^0.4.19;

import '../interfaces/IAventusStorage.sol';
import './LLock.sol';

library LApps {
    function registerApp(IAventusStorage s, address appAddress) internal {
      require(!appIsRegistered(s, appAddress));
      bytes32 key = keccak256("ExpectedDeposits", appAddress);
      uint expectedDeposits = s.getUInt(key) + getAppDeposit(s);
      s.setUInt(key, expectedDeposits);
      uint actualDeposits = s.getUInt(keccak256("Lock", "deposit", appAddress));
      require(actualDeposits >= expectedDeposits);

      s.setBoolean(keccak256("AppRegistry", "Approved", appAddress), true);
    }

    function deregisterApp(IAventusStorage s, address appAddress) internal {
      require(appIsRegistered(s, appAddress));
      bytes32 key = keccak256("ExpectedDeposits", appAddress);
      assert(s.getUInt(key) >= getAppDeposit(s)); // If this asserts, we messed up the deposit code!
      s.setUInt(key, s.getUInt(key) - getAppDeposit(s));
      s.setBoolean(keccak256("AppRegistry", "Approved", appAddress), false);
    }

    // @return AVT value with 18 decimal places of precision.
    function getAppDeposit(IAventusStorage _storage) view public returns (uint _depositinAVT) {
      uint depositInUSCents = _storage.getUInt(keccak256("Applications", "fixedDepositAmount"));
      _depositinAVT = LLock.getAVTDecimals(_storage, depositInUSCents);
    }

    function appIsRegistered(IAventusStorage s, address appAddress)
      internal
      view
      returns (bool)
    {
      return s.getBoolean(keccak256("AppRegistry", "Approved", appAddress));
    }
}