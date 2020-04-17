pragma solidity 0.5.2;

import "./PLibraryDelegate.sol";

contract PEvents is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LEventsInstance");
  }
}