pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PEvents is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LEventsInstance");
  }

}
