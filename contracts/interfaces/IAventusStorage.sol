pragma solidity ^0.4.18;

contract IAventusStorage {
  mapping(bytes32 => uint) UInt;

  function getUInt(bytes32 record) public constant returns (uint);
  function setUInt(bytes32 record, uint value) public;
  function deleteUInt(bytes32 record) public;


  mapping(bytes32 => string) String;

  function getString(bytes32 record) public constant returns (string);
  function setString(bytes32 record, string value) public;
  function deleteString(bytes32 record) public;


  mapping(bytes32 => address) Address;

  function getAddress(bytes32 record) public constant returns (address);
  function setAddress(bytes32 record, address value) public;
  function deleteAddress(bytes32 record) public;


  mapping(bytes32 => bytes) Bytes;

  function getBytes(bytes32 record) public constant returns (bytes);
  function setBytes(bytes32 record, bytes value) public;
  function deleteBytes(bytes32 record) public;


  mapping(bytes32 => bytes32) Bytes32;

  function getBytes32(bytes32 record) public constant returns (bytes32);
  function setBytes32(bytes32 record, bytes32 value) public;
  function deleteBytes32(bytes32 record) public;


  mapping(bytes32 => bool) Boolean;

  function getBoolean(bytes32 record) public constant returns (bool);
  function setBoolean(bytes32 record, bool value) public;
  function deleteBoolean(bytes32 record) public;


  mapping(bytes32 => int) Int;

  function getInt(bytes32 record) public constant returns (int);
  function setInt(bytes32 record, int value) public;
  function deleteInt(bytes32 record) public;
}
