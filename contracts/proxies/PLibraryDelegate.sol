pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";
import "./PDelegate.sol";

contract PLibraryDelegate is PDelegate {

  // The first 4 bytes of msg.data are the method name. The next 32 bytes are
  // the 20 bytes of address padded to bytes32. From this 36 bytes of data, we
  // start from the end (the LSB) and work back towwards the 16th byte (ie we
  // ignore the first 4 bytes AND the zero padding) creating a uint that can be
  // converted to an address.
  function addressFromMsgData(bytes data) private pure returns (address) {
    uint result = 0;
    for (uint i = 35; i != 15; --i) {
      result += uint(data[i]) * (16 ** ((35 - i) * 2));
    }
    return address(result);
  }

  function libraryDelegateFwd(string libraryInstanceKey) internal  {
    // NOTE: The first parameter from msg.data MUST be the AventusStorage contract
    // address or this will not work!
    address target = IAventusStorage(addressFromMsgData(msg.data)).getAddress(keccak256(libraryInstanceKey));
    delegatedFwd(target, msg.data);
  }
}
