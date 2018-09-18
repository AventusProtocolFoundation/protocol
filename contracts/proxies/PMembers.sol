pragma solidity ^0.4.24;

import "./PLibraryDelegate.sol";

contract PMembers is PLibraryDelegate {

  function () payable public {
    libraryDelegateFwd("LMembersInstance");
  }

}
