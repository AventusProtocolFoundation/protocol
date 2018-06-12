pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LLock.sol';

library LApps {
    bytes32 constant fixedDepositAmountKey = keccak256(abi.encodePacked("Applications", "fixedDepositAmount"));

    function registerApp(IAventusStorage s, address appAddress) public {
      require(
        !appIsRegistered(s, appAddress),
        "It's not possible to register an App that is already registered"
      );
      bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", appAddress));
      uint appDeposit = getAppDeposit(s);
      uint expectedDeposits = s.getUInt(expectedDepositsKey) + appDeposit;
      s.setUInt(expectedDepositsKey, expectedDeposits);
      uint actualDeposits = s.getUInt(keccak256(abi.encodePacked("Lock", "deposit", appAddress)));
      require(
        actualDeposits >= expectedDeposits,
        "Insufficient deposits to register this address"
      );

      s.setBoolean(keccak256(abi.encodePacked("AppRegistry", appAddress, "Approved")), true);
      s.setUInt(keccak256(abi.encodePacked("AppRegistry", appAddress, "Deposit")), appDeposit);
    }

    function deregisterApp(IAventusStorage s, address appAddress) public {
      require(
        appIsRegistered(s, appAddress),
        "Only registered Apps can be deregistered"
      );
      bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", appAddress));
      uint appDeposit = s.getUInt(keccak256(abi.encodePacked("AppRegistry", appAddress, "Deposit")));
      assert(s.getUInt(expectedDepositsKey) >= appDeposit); // If this asserts, we messed up the deposit code!
      s.setUInt(expectedDepositsKey, s.getUInt(expectedDepositsKey) - appDeposit);
      s.setBoolean(keccak256(abi.encodePacked("AppRegistry", appAddress, "Approved")), false);
    }

    // @return AVT value with 18 decimal places of precision.
    function getAppDeposit(IAventusStorage _storage) view public returns (uint _depositinAVT) {
      uint depositInUSCents = _storage.getUInt(fixedDepositAmountKey);
      _depositinAVT = LLock.getAVTDecimals(_storage, depositInUSCents);
    }

    function appIsRegistered(IAventusStorage s, address appAddress)
      public
      view
      returns (bool)
    {
      return s.getBoolean(keccak256(abi.encodePacked("AppRegistry", appAddress, "Approved")));
    }
}
