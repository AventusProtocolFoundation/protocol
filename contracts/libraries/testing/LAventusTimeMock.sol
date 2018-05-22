pragma solidity ^0.4.19;

import '../../interfaces/IAventusStorage.sol';

library LAventusTimeMock {
  bytes32 constant mockCurrentTimeKey = keccak256("MockCurrentTime");

  function getCurrentTime(IAventusStorage _s) view public returns (uint) {
      return _s.getUInt(mockCurrentTimeKey);
  }
}
