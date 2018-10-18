pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';

library LAVTStorage {

  bytes32 constant oneAVTInUSCentsKey = keccak256(abi.encodePacked("OneAVTInUSCents"));

  function getOneAVTInUSCents(IAventusStorage _storage)
    external
    view
    returns (uint oneAVTInUSCents_)
  {
    oneAVTInUSCents_ = _storage.getUInt(oneAVTInUSCentsKey);
  }

  function getFundBalance(IAventusStorage _storage, address _avtHolder, string _fund)
    external
    view
    returns (uint balance_)
  {
    balance_ = _storage.getUInt(keccak256(abi.encodePacked("AVTFund", _avtHolder, _fund)));
  }

  function decreaseFund(IAventusStorage _storage, address _account, string _fund, uint _amount) external {
    bytes32 key = keccak256(abi.encodePacked("AVTFund", _account, _fund));
    uint currDeposit = _storage.getUInt(key);
    require (
      _amount <= currDeposit,
      "Amount taken must be less than current deposit"
    );
    _storage.setUInt(key, currDeposit - _amount);
  }

  function increaseFund(IAventusStorage _storage,  address _account, string _fund, uint _amount) external {
    bytes32 key = keccak256(abi.encodePacked("AVTFund", _account, _fund));
    uint currDeposit = _storage.getUInt(key);
    require (
      _amount != 0,
      "Added amount must be greater than zero"
    );
    _storage.setUInt(key, currDeposit + _amount);
  }

  function getExpectedDeposits(IAventusStorage _storage, address _depositHolder)
    external
    view
    returns (uint expectedDeposits_)
  {
    // TODO: consider renaming and changing top level schema name
    expectedDeposits_ = _storage.getUInt(keccak256(abi.encodePacked("ExpectedDeposits", _depositHolder)));
  }

  function setExpectedDeposits(IAventusStorage _storage, address _depositHolder, uint _expectedDeposits) external {
    _storage.setUInt(keccak256(abi.encodePacked("ExpectedDeposits", _depositHolder)), _expectedDeposits);
  }

}