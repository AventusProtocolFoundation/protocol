pragma solidity ^0.4.19;

import '../interfaces/IAventusStorage.sol';

library LAventusTime {
    function getCurrentTime(IAventusStorage) view public returns (uint) {
        return now;
    }
}