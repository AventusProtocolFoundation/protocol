pragma solidity ^0.4.24;

import '../../interfaces/IAventusStorage.sol';

library LAventusTimeMock {
  bytes32 constant mockCurrentTimeKey = keccak256(abi.encodePacked("MockCurrentTime"));

  function getCurrentTime(IAventusStorage _storage) view public returns (uint time_) {
      time_ = _storage.getUInt(mockCurrentTimeKey);
  }
}
