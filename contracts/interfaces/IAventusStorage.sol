pragma solidity ^0.4.19;

interface IAventusStorage {
  function getUInt(bytes32 record) external constant returns (uint);
  function setUInt(bytes32 record, uint value) external;
  function deleteUInt(bytes32 record) external;

  function getUInt128(bytes32 record) external constant returns (uint128);
  function setUInt128(bytes32 record, uint128 value) external;
  function deleteUInt128(bytes32 record) external;

  function getUInt64(bytes32 record) external constant returns (uint64);
  function setUInt64(bytes32 record, uint64 value) external;
  function deleteUInt64(bytes32 record) external;

  function getUInt32(bytes32 record) external constant returns (uint32);
  function setUInt32(bytes32 record, uint32 value) external;
  function deleteUInt32(bytes32 record) external;

  function getUInt16(bytes32 record) external constant returns (uint16);
  function setUInt16(bytes32 record, uint16 value) external;
  function deleteUInt16(bytes32 record) external;

  function getUInt8(bytes32 record) external constant returns (uint8);
  function setUInt8(bytes32 record, uint8 value) external;
  function deleteUInt8(bytes32 record) external;

  function getString(bytes32 record) external constant returns (string);
  function setString(bytes32 record, string value) external;
  function deleteString(bytes32 record) external;

  function getAddress(bytes32 record) external constant returns (address);
  function setAddress(bytes32 record, address value) external;
  function deleteAddress(bytes32 record) external;

  function getBytes(bytes32 record) external constant returns (bytes);
  function setBytes(bytes32 record, bytes value) external;
  function deleteBytes(bytes32 record) external;

  function getBytes32(bytes32 record) external constant returns (bytes32);
  function setBytes32(bytes32 record, bytes32 value) external;
  function deleteBytes32(bytes32 record) external;

  function getBoolean(bytes32 record) external constant returns (bool);
  function setBoolean(bytes32 record, bool value) external;
  function deleteBoolean(bytes32 record) external;

  function getInt(bytes32 record) external constant returns (int);
  function setInt(bytes32 record, int value) external;
  function deleteInt(bytes32 record) external;

  function getInt128(bytes32 record) external constant returns (int128);
  function setInt128(bytes32 record, int128 value) external;
  function deleteInt128(bytes32 record) external;

  function getInt64(bytes32 record) external constant returns (int64);
  function setInt64(bytes32 record, int64 value) external;
  function deleteInt64(bytes32 record) external;

  function getInt32(bytes32 record) external constant returns (int32);
  function setInt32(bytes32 record, int32 value) external;
  function deleteInt32(bytes32 record) external;

  function getInt16(bytes32 record) external constant returns (int16);
  function setInt16(bytes32 record, int16 value) external;
  function deleteInt16(bytes32 record) external;

  function getInt8(bytes32 record) external constant returns (int8);
  function setInt8(bytes32 record, int8 value) external;
  function deleteInt8(bytes32 record) external;
}
