pragma solidity ^0.4.19;

// https://github.com/ethereum/EIPs/issues/20
contract IERC20 {
  function totalSupply() public constant returns (uint _totalSupply);
  function balanceOf(address _owner) public constant returns (uint _balance);
  function transfer(address _to, uint _value) public returns (bool _success);
  function transferFrom(address _from, address _to, uint _value) public returns (bool _success);    
  function approve(address _spender, uint _value) public returns (bool _success);
  function allowance(address _owner, address _spender) public constant returns (uint _remaining);
  // Triggered when tokens are transferred
  event Transfer(address indexed _from, address indexed _to, uint _value);
  // Triggered whenever approve(address _spender, uint _value) is called
  event Approval(address indexed _owner, address indexed _spender, uint _value);
}