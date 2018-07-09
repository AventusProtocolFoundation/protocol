pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './PDelegate.sol';
import '../Versioned.sol';

contract PLibraryDelegate is PDelegate, Versioned {

  function libraryDelegateFwd(string _libraryInstanceKey) internal  {
    // NOTE: The first parameter from msg.data MUST be the AventusStorage contract
    // address or this will not work!
    address target = IAventusStorage(addressFromMsgData(msg.data)).getAddress(
      keccak256(abi.encodePacked(_libraryInstanceKey, "-", getVersionMajorMinor())));
    delegatedFwd(target, msg.data);
  }

  // The first 4 bytes of msg.data are the method name. The next 32 bytes are
  // the 20 bytes of address padded to bytes32. From this 36 bytes of data,
  // we ignore the first 16 bytes and then proceed from MSB to LSB, adding
  // each byte to the total one by one.
  // We keep a running total (result) of all the bytes we have seen.
  // Every time we add a new byte, we "push" all the existing bytes one place
  // to the left, multiplying the result by 256 and adding the new one.
  // This avoids explicit exponentiations and unnecessary multiplications
  function addressFromMsgData(bytes _data) private pure returns (address result_) {
    uint result = 0;
    for (uint i = 16; i < 36; ++i) {
      result *= 256;
      result += uint(_data[i]);
    }
    result_ = address(result);
  }

}