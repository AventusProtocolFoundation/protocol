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
  function withdraw(IAventusStorage _storage, string _fund, uint _amount)
    external
  {
    if (keccak256(abi.encodePacked(_fund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, msg.sender),
        "A blocked stake cannot be withdrawn"
      );
    } else {
      require(
        keccak256(abi.encodePacked(_fund)) == depositFundHash,
        "withdraw must be called for 'stake' or 'deposit' only"
      );
      require(
        !depositWithdrawlIsBlocked(_storage, _amount, msg.sender),
        "A blocked deposit cannot be withdrawn"
      );
    }

    bytes32 key = keccak256(abi.encodePacked("Lock", _fund, msg.sender));
    uint currDeposit = _storage.getUInt(key);
    IERC20 avt = IERC20(_storage.getAddress(avtContractAddressKey));

    require (
      _amount <= currDeposit,
      "Withdrawn amount must be less than current deposit"
    );
    _storage.setUInt(key, currDeposit - _amount);
    require (
      avt.transfer(msg.sender, _amount),
      "Transfer of funds in withdraw must succeed before continuing"
    );

    updateBalance(_storage, _amount, false);
  }

  // See IAVTManager.deposit for details.
  function deposit(IAventusStorage _storage, string _fund, uint _amount)
    external
  {
    if (keccak256(abi.encodePacked(_fund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, msg.sender),
        "It is not possible to deposit into a blocked stake"
      );
    } else {
      require(
        keccak256(abi.encodePacked(_fund)) == depositFundHash,
        "deposit must be called for 'stake' or 'deposit' only"
      );
    }

    bytes32 key = keccak256(abi.encodePacked("Lock", _fund, msg.sender));
    uint currDeposit = _storage.getUInt(key);
    IERC20 avt = IERC20(_storage.getAddress(avtContractAddressKey));

    require (
      _amount != 0,
      "A deposit must be greater than zero"
    );
    _storage.setUInt(key, currDeposit + _amount);
    require (
      avt.transferFrom(msg.sender, this, _amount),
      "Transfer of funds in 'deposit' must succeed before continuing"
    );

    updateBalance(_storage, _amount, true);
  }

  function checkedTransfer(IAventusStorage _storage, uint _amount, address _fromAddress, string _fromFund, address _toAddress, string _toFund) external {
    if (keccak256(abi.encodePacked(_fromFund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, _fromAddress),
        "A blocked stake cannot be transferred"
      );
    } else {
      require(
        keccak256(abi.encodePacked(_fromFund)) == depositFundHash,
        "checkedTransfer must be called for 'stake' or 'deposit' only"
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

  // See IAVTManager.getBalance for details.
  function getBalance(IAventusStorage _storage, string _fund, address _avtHolder)
    external
    view
    returns (uint balance_)
  {
    balance_ = _storage.getUInt(keccak256(abi.encodePacked("Lock", _fund, _avtHolder)));
  }

  function getAVTDecimals(IAventusStorage _storage, uint _usCents) external view returns (uint avtDecimals_) {
    uint oneAvtInUsCents = _storage.getUInt(oneAVTInUSCentsKey);
    avtDecimals_ = (_usCents * (10**18)) / oneAvtInUsCents;
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
      "The transfer amount must not exceed the source fund balance"
    );
    _storage.setUInt(fromKey, currentFromBalance - _amount);

    // ...and give it to the "to" _fund.
    bytes32 toKey = keccak256(abi.encodePacked("Lock", _toFund, _toAddress));
    _storage.setUInt(toKey, _storage.getUInt(toKey) + _amount);
  }

  /**
  * Keep track of the total locked in the contract.
  * @param _storage Storage contract
  * @param _amount amount to update the balance by
  * @param _increment True if incrementing balance
  */
  function updateBalance(IAventusStorage _storage, uint _amount, bool _increment) private {
    uint balance = _storage.getUInt(lockBalanceKey);

    if (_increment)
      balance += _amount;
    else
      balance -= _amount;

    _storage.setUInt(lockBalanceKey, balance);
  }

  /**
  * Check if the sender can withdraw/deposit AVT stake.
  * @param _storage Storage contract
  * @return True if the sender's funds are blocked, False if not.
  */
  function stakeChangeIsBlocked(IAventusStorage _storage, address _stakeHolder)
    private
    view
    returns (bool blocked_)
  {
    uint blockedUntil = _storage.getUInt(keccak256(abi.encodePacked("Voting", _stakeHolder, uint(0), "nextTime")));

    if (blockedUntil == 0)
      blocked_ = false; // No unrevealed votes
    else if (LAventusTime.getCurrentTime(_storage) < blockedUntil)
      blocked_ = false; // Voting still ongoing
    else
      blocked_ = true; // Reveal period active (even if reveal is over tokens are blocked until reveal)
  }

  function depositWithdrawlIsBlocked(IAventusStorage _storage, uint _amount, address _depositHolder)
    private
    view
    returns (bool blocked_)
  {
      uint expectedDeposits = _storage.getUInt(keccak256(abi.encodePacked("ExpectedDeposits", _depositHolder)));
      uint actualDeposits = _storage.getUInt(keccak256(abi.encodePacked("Lock", "deposit", _depositHolder)));
      require(
        actualDeposits >= _amount,
        "Withdrawn amount must not exceed the deposit"
      );
      // If taking this amount of AVT out will mean we don't have enough deposits
      // then block the withdrawl.
      blocked_ = actualDeposits - _amount < expectedDeposits;
  }
}