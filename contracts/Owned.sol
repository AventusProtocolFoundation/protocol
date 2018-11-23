pragma solidity ^0.4.24;

contract Owned {
  address public owner = msg.sender;

  modifier onlyOwner {
    require(msg.sender == owner, "Sender must be owner");
    _;
  }

  function setOwner(address _owner)
    public
    onlyOwner
  {
    require(_owner != 0x0, "Owner cannot be zero address");
    owner = _owner;
  }
}
