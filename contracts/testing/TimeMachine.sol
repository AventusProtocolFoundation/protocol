pragma solidity 0.5.2;

import "../libraries/testing/LProtocolTimeMock.sol";
import "../Owned.sol";

contract TimeMachine is Owned {

  IAventusStorage public s;

  constructor(IAventusStorage _s)
    public
  {
    s = _s;
  }

  function getCurrentTime()
    external
    view
    returns (uint time_)
  {
    time_ = LProtocolTimeMock.getCurrentTime(s);
  }

  function init()
    onlyOwner
    external
  {
    LProtocolTimeMock.init(s);
  }

  function advanceToTime(uint _timestamp)
    onlyOwner
    external
  {
    LProtocolTimeMock.advanceToTime(s, _timestamp);
  }
}