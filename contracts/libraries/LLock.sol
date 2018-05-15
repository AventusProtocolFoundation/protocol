pragma solidity ^0.4.19;

import '../interfaces/IAventusStorage.sol';
import '../interfaces/IERC20.sol';
import "./LAventusTime.sol";

// Library for adding functionality for locking AVT stake for voting
library LLock {
  /**
  * @dev Withdraw AVT not used in an active vote or deposit.
  * @param s Storage contract
  * @param fund Fund to withdraw from
  * @param amount Amount to withdraw from lock
  */
  function withdraw(IAventusStorage s, string fund, uint amount)
    public
  {
    if (keccak256(fund) == keccak256("stake")) {
      require (!stakeChangeIsBlocked(s));
    } else {
      require(keccak256(fund) == keccak256("deposit"));
      require(!depositWithdrawlIsBlocked(s, amount));
    }

    bytes32 key = keccak256("Lock", fund, msg.sender);
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(keccak256("AVT")));

    // Only withdraw less or equal to amount locked
    require (amount <= currDeposit);
    // Overwrite user's locked amount
    s.setUInt(key, currDeposit - amount);
    // Check transfer desired amount
    require (avt.transfer(msg.sender, amount));

    updateBalance(s, amount, false);
  }

  /**
  * @dev Deposit & lock AVT for stake weighted votes
  * @param s Storage contract
  * @param fund Fund to deposit into
  * @param amount Amount to withdraw from lock
  */
  function deposit(IAventusStorage s, string fund, uint amount)
    public
  {
    if (keccak256(fund) == keccak256("stake")) {
      require (!stakeChangeIsBlocked(s));
    } else {
      require(keccak256(fund) == keccak256("deposit"));
    }

    bytes32 key = keccak256("Lock", fund, msg.sender);
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(keccak256("AVT")));

    // Make sure deposit amount is not zero
    require (amount != 0);
    // Overwrite locked funds amount
    s.setUInt(key, currDeposit + amount);
    // Check transfer succeeds
    require (avt.transferFrom(msg.sender, this, amount));

    updateBalance(s, amount, true);
  }

  function getBalance(IAventusStorage _s, string _fund, address _avtHolder)
    public
    view
    returns (uint _balance)
  {
    _balance = _s.getUInt(keccak256("Lock", _fund, _avtHolder));
  }

  function getAVTDecimals(IAventusStorage _storage, uint _usCents) public view returns (uint avtDecimals) {
    uint oneAvtInUsCents = _storage.getUInt(keccak256("OneAVTInUSCents"));
    avtDecimals = (_usCents * (10**18)) / oneAvtInUsCents;
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
  * @dev Check if the sender can withdraw/deposit AVT stake.
  * @param s Storage contract
  * @return True if the sender's funds are blocked, False if not.
  */
  function stakeChangeIsBlocked(IAventusStorage s)
    private
    view
    returns (bool)
  {
    uint blockedUntil = s.getUInt(keccak256("Voting", msg.sender, uint(0), "nextTime"));

    if (blockedUntil == 0)
      return false; // No unrevealed votes
    else if (LAventusTime.getCurrentTime(s) < blockedUntil)
      return false; // Voting still ongoing
    else
      return true; // Reveal period active (even if reveal is over tokens are blocked until reveal)
  }

  function depositWithdrawlIsBlocked(IAventusStorage s, uint amount)
    private
    view
    returns (bool)
  {
      uint expectedDeposits = s.getUInt(keccak256("ExpectedDeposits", msg.sender));
      uint actualDeposits = s.getUInt(keccak256("Lock", "deposit", msg.sender));
      require(actualDeposits >= amount);
      // If taking this amount of AVT out will mean we don't have enough deposits
      // then block the withdrawl.
      if (actualDeposits - amount < expectedDeposits) {
          return true;
      }
      return false;
  }
}
