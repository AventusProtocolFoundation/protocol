pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';

library LAventusTime {
    function getCurrentTime(IAventusStorage) view public returns (uint) {
        return now;
    }
}