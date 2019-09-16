pragma solidity ^0.5.2;

import "../interfaces/IERC20.sol";

contract AVTContractForTesting is IERC20 {
  uint private constant oneAVTInNat = 10**18;
  uint private constant totalSupplyInAVT = 10000000; // 10,000,000 - same as the one on mainnet so we don't go over this.
  uint private constant totalSupplyInNat = totalSupplyInAVT * oneAVTInNat;
  mapping (address => uint) balances;
  mapping (address => mapping (address => uint)) approvals;

  constructor ()
    public
  {
    balances[msg.sender] = totalSupplyInNat;
  }

  function totalSupply()
    external
    view
    returns (uint totalSupply_)
  {
    totalSupply_ = totalSupplyInNat;
  }

  function balanceOf(address _owner)
    external
    view
    returns (uint balance_)
  {
    balance_ = balances[_owner];
  }

  function transfer(address _to, uint _value)
    external
    returns (bool success_)
  {
    success_ = balances[msg.sender] >= _value;
    require(success_, '');
    balances[msg.sender] -= _value;
    balances[_to] += _value;
  }

  function transferFrom(address _from, address _to, uint _value)
    external
    returns (bool success_)
  {
    success_ = balances[_from] >= _value && approvals[_from][_to] >= _value;
    require(success_, '');
    approvals[_from][_to] -= _value;
    balances[_from] -= _value;
    balances[_to] += _value;
  }

  function approve(address _spender, uint _value)
    external
    returns (bool success_)
  {
    approvals[msg.sender][_spender] = _value;
    success_ = true;
  }

  function allowance(address _owner, address _spender)
    external
    view
    returns (uint remaining_)
  {
    remaining_ = approvals[_owner][_spender];
  }
}