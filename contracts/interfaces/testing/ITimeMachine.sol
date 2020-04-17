pragma solidity 0.5.2;

interface ITimeMachine {
  function getCurrentTime() external view returns (uint time_);
  function init() external;
  function advanceToTime(uint _timestamp) external;
}