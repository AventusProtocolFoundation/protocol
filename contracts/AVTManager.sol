pragma solidity ^0.5.2;

import "./interfaces/IAventusStorage.sol";
import "./interfaces/IAVTManager.sol";
import "./libraries/LAVTManager.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract AVTManager is IAVTManager, Owned, Versioned {

  IAventusStorage public s;

  constructor(IAventusStorage _s) public {
    s = _s;
  }

  function withdraw(string calldata _fund, uint _amount) external {
    LAVTManager.withdraw(s, _fund, _amount);
  }

  function deposit(string calldata _fund, uint _amount) external {
    LAVTManager.deposit(s, _fund, _amount);
  }

  function transfer(string calldata _fund, uint _amount, address _toAddress, string calldata _toFund) external {
    LAVTManager.transfer(s, _fund, _amount, _toAddress, _toFund);
  }

  function getBalance(string calldata _fund, address _avtHolder)
    external
    view
    returns (uint balance_)
  {
    balance_ = LAVTManager.getBalance(s, _avtHolder, _fund);
  }
}
