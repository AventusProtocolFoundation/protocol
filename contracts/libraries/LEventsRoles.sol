pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LEventsStorage.sol";
import "./zeppelin/LECRecovery.sol";
import "./LMembers.sol";

library LEventsRoles {

  bytes32 constant primaryHash = keccak256(abi.encodePacked("Primary"));
  bytes32 constant secondaryHash = keccak256(abi.encodePacked("Secondary"));

  modifier onlyEventOwnerOrValidator(IAventusStorage _storage, uint _eventId) {
    mustBeValidatorOnEventOrEventOwner(_storage, _eventId, msg.sender);
    _;
  }

  modifier onlyRegistrableEventRole(IAventusStorage _storage, string memory _role) {
    require(isRegistrableEventRole(_role), string(abi.encodePacked("Role is not registrable: ", _role)));
    _;
  }

  function registerRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role,
      bytes calldata _registerRoleEventOwnerProof)
    external
    onlyEventOwnerOrValidator(_storage, _eventId)
    onlyRegistrableEventRole(_storage, _role)
  {
    require(!LEventsStorage.isRoleOnEvent(_storage, _eventId, _roleAddress, _role), "Role is already registered on event");
    bytes32 registerRoleHash = keccak256(abi.encodePacked(_eventId, _roleAddress, _role));
    address signer = LECRecovery.recover(registerRoleHash, _registerRoleEventOwnerProof);
    require(isEventOwner(_storage, _eventId, signer), "Registration proof must be valid and signed by event owner");

    if (msg.sender != signer) {
      LMembers.checkValidatorActive(_storage);
    }

    LEventsStorage.setRoleOnEvent(_storage, _eventId, _roleAddress, _role);
  }

  function isVendorOnEvent(IAventusStorage _storage, uint _eventId, address _address)
    external
    view
    returns (bool valid_)
  {
    valid_ = isTraderOnEvent(_storage, _eventId, _address, "Primary");
  }

  function isResellerOnEvent(IAventusStorage _storage, uint _eventId, address _address)
    external
    view
    returns (bool valid_)
  {
    valid_ = isTraderOnEvent(_storage, _eventId, _address, "Secondary");
  }

  function mustBeValidatorOnEventOrEventOwner(IAventusStorage _storage, uint _eventId, address _address)
    public
    view
  {
    bool validatorOnEvent = LEventsStorage.isRoleOnEvent(_storage, _eventId, _address, "Validator");
    bool eventOwner = isEventOwner(_storage, _eventId, _address);
    require(validatorOnEvent || eventOwner, "Sender must be owner or validator on event");
  }

  function isTraderOnEvent(IAventusStorage _storage, uint _eventId, address _address, string memory _role)
    public
    view
    returns (bool valid_)
  {
    bool eventOwner = isEventOwner(_storage, _eventId, _address);
    bool traderOnEvent = LEventsStorage.isRoleOnEvent(_storage, _eventId, _address, _role);
    valid_ = eventOwner || traderOnEvent;
  }

  // NOTE: Validator is NOT registrable as it must be set at event creation time.
  function isRegistrableEventRole(string memory _role)
    private
    pure
    returns (bool valid_)
  {
    bytes32 roleHash = keccak256(abi.encodePacked(_role));
    valid_ = roleHash == primaryHash || roleHash == secondaryHash;
  }

  function isEventOwner(IAventusStorage _storage, uint _eventId, address _owner)
    private
    view
    returns (bool valid_)
  {
    valid_ = _owner == LEventsStorage.getEventOwner(_storage, _eventId);
  }
}