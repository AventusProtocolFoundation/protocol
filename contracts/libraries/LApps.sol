pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LLock.sol';

library LApps {
    bytes32 constant fixedDepositAmountKey = keccak256(abi.encodePacked("Applications", "fixedDepositAmount"));

    function registerApp(IAventusStorage _storage, address _appAddress) external {
      require(
        !appIsRegistered(_storage, _appAddress),
        "It is not possible to register an App that is already registered"
      );
      bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", _appAddress));
      uint appDeposit = getAppDeposit(_storage);
      uint expectedDeposits = _storage.getUInt(expectedDepositsKey) + appDeposit;
      _storage.setUInt(expectedDepositsKey, expectedDeposits);
      uint actualDeposits = _storage.getUInt(keccak256(abi.encodePacked("Lock", "deposit", _appAddress)));
      require(
        actualDeposits >= expectedDeposits,
        'Insufficient deposits to register this address'
      );

      _storage.setBoolean(keccak256(abi.encodePacked("AppRegistry", _appAddress, "Approved")), true);
      _storage.setUInt(keccak256(abi.encodePacked("AppRegistry", _appAddress, "Deposit")), appDeposit);
    }

    function deregisterApp(IAventusStorage _storage, address _appAddress) external {
      require(
        appIsRegistered(_storage, _appAddress),
        "Only registered Apps can be deregistered"
      );
      bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", _appAddress));
      uint appDeposit = _storage.getUInt(keccak256(abi.encodePacked("AppRegistry", _appAddress, "Deposit")));
      assert(_storage.getUInt(expectedDepositsKey) >= appDeposit); // If this asserts, we messed up the deposit code!
      _storage.setUInt(expectedDepositsKey, _storage.getUInt(expectedDepositsKey) - appDeposit);
      _storage.setBoolean(keccak256(abi.encodePacked("AppRegistry", _appAddress, "Approved")), false);
    }

    // @return AVT value with 18 decimal places of precision.
    function getAppDeposit(IAventusStorage _storage) view public returns (uint depositinAVT_) {
      uint depositInUSCents = _storage.getUInt(fixedDepositAmountKey);
      depositinAVT_ = LLock.getAVTDecimals(_storage, depositInUSCents);
    }

    function appIsRegistered(IAventusStorage _storage, address _appAddress)
      public
      view
      returns (bool isRegistered_)
    {
      isRegistered_ = _storage.getBoolean(keccak256(abi.encodePacked("AppRegistry", _appAddress, "Approved")));
    }
}