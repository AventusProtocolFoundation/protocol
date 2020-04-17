pragma solidity 0.5.2;

import "../interfaces/IAventusStorage.sol";

library LProtocolTime {

  function getCurrentTime(IAventusStorage)
    external
    view
    returns (uint time_)
  {
      time_ = now;
  }
}