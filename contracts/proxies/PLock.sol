pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PLock is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LLockInstance");
  }

}
