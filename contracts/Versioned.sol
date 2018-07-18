pragma solidity ^0.4.24;

contract Versioned {
  string public constant versionMajor = "0";
  string public constant versionMinor = "7";
  string public constant versionPoint = "1";

  function getVersion() public pure returns (string version_) {
    version_ = string(abi.encodePacked(versionMajor, ".", versionMinor, ".", versionPoint));
  }

  function getVersionMajorMinor() public pure returns (string version_) {
    version_ = string(abi.encodePacked(versionMajor, ".", versionMinor));
  }
}