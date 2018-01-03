pragma solidity ^0.4.19;

import '../interfaces/IAventusStorage.sol';
import '../interfaces/IERC20.sol';

// Library for adding functionality for locking AVT stake for voting
library LLock {

  // If locking AVT functionality is on and address has locked AVT, throw
  modifier isLocked(IAventusStorage s, uint amount) {
    require (!s.getBoolean(keccak256("LockFreeze")) && !isAddressLocked(s, msg.sender));

    if (s.getBoolean(keccak256("LockRestricted")))
      require (s.getUInt(keccak256("LockBalance")) <= s.getUInt(keccak256("LockBalanceMax")) && amount <= s.getUInt(keccak256("LockAmountMax")));
    _;
  }

  /**
  * @dev Withdraw locked, staked AVT not used in an active vote
  * @param s Storage contract
  * @param addr Address of the account withdrawing funds
  * @param amount Amount to withdraw from lock
  */
  function withdraw(IAventusStorage s, address addr, uint amount)
    public
    isLocked(s, amount)
  {
    bytes32 key = keccak256("Lock", addr);
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(keccak256("AVT")));

    // Only withdraw less or equal to amount locked
    require (amount <= currDeposit);
    // Overwrite user's locked amount
    s.setUInt(key, currDeposit - amount);
    // Check transfer desired amount
    require (avt.transfer(addr, amount));

    updateBalance(s, amount, false);
  }

  /**
  * @dev Deposit & lock AVT for stake weighted votes
  * @param s Storage contract
  * @param addr Address of the account depositing funds
  * @param amount Amount to withdraw from lock
  */
  function deposit(IAventusStorage s, address addr, uint amount)
    public
    isLocked(s, amount)
  {
    bytes32 key = keccak256("Lock", addr);
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(keccak256("AVT")));

    // Make sure deposit amount is not zero
    require (amount > 0);
    // Overwrite locked funds amount
    s.setUInt(key, currDeposit + amount);
    // Check transfer succeeds
    require (avt.transferFrom(addr, this, amount));

    updateBalance(s, amount, true);
  }

  /**
  * @dev Toggle the ability to lock funds for staking (For security)
  * @param s Storage contract
  */
  function toggleLockFreeze(IAventusStorage s) public {
    bytes32 key = keccak256("LockFreeze");
    bool frozen = s.getBoolean(key);

    s.setBoolean(key, !frozen);
  }

  /**
  * @dev Set up safety controls for initial release of voting
  * @param s Storage contract
  * @param restricted True if we are in restricted mode
  * @param amount Maximum amount of AVT any account can lock up at a time
  * @param balance Maximum amount of AVT that can be locked up in total
  */
  function setThresholds(IAventusStorage s, bool restricted, uint amount, uint balance) public {
    s.setBoolean(keccak256("LockRestricted"), restricted);
    s.setUInt(keccak256("LockAmountMax"), amount);
    s.setUInt(keccak256("LockBalanceMax"), balance);
  }

  /**
  * @dev Set up safety controls for initial release of voting
  * @param s Storage contract
  * @param amount amount to update the balance by
  * @param increment True if incrementing balance
  */
  function updateBalance(IAventusStorage s, uint amount, bool increment) private {
    bytes32 key = keccak256("LockBalance");
    uint balance = s.getUInt(key);

    if (increment)
      balance += amount;
    else
      balance -= amount;

    s.setUInt(key, balance);
  }

  /**
  * @dev Check if an entity's AVT stake is still locked
  * @param s Storage contract
  * @param user Entity's address
  * @return True if user funds are locked, False if not
  */
  function isAddressLocked(IAventusStorage s, address user)
    private
    constant
    returns (bool)
  {
    uint lockedUntil = s.getUInt(keccak256("Voting", user, uint(0), "nextTime"));

    if (lockedUntil == 0)
      return false; // No unrevealed votes
    else if (now < lockedUntil)
      return false; // Voting still ongoing
    else
      return true; // Reveal period active (even if reveal is over tokens are locked until reveal)
  }
}
