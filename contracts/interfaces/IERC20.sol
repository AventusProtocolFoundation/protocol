pragma solidity ^0.4.24;

// https://github.com/ethereum/EIPs/issues/20
interface IERC20 {
  function totalSupply() external constant returns (uint totalSupply_);
  function balanceOf(address _owner) external constant returns (uint balance_);
  function transfer(address _to, uint _value) external returns (bool success_);
  function transferFrom(address _from, address _to, uint _value) external returns (bool success_);
  function approve(address _spender, uint _value) external returns (bool success_);
  function allowance(address _owner, address _spender) external constant returns (uint remaining_);
  // Triggered when tokens are transferred
  event Transfer(address indexed _from, address indexed _to, uint _value);
  // Triggered whenever approve(address _spender, uint _value) is called
  event Approval(address indexed _owner, address indexed _spender, uint _value);
}