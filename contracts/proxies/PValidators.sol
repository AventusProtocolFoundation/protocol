pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PValidators is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LValidatorsInstance");
  }
}