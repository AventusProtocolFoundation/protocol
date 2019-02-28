pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusDLLStorage.sol";

library LAventusDLL {

  function incrementCount(IAventusStorage _storage, address _address, uint _value, uint _prevValue)
    external
  {
    uint count = LAventusDLLStorage.getCount(_storage, _address, _value);

    // If nothing exists for this value, create a new node in the DLL.
    if (count == 0) {
      // Make sure that the prev and next entries are valid first.
      uint nextValue = LAventusDLLStorage.getNext(_storage, _address, _prevValue);
      if (_prevValue != 0) {
        bool validPrevValue = _prevValue < _value && LAventusDLLStorage.getCount(_storage, _address, _prevValue) != 0;
        require(validPrevValue, "Invalid previous value");
      }
      if (nextValue != 0) {
        bool validNextValue = _value < nextValue && LAventusDLLStorage.getCount(_storage, _address, nextValue) != 0;
        require(validNextValue, "Invalid next value");
      }
      // Create new entry in the DLL between prevValue and nextValue.
      LAventusDLLStorage.setPrevious(_storage, _address, _value, _prevValue);
      LAventusDLLStorage.setNext(_storage, _address, _value, nextValue);
      LAventusDLLStorage.setNext(_storage, _address, _prevValue, _value);
      LAventusDLLStorage.setPrevious(_storage, _address, nextValue, _value);
    }

    LAventusDLLStorage.setCount(_storage, _address, _value, count + 1);
  }

  function decrementCount(IAventusStorage _storage, address _address, uint _value)
    external
  {
    uint count = LAventusDLLStorage.getCount(_storage, _address, _value);
    assert(count != 0);

    // If this was the only entry, remove the entire entry from the DLL.
    if (count == 1) {
      uint prevValue = LAventusDLLStorage.getPrevious(_storage, _address, _value);
      uint nextValue = LAventusDLLStorage.getNext(_storage, _address, _value);
      LAventusDLLStorage.setNext(_storage, _address, prevValue, nextValue);
      LAventusDLLStorage.setPrevious(_storage, _address, nextValue, prevValue);
    } else {
      LAventusDLLStorage.setCount(_storage, _address, _value, count - 1);
    }
  }

  function getPreviousValue(IAventusStorage _storage, address _address, uint _value)
    external
    view
    returns (uint prevValue_)
  {
    if (LAventusDLLStorage.getCount(_storage, _address, _value) != 0) {
      // We have an entry in the DLL for this value already.
      prevValue_ = LAventusDLLStorage.getPrevious(_storage, _address, _value);
      return prevValue_;
    }
    // Find where we would insert a new node; start looking at the head.
    prevValue_ = 0;
    while (true) {
      uint nextValue = LAventusDLLStorage.getNext(_storage, _address, prevValue_);
      if (nextValue == 0 || _value < nextValue) {
        break;
      }
      prevValue_ = nextValue;
    }
  }

  function getHeadValue(IAventusStorage _storage, address _address)
    external
    view
    returns (uint headValue_)
  {
    headValue_ = LAventusDLLStorage.getNext(_storage, _address, uint(0));
  }
}