pragma solidity ^0.4.19;

import "./proxies/PDelegate.sol";
import "./interfaces/IAventusStorage.sol";
import "./Owned.sol";

// Persistent storage on the blockchain
contract AventusStorage is Owned, PDelegate, IAventusStorage {
  // some storage key e.g. keccak("vote", voteId, "end") => stored uint value
  mapping(bytes32 => uint) UInt;

  /**
  * @dev Get a stored uint
  * @param record The key for finding a given record value
  */
  function getUInt(bytes32 record)
    public
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
    public
    onlyOwner
  {
    UInt[record] = value;
  }

  /**
  * @dev Delete a uint record
  * @param record The record whose value you want to delete
  */
  function deleteUInt(bytes32 record)
    public
    onlyOwner
  {
    delete UInt[record];
  }

  // some storage key e.g. keccak("vote", voteId, "end") => stored string value
  mapping(bytes32 => string) String;

  /**
  * @dev Get a stored string value
  * @param record The key for finding a given record value
  */
  function getString(bytes32 record)
    public
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
    public
    onlyOwner
  {
    String[record] = value;
  }

  /**
  * @dev Delete a string record
  * @param record The record whose value you want to delete
  */
  function deleteString(bytes32 record)
    public
    onlyOwner
  {
    delete String[record];
  }

  // some storage key e.g. keccak("vote", voteId, "end") => stored address value
  mapping(bytes32 => address) Address;

  /**
  * @dev Get a stored address value
  * @param record The key for finding a given record value
  */
  function getAddress(bytes32 record)
    public
    constant
    returns (address)
  {
    return Address[record];
  }

  /**
  * @dev Store an address record
  * @param record The key that will be used to obtain value
  * @param value The value to be stored
  */
  function setAddress(bytes32 record, address value)
    public
    onlyOwner
  {
    Address[record] = value;
  }

  /**
  * @dev Delete an address record
  * @param record The record whose value you want to delete
  */
  function deleteAddress(bytes32 record)
    public
    onlyOwner
  {
    delete Address[record];
  }

  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes value
  mapping(bytes32 => bytes) Bytes;

  /**
  * @dev Get a stored bytes value
  * @param record The key for finding a given record value
  */
  function getBytes(bytes32 record)
    public
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
    public
    onlyOwner
  {
    Bytes[record] = value;
  }

  /**
  * @dev Delete a bytes record
  * @param record The record whose value you want to delete
  */
  function deleteBytes(bytes32 record)
    public
    onlyOwner
  {
    delete Bytes[record];
  }

  // some storage key e.g. keccak("vote", voteId, "end") => stored bytes32 value
  mapping(bytes32 => bytes32) Bytes32;

  /**
  * @dev Get a stored bytes32 value
  * @param record The key for finding a given record value
  */
  function getBytes32(bytes32 record)
    public
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
    public
    onlyOwner
  {
    Bytes32[record] = value;
  }

  /**
  * @dev Delete a bytes32 record
  * @param record The record whose value you want to delete
  */
  function deleteBytes32(bytes32 record)
    public
    onlyOwner
  {
    delete Bytes32[record];
  }

  // some storage key e.g. keccak("vote", voteId, "end") => stored bool value
  mapping(bytes32 => bool) Boolean;

  /**
  * @dev Get a stored bool value
  * @param record The key for finding a given record value
  */
  function getBoolean(bytes32 record)
    public
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
    public
    onlyOwner
  {
    Boolean[record] = value;
  }

  /**
  * @dev Delete a bool record
  * @param record The record whose value you want to delete
  */
  function deleteBoolean(bytes32 record)
    public
    onlyOwner
  {
    delete Boolean[record];
  }

  mapping(bytes32 => int) Int;

  /**
  * @dev Get a stored int value
  * @param record The key for finding a given record value
  */
  function getInt(bytes32 record)
    public
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
    public
    onlyOwner
  {
    Int[record] = value;
  }

  /**
  * @dev Delete an int record
  * @param record The record whose value you want to delete
  */
  function deleteInt(bytes32 record)
    public
    onlyOwner
  {
    delete Int[record];
  }

  /**
   * @dev In case we need to extend functionality - avoids copying state
   */
  function () payable public {
    address target = getAddress(keccak256("StorageInstance"));

    require (target > 0);

    delegatedFwd(target, msg.data);
  }
}
