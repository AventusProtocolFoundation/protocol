pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LAVTStorage.sol";

// Library for adding functionality for handling AVT funds.
library LAVTManager  {
  bytes32 constant stakeFundHash = keccak256(abi.encodePacked("stake"));
  bytes32 constant depositFundHash = keccak256(abi.encodePacked("deposit"));

  // See IAVTManager interface for logs description
  event LogAVTWithdrawn(address indexed sender, string fund, uint amount);
  event LogAVTDeposited(address indexed sender, string fund, uint amount);

  function withdraw(IAventusStorage _storage, string _fund, uint _amount)
    external
  {
    if (keccak256(abi.encodePacked(_fund)) == stakeFundHash) {
      require(!stakeChangeIsBlocked(_storage, msg.sender), "A blocked stake cannot be withdrawn");
    } else {
      require(keccak256(abi.encodePacked(_fund)) == depositFundHash, "Withdraw must be called for stake or deposit fund only");
      require(!depositWithdrawlIsBlocked(_storage, _amount, msg.sender), "A blocked deposit cannot be withdrawn");
    }

    decreaseFund(_storage, msg.sender, _fund, _amount);
    _storage.transferAVTTo(msg.sender, _amount);
    emit LogAVTWithdrawn(msg.sender, _fund, _amount);
  }

  function deposit(IAventusStorage _storage, string _fund, uint _amount)
    external
  {
    if (keccak256(abi.encodePacked(_fund)) == stakeFundHash) {
      require(!stakeChangeIsBlocked(_storage, msg.sender), "It is not possible to deposit into a blocked stake");
    } else {
      require(keccak256(abi.encodePacked(_fund)) == depositFundHash, "Deposit must be called for stake or deposit fund only");
    }

    increaseFund(_storage, msg.sender, _fund, _amount);
    _storage.transferAVTFrom(msg.sender, _amount);
    emit LogAVTDeposited(msg.sender, _fund, _amount);
  }

  function transfer(IAventusStorage _storage, string _fromFund, uint _amount, address _toAddress, string _toFund) external {
    if (keccak256(abi.encodePacked(_fromFund)) == stakeFundHash) {
      require(!stakeChangeIsBlocked(_storage, msg.sender), "A blocked stake cannot be transferred");
    } else {
      require(keccak256(abi.encodePacked(_fromFund)) == depositFundHash, "Transfer must be from stake or deposit fund only");
      require(!depositWithdrawlIsBlocked(_storage, _amount, msg.sender), "A blocked deposit cannot be transferred"
      );
    }

    if (keccak256(abi.encodePacked(_toFund)) == stakeFundHash) {
      require(!stakeChangeIsBlocked(_storage, _toAddress), "A blocked stake cannot receive transfers");
    } else {
      require(keccak256(abi.encodePacked(_toFund)) == depositFundHash, "Transfer must be to stake or deposit fund only");
    }

    doTransfer(_storage, _amount, msg.sender, _fromFund, _toAddress, _toFund);
  }

  function lockDeposit(IAventusStorage _storage, address _depositHolder, uint _deposit) external {
    uint expectedDeposits = LAVTStorage.getExpectedDeposits(_storage, _depositHolder) + _deposit;
    uint actualDeposits = LAVTStorage.getFundBalance(_storage, _depositHolder, "deposit");

    require(actualDeposits >= expectedDeposits, "Insufficient deposits");

    LAVTStorage.setExpectedDeposits(_storage, _depositHolder, expectedDeposits);
  }

  function unlockDeposit(IAventusStorage _storage, address _depositHolder, uint _deposit) external {
    assert(_deposit != 0);
    uint expectedDeposits = LAVTStorage.getExpectedDeposits(_storage, _depositHolder);
    assert(expectedDeposits >= _deposit);
    LAVTStorage.setExpectedDeposits(_storage, _depositHolder, expectedDeposits - _deposit);
  }

  function getAVTDecimals(IAventusStorage _storage, uint _usCents) external view returns (uint avtDecimals_) {
    uint oneAvtInUSCents = LAVTStorage.getOneAVTInUSCents(_storage);
    avtDecimals_ = (_usCents * (10**18)) / oneAvtInUSCents;
  }

  function getBalance(IAventusStorage _storage, address _avtHolder, string _fund)
    public
    view
    returns (uint balance_)
  {
    bool validFund = keccak256(abi.encodePacked(_fund)) == depositFundHash ||
        keccak256(abi.encodePacked(_fund)) == stakeFundHash;
    require(validFund, "Can only get balance of stake or deposit fund");
    balance_ = LAVTStorage.getFundBalance(_storage, _avtHolder, _fund);
  }

  function decreaseFund(IAventusStorage _storage, address _account, string _fund, uint _amount) public {
    LAVTStorage.decreaseFund(_storage, _account, _fund, _amount);
  }

  function increaseFund(IAventusStorage _storage,  address _account, string _fund, uint _amount) public {
    LAVTStorage.increaseFund(_storage, _account, _fund, _amount);
  }

  // NOTE: This version has NO CHECKS on whether the transfer should be blocked so should only be
  // used internally. Consider transfer() instead.
  function doTransfer(IAventusStorage _storage, uint _amount, address _fromAddress, string _fromFund, address _toAddress,
      string _toFund)
    private
  {
    require(_amount != 0, "The amount of a transfer must be positive");

    // Take AVT from the "from" fund...
    decreaseFund(_storage, _fromAddress, _fromFund, _amount);

    // ...and give it to the "to" _fund.
    increaseFund(_storage, _toAddress, _toFund, _amount);
  }

  function stakeChangeIsBlocked(IAventusStorage _storage, address _stakeHolder)
    private
    view
    returns (bool blocked_)
  {
    uint blockedUntil = LAVTStorage.getStakeUnblockTime(_storage, _stakeHolder);

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
      uint expectedDeposits = LAVTStorage.getExpectedDeposits(_storage, _depositHolder);
      uint actualDeposits = getBalance(_storage, _depositHolder, "deposit");
      require(actualDeposits >= _amount, "Withdrawn amount must not exceed the deposit");
      // If taking this amount of AVT out will mean we don't have enough deposits
      // then block the withdrawl.
      blocked_ = actualDeposits - _amount < expectedDeposits;
  }
}