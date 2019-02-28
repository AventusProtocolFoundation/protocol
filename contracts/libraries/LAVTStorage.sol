pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LAVTStorage {

  string constant avtSchema = "AVT";
  string constant avtAccountSchema = "AVTAccount";

  function getAVTBalance(IAventusStorage _storage, address _account)
    external
    view
    returns (uint balance_)
  {
    balance_ = _storage.getUInt(keccak256(abi.encodePacked(avtAccountSchema, _account)));
  }

  function decreaseAVT(IAventusStorage _storage, address _account, uint _amount)
    external
  {
    bytes32 key = keccak256(abi.encodePacked(avtAccountSchema, _account));
    uint currentBalance = _storage.getUInt(key);

    // TODO: Ensure amount is never greater than balance when this assert is removed
    assert(_amount <= currentBalance);
    _storage.setUInt(key, currentBalance - _amount);
  }

  function increaseAVT(IAventusStorage _storage,  address _account, uint _amount)
    external
  {
    bytes32 key = keccak256(abi.encodePacked(avtAccountSchema, _account));
    uint currentBalance = _storage.getUInt(key);
    require(_amount != 0, "Added amount must be greater than zero");
    _storage.setUInt(key, currentBalance + _amount);
  }

  function getExpectedDeposits(IAventusStorage _storage, address _account)
    external
    view
    returns (uint expectedDeposits_)
  {
    expectedDeposits_ = _storage.getUInt(keccak256(abi.encodePacked(avtSchema, "ExpectedDeposits", _account)));
  }

  function setExpectedDeposits(IAventusStorage _storage, address _account, uint _expectedDeposits)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(avtSchema, "ExpectedDeposits", _account)), _expectedDeposits);
  }
}