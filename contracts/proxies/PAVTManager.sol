pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PAVTManager is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LAVTManagerInstance");
  }

}
