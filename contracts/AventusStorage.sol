pragma solidity ^0.4.24;

import "./proxies/PDelegate.sol";
import "./interfaces/IAventusStorage.sol";
import './interfaces/IERC20.sol';
import "./MultiAccess.sol";

// Persistent storage on the blockchain

contract AventusStorage is MultiAccess, PDelegate, IAventusStorage {
  bytes32 constant avtContractAddressKey = keccak256(abi.encodePacked("AVTERC20Instance"));

  modifier onlyWithWriteAccess() {
    isAllowedAccess("write");
    _;
  }

  modifier onlyWithTransferAVTAccess() {
    isAllowedAccess("transferAVT");
    _;
  }

  mapping(bytes32 => uint) UInt;
  mapping(bytes32 => string) String;
  mapping(bytes32 => address) Address;
  mapping(bytes32 => bytes) Bytes;
  mapping(bytes32 => bytes32) Bytes32;
  mapping(bytes32 => bool) Boolean;
  mapping(bytes32 => int) Int;

  function transferAVTTo(address _to, uint _tokens) external onlyWithTransferAVTAccess returns (bool retVal_) {
    IERC20 avt = IERC20(doGetAddress(avtContractAddressKey));
    retVal_ = avt.transfer(_to, _tokens);
  }

  function transferAVTFrom(address _from, uint _tokens) external onlyWithTransferAVTAccess returns (bool retVal_) {
    IERC20 avt = IERC20(doGetAddress(avtContractAddressKey));
    retVal_ = avt.transferFrom(_from, this, _tokens);
  }

  /**
   * @dev In case we need to extend functionality - avoids copying state
   */
  function () payable external {
    address target = doGetAddress(keccak256(abi.encodePacked("StorageInstance")));

    require (target > 0);

    delegatedFwd(target, msg.data);
  }

  function getUInt(bytes32 _record)
    external
    view
    returns (uint value_)
  {
    value_ = UInt[_record];
  }

  function setUInt(bytes32 _record, uint _value)
    external
    onlyWithWriteAccess
  {
    UInt[_record] = _value;
  }

  function getString(bytes32 _record)
    external
    view
    returns (string value_)
  {
    value_ = String[_record];
  }

  function setString(bytes32 _record, string _value)
    external
    onlyWithWriteAccess
  {
    String[_record] = _value;
  }

  function getAddress(bytes32 _record)
    external
    view
    returns (address value_)
  {
    value_ = doGetAddress(_record);
  }

  function setAddress(bytes32 _record, address _value)
    external
    onlyWithWriteAccess
  {
    Address[_record] = _value;
  }

  function getBytes(bytes32 _record)
    external
    view
    returns (bytes value_)
  {
    value_ = Bytes[_record];
  }

  function setBytes(bytes32 _record, bytes _value)
    external
    onlyWithWriteAccess
  {
    Bytes[_record] = _value;
  }

  function getBytes32(bytes32 _record)
    external
    view
    returns (bytes32 value_)
  {
    value_ = Bytes32[_record];
  }

  function setBytes32(bytes32 _record, bytes32 _value)
    external
    onlyWithWriteAccess
  {
    Bytes32[_record] = _value;
  }

  function getBoolean(bytes32 _record)
    external
    view
    returns (bool value_)
  {
    value_ = Boolean[_record];
  }

  function setBoolean(bytes32 _record, bool _value)
    external
    onlyWithWriteAccess
  {
    Boolean[_record] = _value;
  }

  function getInt(bytes32 _record)
    external
    view
    returns (int value_)
  {
    value_ = Int[_record];
  }

  function setInt(bytes32 _record, int _value)
    external
    onlyWithWriteAccess
  {
    Int[_record] = _value;
  }

  function doGetAddress(bytes32 _record)
    internal
    view
    returns (address value_)
  {
    value_ = Address[_record];
  }

}
