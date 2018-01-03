pragma solidity ^0.4.19;

import "./PDelegate.sol";

contract PLock is PDelegate {

  function () payable public {
    initProxy("LLockInstance");
  }

}
