pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PAventusTime is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LAventusTimeInstance");
  }

}
