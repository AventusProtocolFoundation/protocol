pragma solidity 0.5.2;

import "./PLibraryDelegate.sol";

contract PAVTManager is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LAVTManagerInstance");
  }
}