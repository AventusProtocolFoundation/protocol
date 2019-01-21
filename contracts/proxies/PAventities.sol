pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PAventities is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LAventitiesInstance");
  }

}
