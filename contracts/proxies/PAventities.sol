pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PAventities is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LAventitiesInstance");
  }

}
