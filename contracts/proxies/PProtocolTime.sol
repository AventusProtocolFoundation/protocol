pragma solidity 0.5.2;

import "./PLibraryDelegate.sol";

contract PProtocolTime is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LProtocolTimeInstance");
  }
}
