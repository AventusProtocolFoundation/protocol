pragma solidity ^0.4.19;

import '../../interfaces/IAventusStorage.sol';

library LAventusTimeMock {
    function getCurrentTime(IAventusStorage s) view public returns (uint) {
        return s.getUInt(keccak256("MockCurrentTime"));
    }
}
