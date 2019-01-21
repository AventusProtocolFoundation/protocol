pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";

library LAVTStorage {
  string constant avtSchema = "AVT";
  string constant avtFundSchema = "AVTFund";

  // TODO: Callers should get Voting data from LProposals instead.
  string constant votingSchema = "Voting";

  function getFundBalance(IAventusStorage _storage, address _avtHolder, string calldata _fund)
    external
    view
    returns (uint balance_)
  {
    balance_ = _storage.getUInt(keccak256(abi.encodePacked(avtFundSchema, _avtHolder, _fund)));
  }

  function decreaseFund(IAventusStorage _storage, address _account, string calldata _fund, uint _amount) external {
    bytes32 key = keccak256(abi.encodePacked(avtFundSchema, _account, _fund));
    uint currDeposit = _storage.getUInt(key);
    require(_amount <= currDeposit, "Amount taken must be less than current deposit");
    _storage.setUInt(key, currDeposit - _amount);
  }

  function increaseFund(IAventusStorage _storage,  address _account, string calldata _fund, uint _amount) external {
    bytes32 key = keccak256(abi.encodePacked(avtFundSchema, _account, _fund));
    uint currDeposit = _storage.getUInt(key);
    require(_amount != 0, "Added amount must be greater than zero");
    _storage.setUInt(key, currDeposit + _amount);
  }

  function getExpectedDeposits(IAventusStorage _storage, address _depositHolder)
    external
    view
    returns (uint expectedDeposits_)
  {
    expectedDeposits_ = _storage.getUInt(keccak256(abi.encodePacked(avtSchema, "ExpectedDeposits", _depositHolder)));
  }

  function setExpectedDeposits(IAventusStorage _storage, address _depositHolder, uint _expectedDeposits) external {
    _storage.setUInt(keccak256(abi.encodePacked(avtSchema, "ExpectedDeposits", _depositHolder)), _expectedDeposits);
  }

  function getStakeUnblockTime(IAventusStorage _storage, address _stakeHolder)
    external
    view
    returns (uint unblockTime_)
  {
    unblockTime_ = _storage.getUInt(keccak256(abi.encodePacked(votingSchema, _stakeHolder, uint(0), "nextTime")));
  }

}