pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import '../interfaces/IERC20.sol';
import "./LAventusTime.sol";

// Library for adding functionality for handling AVT funds.
library LAVTManager  {
  bytes32 constant stakeFundHash = keccak256(abi.encodePacked("stake"));
  bytes32 constant depositFundHash = keccak256(abi.encodePacked("deposit"));
  bytes32 constant avtContractAddressKey = keccak256(abi.encodePacked("AVTERC20Instance"));
  bytes32 constant oneAVTInUSCentsKey = keccak256(abi.encodePacked("OneAVTInUSCents"));
  bytes32 constant totalAVTFundsKey = keccak256(abi.encodePacked("TotalAVTFunds"));

  /// See IAVTManager interface for events description
  event LogWithdraw(address indexed sender, string fund, uint amount);
  event LogDeposit(address indexed sender, string fund, uint amount);

  function decreaseFund(IAventusStorage _storage, address _fromAddress, string _fund, uint _amount) public {
    bytes32 key = keccak256(abi.encodePacked("AVTFund", _fromAddress, _fund));
    uint currDeposit = _storage.getUInt(key);
    require (
      _amount <= currDeposit,
      "Amount taken must be less than current deposit"
    );
    _storage.setUInt(key, currDeposit - _amount);
  }

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

    decreaseFund(_storage, msg.sender, _fund, _amount);

    IERC20 avt = IERC20(_storage.getAddress(avtContractAddressKey));
    require (
      avt.transfer(msg.sender, _amount),
      "Transfer of funds in withdraw must succeed before continuing"
    );

    updateBalance(_storage, _amount, false);
    emit LogWithdraw(msg.sender, _fund, _amount);
  }

  function increaseFund(IAventusStorage _storage,  address _toAddress, string _fund, uint _amount) public {
    bytes32 key = keccak256(abi.encodePacked("AVTFund", _toAddress, _fund));
    uint currDeposit = _storage.getUInt(key);
    require (
      _amount != 0,
      "Added amount must be greater than zero"
    );
    _storage.setUInt(key, currDeposit + _amount);
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

    increaseFund(_storage, msg.sender, _fund, _amount);

    IERC20 avt = IERC20(_storage.getAddress(avtContractAddressKey));
    require (
      avt.transferFrom(msg.sender, this, _amount),
      "Transfer of funds in 'deposit' must succeed before continuing"
    );

    updateBalance(_storage, _amount, true);
    emit LogDeposit(msg.sender, _fund, _amount);
  }

  function transfer(IAventusStorage _storage, string _fund, uint _amount, address _toAddress, string _toFund) external {
    if (keccak256(abi.encodePacked(_fund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, msg.sender),
        "A blocked stake cannot be transferred"
      );
    } else {
      require(
        keccak256(abi.encodePacked(_fund)) == depositFundHash,
        "checkedTransfer must be called for 'stake' or 'deposit' only"
      );
      require(
        !depositWithdrawlIsBlocked(_storage, _amount, msg.sender),
        "A blocked deposit cannot be transferred"
      );
    }

    if (keccak256(abi.encodePacked(_toFund)) == stakeFundHash) {
      require (
        !stakeChangeIsBlocked(_storage, _toAddress),
        "A blocked stake cannot receive transfers"
      );
    }

    doTransfer(_storage, _amount, msg.sender, _fund, _toAddress, _toFund);
  }

  // See IAVTManager.getBalance for details.
  function getBalance(IAventusStorage _storage, address _avtHolder, string _fund)
    external
    view
    returns (uint balance_)
  {
    balance_ = _storage.getUInt(keccak256(abi.encodePacked("AVTFund", _avtHolder, _fund)));
  }

  function getAVTDecimals(IAventusStorage _storage, uint _usCents) external view returns (uint avtDecimals_) {
    uint oneAvtInUsCents = _storage.getUInt(oneAVTInUSCentsKey);
    avtDecimals_ = (_usCents * (10**18)) / oneAvtInUsCents;
  }

  // NOTE: This version has NO CHECKS on whether the transfer should be blocked so should only be
  // used internally. Consider transfer() instead.
  function doTransfer(IAventusStorage _storage, uint _amount, address _fromAddress, string _fromFund, address _toAddress, string _toFund) private {
    require (
      _amount != 0,
      "The amount of a transfer must be positive"
    );

    // Take AVT from the "from" fund...
    bytes32 fromKey = keccak256(abi.encodePacked("AVTFund", _fromAddress, _fromFund));
    uint currentFromBalance = _storage.getUInt(fromKey);
    require(
      currentFromBalance >= _amount,
      "The transfer amount must not exceed the source fund balance"
    );
    _storage.setUInt(fromKey, currentFromBalance - _amount);

    // ...and give it to the "to" _fund.
    bytes32 toKey = keccak256(abi.encodePacked("AVTFund", _toAddress, _toFund));
    _storage.setUInt(toKey, _storage.getUInt(toKey) + _amount);
  }

  /**
  * Keep track of the total AVT funds in the contract.
  * @param _storage Storage contract
  * @param _amount amount to update the balance by
  * @param _increment True if incrementing balance
  */
  function updateBalance(IAventusStorage _storage, uint _amount, bool _increment) private {
    uint balance = _storage.getUInt(totalAVTFundsKey);

    if (_increment)
      balance += _amount;
    else
      balance -= _amount;

    _storage.setUInt(totalAVTFundsKey, balance);
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
      uint actualDeposits = _storage.getUInt(keccak256(abi.encodePacked("AVTFund", _depositHolder, "deposit")));
      require(
        actualDeposits >= _amount,
        "Withdrawn amount must not exceed the deposit"
      );
      // If taking this amount of AVT out will mean we don't have enough deposits
      // then block the withdrawl.
      blocked_ = actualDeposits - _amount < expectedDeposits;
  }
}
