pragma solidity ^0.4.24;

import "./proxies/PDelegate.sol";
import "./interfaces/IAventusStorage.sol";
import './interfaces/IERC20.sol';
import "./MultiAccess.sol";

// Persistent storage on the blockchain
// TODO: Move javadoc to IAventusStorage for consistency.
// TODO: Use leading and trailing underscores on parameters and return values.

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

  // some storage key e.g. keccak("vote", voteId, "end") => stored uint value
  mapping(bytes32 => uint) UInt;
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint128 value
  mapping(bytes32 => uint128) UInt128;
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint64 value
  mapping(bytes32 => uint64) UInt64;
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint32 value
  mapping(bytes32 => uint32) UInt32;
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint16 value
  mapping(bytes32 => uint16) UInt16;
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint8 value
  mapping(bytes32 => uint8) UInt8;
  // some storage key e.g. keccak("vote", voteId, "end") => stored string value
  mapping(bytes32 => string) String;
  // some storage key e.g. keccak("vote", voteId, "end") => stored address value
  mapping(bytes32 => address) Address;
  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes value
  mapping(bytes32 => bytes) Bytes;
  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes32 value
  mapping(bytes32 => bytes32) Bytes32;
  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes16 value
  mapping(bytes32 => bytes16) Bytes16;
  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes8 value
  mapping(bytes32 => bytes8) Bytes8;
  // some storage key e.g. keccak("vote", voteId, "end") => stored bool value
  mapping(bytes32 => bool) Boolean;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int value
  mapping(bytes32 => int) Int;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int128 value
  mapping(bytes32 => int128) Int128;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int64 value
  mapping(bytes32 => int64) Int64;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int32 value
  mapping(bytes32 => int32) Int32;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int16 value
  mapping(bytes32 => int16) Int16;
  // some storage key e.g. keccak("vote", voteId, "end") => stored int8 value
  mapping(bytes32 => int8) Int8;

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

  /**
  * @dev Get a stored uint
  * @param record The key for finding a given record value
  */
  function getUInt(bytes32 record)
    external
    constant
    returns (uint)
  {
    return UInt[record];
  }

  /**
  * @dev Store a uint record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt(bytes32 record, uint value)
    external
    onlyWithWriteAccess
  {
    UInt[record] = value;
  }

  /**
   * @dev Get a stored uint128
   * @param record The key for finding a given record value
   */
  function getUInt128(bytes32 record)
    external
    constant
    returns (uint128)
  {
    return UInt128[record];
  }

  /**
  * @dev Store a uint128 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt128(bytes32 record, uint128 value)
    external
    onlyWithWriteAccess
  {
    UInt128[record] = value;
  }

  /**
  * @dev Get a stored uint64
  * @param record The key for finding a given record value
  */
  function getUInt64(bytes32 record)
    external
    constant
    returns (uint64)
  {
    return UInt64[record];
  }

  /**
  * @dev Store a uint64 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt64(bytes32 record, uint64 value)
    external
    onlyWithWriteAccess
  {
    UInt64[record] = value;
  }

  /**
  * @dev Get a stored uint32
  * @param record The key for finding a given record value
  */
  function getUInt32(bytes32 record)
    external
    constant
    returns (uint32)
  {
    return UInt32[record];
  }

  /**
  * @dev Store a uint32 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt32(bytes32 record, uint32 value)
    external
    onlyWithWriteAccess
  {
    UInt32[record] = value;
  }

  /**
  * @dev Get a stored uint16
  * @param record The key for finding a given record value
  */
  function getUInt16(bytes32 record)
    external
    constant
    returns (uint16)
  {
    return UInt16[record];
  }

  /**
  * @dev Store a uint16 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt16(bytes32 record, uint16 value)
    external
    onlyWithWriteAccess
  {
    UInt16[record] = value;
  }

  /**
  * @dev Get a stored uint8
  * @param record The key for finding a given record value
  */
  function getUInt8(bytes32 record)
    external
    constant
    returns (uint8)
  {
    return UInt8[record];
  }

  /**
  * @dev Store a uint8 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setUInt8(bytes32 record, uint8 value)
    external
    onlyWithWriteAccess
  {
    UInt8[record] = value;
  }

  /**
  * @dev Get a stored string value
  * @param record The key for finding a given record value
  */
  function getString(bytes32 record)
    external
    constant
    returns (string)
  {
    return String[record];
  }

  /**
  * @dev Store a string record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setString(bytes32 record, string value)
    external
    onlyWithWriteAccess
  {
    String[record] = value;
  }

  /**
  * @dev Get a stored address value
  * @param record The key for finding a given record value
  */
  function getAddress(bytes32 record)
    external
    constant
    returns (address)
  {
    return doGetAddress(record);
  }

  /**
  * @dev Store an address record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setAddress(bytes32 record, address value)
    external
    onlyWithWriteAccess
  {
    Address[record] = value;
  }

  /**
  * @dev Get a stored bytes value
  * @param record The key for finding a given record value
  */
  function getBytes(bytes32 record)
    external
    constant
    returns (bytes)
  {
    return Bytes[record];
  }

  /**
  * @dev Store a bytes record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setBytes(bytes32 record, bytes value)
    external
    onlyWithWriteAccess
  {
    Bytes[record] = value;
  }

  /**
  * @dev Get a stored bytes32 value
  * @param record The key for finding a given record value
  */
  function getBytes32(bytes32 record)
    external
    constant
    returns (bytes32)
  {
    return Bytes32[record];
  }

  /**
  * @dev Store a bytes32 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setBytes32(bytes32 record, bytes32 value)
    external
    onlyWithWriteAccess
  {
    Bytes32[record] = value;
  }

  /**
  * @dev Get a stored bytes16 value
  * @param record The key for finding a given record value
  */
  function getBytes16(bytes32 record)
    external
    constant
    returns (bytes16)
  {
    return Bytes16[record];
  }

  /**
  * @dev Store a bytes16 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setBytes16(bytes32 record, bytes16 value)
    external
    onlyWithWriteAccess
  {
    Bytes16[record] = value;
  }

  /**
  * @dev Get a stored bytes8 value
  * @param record The key for finding a given record value
  */
  function getBytes8(bytes32 record)
    external
    constant
    returns (bytes8)
  {
    return Bytes8[record];
  }

  /**
  * @dev Store a bytes8 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setBytes8(bytes32 record, bytes8 value)
    external
    onlyWithWriteAccess
  {
    Bytes8[record] = value;
  }

  /**
  * @dev Get a stored bool value
  * @param record The key for finding a given record value
  */
  function getBoolean(bytes32 record)
    external
    constant
    returns (bool)
  {
    return Boolean[record];
  }

  /**
  * @dev Store a bool record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setBoolean(bytes32 record, bool value)
    external
    onlyWithWriteAccess
  {
    Boolean[record] = value;
  }

  /**
  * @dev Get a stored int value
  * @param record The key for finding a given record value
  */
  function getInt(bytes32 record)
    external
    constant
    returns (int)
  {
    return Int[record];
  }

  /**
  * @dev Store an int record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt(bytes32 record, int value)
    external
    onlyWithWriteAccess
  {
    Int[record] = value;
  }

  /**
  * @dev Get a stored int128 value
  * @param record The key for finding a given record value
  */
  function getInt128(bytes32 record)
    external
    constant
    returns (int128)
  {
    return Int128[record];
  }

  /**
  * @dev Store an int128 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt128(bytes32 record, int128 value)
    external
    onlyWithWriteAccess
  {
    Int128[record] = value;
  }

  /**
  * @dev Get a stored int64 value
  * @param record The key for finding a given record value
  */
  function getInt64(bytes32 record)
    external
    constant
    returns (int64)
  {
    return Int64[record];
  }

  /**
  * @dev Store an int64 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt64(bytes32 record, int64 value)
    external
    onlyWithWriteAccess
  {
    Int64[record] = value;
  }

  /**
  * @dev Get a stored int32 value
  * @param record The key for finding a given record value
  */
  function getInt32(bytes32 record)
    external
    constant
    returns (int32)
  {
    return Int32[record];
  }

  /**
  * @dev Store an int32 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt32(bytes32 record, int32 value)
    external
    onlyWithWriteAccess
  {
    Int32[record] = value;
  }

  /**
  * @dev Get a stored int16 value
  * @param record The key for finding a given record value
  */
  function getInt16(bytes32 record)
    external
    constant
    returns (int16)
  {
    return Int16[record];
  }

  /**
  * @dev Store an int16 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt16(bytes32 record, int16 value)
    external
    onlyWithWriteAccess
  {
    Int16[record] = value;
  }

  /**
  * @dev Get a stored int8 value
  * @param record The key for finding a given record value
  */
  function getInt8(bytes32 record)
    external
    constant
    returns (int8)
  {
    return Int8[record];
  }

  /**
  * @dev Store an int8 record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setInt8(bytes32 record, int8 value)
    external
    onlyWithWriteAccess
  {
    Int8[record] = value;
  }

  function doGetAddress(bytes32 record)
    internal
    constant
    returns (address)
  {
    return Address[record];
  }

}
