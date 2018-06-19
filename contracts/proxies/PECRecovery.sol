pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PECRecovery is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LECRecoveryInstance");
  }

}
