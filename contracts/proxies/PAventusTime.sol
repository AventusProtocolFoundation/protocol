pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PAventusTime is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LAventusTimeInstance");
  }

}
