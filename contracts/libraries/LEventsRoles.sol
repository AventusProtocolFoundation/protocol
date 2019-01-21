pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LEventsStorage.sol";

library LEventsRoles {
  bytes32 constant validatorHash = keccak256(abi.encodePacked("Validator"));
  bytes32 constant primaryHash = keccak256(abi.encodePacked("Primary"));
  bytes32 constant secondaryHash = keccak256(abi.encodePacked("Secondary"));

  modifier onlyEventOwner(IAventusStorage _storage, uint _eventId) {
    require(isEventOwner(_storage, _eventId, msg.sender), "Function must be called by owner");
    _;
  }

  modifier onlyValidEventRole(IAventusStorage _storage, string memory _role) {
    require(isValidEventRole(_role), "Role must be Primary, Secondary or Validator");
    _;
  }

  function registerRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role)
    external
    onlyEventOwner(_storage, _eventId)
    onlyValidEventRole(_storage, _role)
  {
    require(!LEventsStorage.isRoleOnEvent(_storage, _eventId, _roleAddress, _role), "Role is already registered on event");
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

  function isValidatorOrVendorOnEvent(IAventusStorage _storage, uint _eventId, address _address)
    external
    view
    returns (bool valid_)
  {
    bool validatorOnEvent = LEventsStorage.isRoleOnEvent(_storage, _eventId, _address, "Validator");
    bool vendorOnEvent = isTraderOnEvent(_storage, _eventId, _address, "Primary");
    valid_ = validatorOnEvent || vendorOnEvent;
  }

  function isValidatorOrResellerOnEvent(IAventusStorage _storage, uint _eventId, address _address)
    external
    view
    returns (bool valid_)
  {
    bool validatorOnEvent = LEventsStorage.isRoleOnEvent(_storage, _eventId, _address, "Validator");
    bool resellerOnEvent = isTraderOnEvent(_storage, _eventId, _address, "Secondary");
    valid_ = validatorOnEvent || resellerOnEvent;
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

  function isValidEventRole(string memory _role)
    private
    pure
    returns (bool valid_)
  {
    bytes32 roleHash = keccak256(abi.encodePacked(_role));
    valid_ = roleHash == validatorHash || roleHash == primaryHash || roleHash == secondaryHash;
  }

  function isEventOwner(IAventusStorage _storage, uint _eventId, address _owner)
    private
    view
    returns (bool valid_)
  {
    valid_ = _owner == LEventsStorage.getEventOwner(_storage, _eventId);
  }
}