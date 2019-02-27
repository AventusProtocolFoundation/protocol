pragma solidity ^0.5.2;

import "../../interfaces/IAventusStorage.sol";

library LAventusTimeMock {
  
  bytes32 constant mockCurrentTimeKey = keccak256(abi.encodePacked("MockCurrentTime"));

  function getCurrentTime(IAventusStorage _storage)
    public
    view
    returns (uint time_)
  {
      time_ = _storage.getUInt(mockCurrentTimeKey);
  }
}