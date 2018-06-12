pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import '../interfaces/IERC20.sol';
import "./LAventusTime.sol";

// Library for adding functionality for locking AVT stake for voting
library LLock {
  bytes32 constant stakeFundHash = keccak256(abi.encodePacked("stake"));
  bytes32 constant depositFundHash = keccak256(abi.encodePacked("deposit"));
  bytes32 constant avtContractAddressKey = keccak256(abi.encodePacked("AVT"));
  bytes32 constant oneAVTInUSCentsKey = keccak256(abi.encodePacked("OneAVTInUSCents"));
  bytes32 constant lockBalanceKey = keccak256(abi.encodePacked("LockBalance"));

  // See IAVTManager.withdraw for details.
  function withdraw(IAventusStorage s, string fund, uint amount)
    public
  {
    if (keccak256(abi.encodePacked(fund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(s, msg.sender),
        "A blocked stake cannot be withdrawn"
      );
    } else {
      require(
        keccak256(abi.encodePacked(fund)) == depositFundHash,
        "withdraw must be called for 'stake' or 'deposit' only"
      );
      require(
        !depositWithdrawlIsBlocked(s, amount, msg.sender),
        "A blocked deposit cannot be withdrawn"
      );
    }

    bytes32 key = keccak256(abi.encodePacked("Lock", fund, msg.sender));
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(avtContractAddressKey));

    require (
      amount <= currDeposit,
      "Withdrawn amount must be less than current deposit"
    );
    s.setUInt(key, currDeposit - amount);
    require (
      avt.transfer(msg.sender, amount),
      "Transfer of funds in 'withdraw' must succeed before continuing"
    );

    updateBalance(s, amount, false);
  }

  // See IAVTManager.deposit for details.
  function deposit(IAventusStorage s, string fund, uint amount)
    public
  {
    if (keccak256(abi.encodePacked(fund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(s, msg.sender),
        "It's not possible to deposit into a blocked stake"
      );
    } else {
      require(
        keccak256(abi.encodePacked(fund)) == depositFundHash,
        "'deposit' must be called for 'stake' or 'deposit' only"
      );
    }

    bytes32 key = keccak256(abi.encodePacked("Lock", fund, msg.sender));
    uint currDeposit = s.getUInt(key);
    IERC20 avt = IERC20(s.getAddress(avtContractAddressKey));

    require (
      amount != 0,
      "A deposit must be greater than zero"
    );
    s.setUInt(key, currDeposit + amount);
    require (
      avt.transferFrom(msg.sender, this, amount),
      "Transfer of funds in 'deposit' must succeed before continuing"
    );

    updateBalance(s, amount, true);
  }

  function checkedTransfer(IAventusStorage _storage, uint _amount, address _fromAddress, string _fromFund, address _toAddress, string _toFund) public {
    if (keccak256(abi.encodePacked(_fromFund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, _fromAddress),
        "A blocked stake cannot be transferred"
      );
    } else {
      require(
        keccak256(abi.encodePacked(_fromFund)) == depositFundHash,
        "'checkedTransfer' must be called for 'stake' or 'deposit' only"
      );
      require(
        !depositWithdrawlIsBlocked(_storage, _amount, _fromAddress),
        "A blocked deposit cannot be transferred"
      );
    }

    if (keccak256(abi.encodePacked(_toFund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, _toAddress),
        "A blocked stake cannot receive transfers"
      );
    }

    transfer(_storage, _amount, _fromAddress, _fromFund, _toAddress, _toFund);
  }

  // NOTE: This version has NO CHECKS on whether the transfer should blocked so should only be
  // used internally. Consider checkedTransfer() instead.
  function transfer(IAventusStorage _storage, uint _amount, address _fromAddress, string _fromFund, address _toAddress, string _toFund) public {
    require (
      _amount != 0,
      "The amount of a transfer must be positive"
    );

    // Take AVT from the "from" fund...
    bytes32 fromKey = keccak256(abi.encodePacked("Lock", _fromFund, _fromAddress));
    uint currentFromBalance = _storage.getUInt(fromKey);
    require(
      currentFromBalance >= _amount,
      "The transfer amount must not exceed the source fund's balance"
    );
    _storage.setUInt(fromKey, currentFromBalance - _amount);

    // ...and give it to the "to" fund.
    bytes32 toKey = keccak256(abi.encodePacked("Lock", _toFund, _toAddress));
    _storage.setUInt(toKey, _storage.getUInt(toKey) + _amount);
  }

  // See IAVTManager.getBalance for details.
  function getBalance(IAventusStorage _s, string _fund, address _avtHolder)
    public
    view
    returns (uint _balance)
  {
    _balance = _s.getUInt(keccak256(abi.encodePacked("Lock", _fund, _avtHolder)));
  }

  function getAVTDecimals(IAventusStorage _storage, uint _usCents) public view returns (uint avtDecimals) {
    uint oneAvtInUsCents = _storage.getUInt(oneAVTInUSCentsKey);
    avtDecimals = (_usCents * (10**18)) / oneAvtInUsCents;
  }

  /**
  * Keep track of the total locked in the contract.
  * @param s Storage contract
  * @param amount amount to update the balance by
  * @param increment True if incrementing balance
  */
  function updateBalance(IAventusStorage s, uint amount, bool increment) private {
    uint balance = s.getUInt(lockBalanceKey);

    if (increment)
      balance += amount;
    else
      balance -= amount;

    s.setUInt(lockBalanceKey, balance);
  }

  /**
  * Check if the sender can withdraw/deposit AVT stake.
  * @param s Storage contract
  * @return True if the sender's funds are blocked, False if not.
  */
  function stakeChangeIsBlocked(IAventusStorage s, address stakeHolder)
    private
    view
    returns (bool)
  {
    uint blockedUntil = s.getUInt(keccak256(abi.encodePacked("Voting", stakeHolder, uint(0), "nextTime")));

    if (blockedUntil == 0)
      return false; // No unrevealed votes
    else if (LAventusTime.getCurrentTime(s) < blockedUntil)
      return false; // Voting still ongoing
    else
      return true; // Reveal period active (even if reveal is over tokens are blocked until reveal)
  }

  function depositWithdrawlIsBlocked(IAventusStorage s, uint amount, address depositHolder)
    private
    view
    returns (bool)
  {
      uint expectedDeposits = s.getUInt(keccak256(abi.encodePacked("ExpectedDeposits", depositHolder)));
      uint actualDeposits = s.getUInt(keccak256(abi.encodePacked("Lock", "deposit", depositHolder)));
      require(
        actualDeposits >= amount,
        "Withdrawn amount must not exceed the deposit"
      );
      // If taking this amount of AVT out will mean we don't have enough deposits
      // then block the withdrawl.
      if (actualDeposits - amount < expectedDeposits) {
          return true;
      }
      return false;
  }
}
