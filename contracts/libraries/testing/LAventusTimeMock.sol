pragma solidity ^0.4.24;

import '../../interfaces/IAventusStorage.sol';

library LAventusTimeMock {
  bytes32 constant mockCurrentTimeKey = keccak256(abi.encodePacked("MockCurrentTime"));

  function getCurrentTime(IAventusStorage _s) view public returns (uint) {
      return _s.getUInt(mockCurrentTimeKey);
  }
}
