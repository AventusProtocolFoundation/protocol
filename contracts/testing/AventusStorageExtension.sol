pragma solidity 0.5.2;

import "../AventusStorage.sol";

contract AventusStorageExtension is AventusStorage {
  // To ensure memory slot alignment we recommend that all extension contracts inherit from the contract they are extending.
  // See these two links for further details:
  // - https://drive.google.com/open?id=1GcV7BRKYaFXvL8PyrMp4EOtD48jSK7es-emvFwzGNqk
  // - https://ethereum.stackexchange.com/questions/78778/safe-usage-of-delegatecall
  uint testValue;

  function setTestValue(uint value)
    external
  {
    testValue = value;
  }

  function getTestValue()
    external
    view
    returns (uint)
  {
    return testValue;
  }
}