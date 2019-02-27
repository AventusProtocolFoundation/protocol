pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LAventusDLLStorage {
  
  // schema is hardcoded here for now as this lib is only being used for the voting DLL at present
  string constant votingDLLSchema = "VotingRevealTime";

  function setCount(IAventusStorage _storage, address _address, uint _value, uint _count)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "count")), _count);
  }

  function getCount(IAventusStorage _storage, address _address, uint _value)
    external
    view
    returns (uint count_)
  {
    count_ = _storage.getUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "count")));
  }

  function setNext(IAventusStorage _storage, address _address, uint _value, uint _nextValue)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "nextValue")), _nextValue);
  }

  function getNext(IAventusStorage _storage, address _address, uint _value)
    external
    view
    returns (uint nextValue_)
  {
    nextValue_ = _storage.getUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "nextValue")));
  }

  function setPrevious(IAventusStorage _storage, address _address, uint _value, uint _previousValue)
    external
  {
    _storage.setUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "previousValue")), _previousValue);
  }

  function getPrevious(IAventusStorage _storage, address _address, uint _value)
    external
    view
    returns (uint previousValue_)
  {
    previousValue_ = _storage.getUInt(keccak256(abi.encodePacked(votingDLLSchema, _address, _value, "previousValue")));
  }
}