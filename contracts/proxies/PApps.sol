pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PApps is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LAppsInstance");
  }

}
