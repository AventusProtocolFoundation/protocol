pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PAventusDLL is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LAventusDLLInstance");
  }
}