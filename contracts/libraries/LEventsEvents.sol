pragma solidity ^0.5.2;

import "./LEventsStorage.sol";
import "./LValidators.sol";
import "./zeppelin/LECRecovery.sol";

library LEventsEvents {

  modifier onlyWithEventDescription(IAventusStorage _storage, string memory _eventDesc) {
    require(bytes(_eventDesc).length != 0, "Event requires a non-empty description");
    _;
  }

  struct RuleSet {
    uint transactionType;
    bytes rules;
  }

  function createEvent(IAventusStorage _storage, string calldata _eventDesc, bytes32 _eventRef, uint _eventTime,
      bytes calldata _createEventEventOwnerProof, address _eventOwner, bytes calldata _rules)
    external
    onlyWithEventDescription(_storage, _eventDesc)
    returns (uint eventId_, bool registerValidatorOnEvent_)
  {
    eventId_ = getEventId(_eventRef, _eventOwner);
    registerValidatorOnEvent_ = doCreateEventViaValidatorChecks(_storage, _eventDesc, _eventTime, _createEventEventOwnerProof,
        _eventOwner, _rules, eventId_);

    LEventsStorage.setEventOwner(_storage, eventId_, _eventOwner);
    LEventsStorage.setEventTime(_storage, eventId_, _eventTime);
    checkAndSetEventRules(_storage, eventId_, _rules);
  }

  function getEventTime(IAventusStorage _storage, uint _eventId)
    external
    view
    returns (uint eventTime_)
  {
    eventTime_ = LEventsStorage.getEventTime(_storage, _eventId);
  }

  function getTransactionRules(IAventusStorage _storage, uint _eventId, uint _transactionType)
    external
    view
    returns (bytes memory rules_)
  {
    rules_ = LEventsStorage.getTransactionRules(_storage, _eventId, _transactionType);
  }

  function getEventOwner(IAventusStorage _storage, uint _eventId)
    public
    view
    returns (address eventOwner_)
  {
    eventOwner_ = LEventsStorage.getEventOwner(_storage, _eventId);
  }

  function isEventOwner(IAventusStorage _storage, uint _eventId, address _owner)
    public
    view
    returns (bool valid_)
  {
    valid_ = _owner == getEventOwner(_storage, _eventId);
  }

  function checkAndSetEventRules(IAventusStorage _storage, uint _eventId, bytes memory _ruleSets)
    private
  {
    if (_ruleSets.length == 0) {
      return;
    }

    (bytes memory firstRuleSet, bytes memory otherRuleSets) = abi.decode(_ruleSets, (bytes, bytes));
    RuleSet memory ruleSet;
    (ruleSet.transactionType, ruleSet.rules) = abi.decode(firstRuleSet, (uint, bytes));

    LEventsStorage.setTransactionRules(_storage, _eventId, ruleSet.transactionType, ruleSet.rules);

    checkAndSetEventRules(_storage, _eventId, otherRuleSets);
  }

  // Separate method due to stack-too-deep.
  function doCreateEventViaValidatorChecks(IAventusStorage _storage, string memory _eventDesc, uint _eventTime,
      bytes memory _createEventEventOwnerProof, address _eventOwner, bytes memory _rules, uint _eventId)
    private
    returns (bool registerValidatorOnEvent_)
  {
    bytes32 descHash = keccak256(abi.encodePacked(_eventDesc));
    bytes32 eventHash = keccak256(abi.encodePacked(descHash, _eventTime, _rules, msg.sender));
    address signer = LECRecovery.recover(eventHash, _createEventEventOwnerProof);
    require(signer == _eventOwner, "Creation proof must be valid and signed by event owner");

    registerValidatorOnEvent_ = msg.sender != _eventOwner;

    if (registerValidatorOnEvent_) {
      LValidators.ensureValidatorIsRegistered(_storage);
      LEventsStorage.setRoleOnEvent(_storage, _eventId, msg.sender, "Validator");
    }
  }

  function getEventId(bytes32 _eventRef, address _eventOwner)
    private
    pure
    returns (uint eventId_)
  {
    eventId_ = uint(keccak256(abi.encodePacked(_eventRef, _eventOwner)));
  }

}