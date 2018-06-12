pragma solidity ^0.4.24;

import "./Owned.sol";

contract MultiAccess is Owned {
  event AllowAccessEvent(address indexed _address);
  event DenyAccessEvent(address indexed _address);

  mapping(address => bool) accessAllowed;

  function allowAccess(address _address) public onlyOwner {
    accessAllowed[_address] = true;
    emit AllowAccessEvent(_address);
  }

  function denyAccess(address _address) public onlyOwner {
    accessAllowed[_address] = false;
    emit DenyAccessEvent(_address);
  }

  function isAllowedAccess() internal view {
    require(msg.sender == owner || accessAllowed[msg.sender]);
  }
  
}
