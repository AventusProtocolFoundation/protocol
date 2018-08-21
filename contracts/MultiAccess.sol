pragma solidity ^0.4.24;

import "./Owned.sol";

contract MultiAccess is Owned {
  event LogAllowAccess(string accessType, address indexed accessAddress);
  event LogDenyAccess(string accessType, address indexed accessAddress);

  mapping(bytes32 => bool) accessAllowed;

  function allowAccess(string _accessType, address _address) external onlyOwner {
    accessAllowed[getKey(_accessType, _address)] = true;
    emit LogAllowAccess(_accessType, _address);
  }

  function denyAccess(string _accessType, address _address) external onlyOwner {
    accessAllowed[getKey(_accessType, _address)] = false;
    emit LogDenyAccess(_accessType, _address);
  }

  function isAllowedAccess(string _accessType) internal view {
    require(msg.sender == owner || accessAllowed[getKey(_accessType, msg.sender)]);
  }

  function getKey(string _accessType, address _address) private pure returns (bytes32 key_) {
    key_ = keccak256(abi.encodePacked(_accessType, _address));
  }

}
