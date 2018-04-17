pragma solidity ^0.4.19;

import "./Owned.sol";

contract MultiAccess is Owned {
  event AllowAccessEvent(address indexed _address);
  event DenyAccessEvent(address indexed _address);

  mapping(address => bool) accessAllowed;

  function isAllowedAccess() view internal {
    require(msg.sender == owner || accessAllowed[msg.sender]);
  }

  function allowAccess(address _address) onlyOwner public {
    accessAllowed[_address] = true;
    emit AllowAccessEvent(_address);
  }

  function denyAccess(address _address) onlyOwner public {
    accessAllowed[_address] = false;
    emit DenyAccessEvent(_address);
  }
}
