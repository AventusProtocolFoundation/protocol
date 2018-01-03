pragma solidity ^0.4.19;

import "../interfaces/IAventusStorage.sol";
import "../AventusData.sol";

contract PDelegate {

  /**
  * @dev Performs a delegatecall and returns whatever the delegatecall returned (entire context execution will return!)
  * @param dst Destination address to perform the delegatecall
  * @param calldata Calldata for the delegatecall
  */
  function delegatedFwd(address dst, bytes calldata) internal {
    require (isContract(dst));

    assembly {
      let result := delegatecall(sub(gas, 10000), dst, add(calldata, 0x20), mload(calldata), 0, 0)
      let size := returndatasize

      let ptr := mload(0x40)
      returndatacopy(ptr, 0, size)

      // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
      // if the call returned error data, forward it
      switch result case 0 { revert(ptr, size) }
      default { return(ptr, size) }
    }
  }

  function isContract(address target)
    view
    internal
    returns (bool)
  {
    uint256 size;

    assembly {
        size := extcodesize(target)
    }

    return size != 0;
  }

  function initProxy(string instanceKey) internal  {
    AventusData data = new AventusData();
    address target = IAventusStorage(data.s()).getAddress(keccak256(instanceKey));

    require (target > 0);

    delegatedFwd(target, msg.data);
  }
}
