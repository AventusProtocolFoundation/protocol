pragma solidity ^0.5.2;

import "./PLibraryDelegate.sol";

contract PMembers is PLibraryDelegate {

  function () external {
    libraryDelegateFwd("LMembersInstance");
  }

}
