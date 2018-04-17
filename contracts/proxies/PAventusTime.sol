pragma solidity ^0.4.19;

import "./PLibraryDelegate.sol";

contract PAventusTime is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LAventusTimeInstance");
  }

}
