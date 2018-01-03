pragma solidity ^0.4.19;

import './Owned.sol';

contract Migrations is Owned {
  uint public last_completed_migration;

  function setCompleted(uint completed) 
    public 
    onlyOwner
  {
    last_completed_migration = completed;
  }

  function upgrade(address newAddress)
    public 
    onlyOwner
  {
    Migrations upgraded = Migrations(newAddress);
    upgraded.setCompleted(last_completed_migration);
  }
}
