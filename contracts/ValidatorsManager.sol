pragma solidity ^0.5.2;

import "./interfaces/IValidatorsManager.sol";
import "./interfaces/IAventusStorage.sol";
import "./libraries/LValidators.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract ValidatorsManager is IValidatorsManager, Owned, Versioned {

    IAventusStorage public s;
    bool public challengesOn;

    constructor(IAventusStorage _s, bool _challengesOn)
      public
    {
      s = _s;
      challengesOn = _challengesOn;
    }

    modifier onlyIfChallengesSwitchedOn {
      require(challengesOn, "Validator challenges are not currently supported");
      _;
    }

    function registerValidator(address _validatorAddress, string calldata _evidenceUrl, string calldata _desc)
      external
      onlyOwner
    {
      LValidators.registerValidator(s, _validatorAddress, _evidenceUrl, _desc);
    }

    function deregisterValidator(address _validatorAddress)
      external
      onlyOwner
    {
      LValidators.deregisterValidator(s, _validatorAddress);
    }

    function challengeValidator(address _validatorAddress)
      onlyIfChallengesSwitchedOn
      external
    {
      LValidators.challengeValidator(s, _validatorAddress);
    }

    function endValidatorChallenge(address _validatorAddress)
      external
    {
      LValidators.endValidatorChallenge(s, _validatorAddress);
    }

    function getNewValidatorDeposit()
      external
      view
      returns (uint validatorDepositInAVT_)
    {
      validatorDepositInAVT_ = LValidators.getNewValidatorDeposit(s);
    }

    function getExistingValidatorDeposit(address _validatorAddress)
      external
      view
      returns (uint validatorDepositInAVT_)
    {
      validatorDepositInAVT_ = LValidators.getExistingValidatorDeposit(s, _validatorAddress);
    }

    function validatorIsRegistered(address _validatorAddress)
      external
      view
      returns (bool isRegistered_)
    {
      isRegistered_ = LValidators.isRegistered(s, _validatorAddress);
    }

    function getDeregistrationTime(address _validatorAddress)
      external
      view
      returns (uint deregistrationTime_)
    {
      deregistrationTime_ = LValidators.getDeregistrationTime(s, _validatorAddress);
    }
}