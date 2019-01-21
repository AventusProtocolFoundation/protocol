pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsEvents.sol";
import "./LEventsRoles.sol";
import "./LEventsTickets.sol";
import "./LMerkleRoots.sol";
import "./LEventsStorage.sol";
import "./zeppelin/LECRecovery.sol";

/* @dev All external methods in here are called from EventsManager and have the same function signature (and interface
 * documentation) as their namesakes in EventsManager. Each of these methods should do the following and ONLY the following:
 *   - check that the event is in the correct state
 *   - call the method of the same name in a sublibrary to actually make the required change
 *   - emit the correct log
 * In particular, the methods SHOULD NOT check proofs or msg.sender validity - these checks should be done in the sublibrary.
 */

library LEvents {

  enum EventState {NonExistent, Trading, Inactive}

  // See IEventsManager interface for logs description
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, uint offSaleTime);
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      address indexed buyer);
  event LogTicketCancelled(uint indexed eventId, uint indexed ticketId, bytes vendorProof);
  event LogTicketResold(uint indexed eventId, uint indexed ticketId, bytes resellerProof, bytes doorData,
      address indexed newBuyer);
  event LogTicketListed(uint indexed eventId, uint ticketId, address indexed ticketOwner, bytes32 indexed leafHash);
  event LogRoleRegisteredOnEvent(uint indexed eventId, address indexed roleAddress, string role);

  modifier onlyWhenTrading(IAventusStorage _storage, uint _eventId) {
    require(EventState.Trading == getEventState(_storage, _eventId), "Event must be trading");
    _;
  }

  modifier onlyWhenExistent(IAventusStorage _storage, uint _eventId) {
    require(EventState.NonExistent != getEventState(_storage, _eventId), "Event must exist");
    _;
  }

  function createEvent(IAventusStorage _storage, string calldata _eventDesc, uint _eventTime, uint _offSaleTime,
      bytes calldata _createEventOwnerProof)
    external
  {
    (address eventOwner, uint eventId) = LEventsEvents.createEvent(_storage, _eventDesc, _eventTime, _offSaleTime,
        _createEventOwnerProof);
    emit LogEventCreated(eventId, eventOwner, _eventDesc, _offSaleTime);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      string calldata _ticketMetadata, address _buyer)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    uint ticketId = LEventsTickets.sellTicket(_storage, _eventId, _vendorTicketRefHash, _buyer);
    emit LogTicketSold(_eventId, ticketId, _vendorTicketRefHash, _ticketMetadata, _buyer);
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _cancelTicketVendorProof)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.cancelTicket(_storage, _eventId, _ticketId, _cancelTicketVendorProof);
    emit LogTicketCancelled(_eventId, _ticketId, _cancelTicketVendorProof);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _resellTicketTicketOwnerProof,
      address _newBuyer, bytes calldata _resellTicketResellerProof, bytes calldata _doorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.resellTicket(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof, _newBuyer,
        _resellTicketResellerProof);
    emit LogTicketResold(_eventId, _ticketId, _resellTicketResellerProof, _doorData, _newBuyer);
  }

  function listTicketA(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata,
      bytes calldata _listTicketVendorProof, bytes calldata _doorData, bytes calldata _listTicketTicketOwnerProof)
    external
  {
    // Leaf hash and owner are stored temporarily to enable listTicketA/B/C split.
    address ticketOwner = LECRecovery.recover(_vendorTicketRefHash, _listTicketTicketOwnerProof);
    bytes32 leafHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _ticketMetadata, ticketOwner,
        _listTicketVendorProof, _doorData));
    LEventsStorage.setTemporaryLeafHashAndOwner(_storage, _eventId, _vendorTicketRefHash, leafHash, ticketOwner);
  }

  function listTicketB(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, bytes32[] calldata _merklePath)
    external
    view
    onlyWhenTrading(_storage, _eventId)
  {
    bytes32 leafHash = LEventsStorage.getLeafHash(_storage, _eventId, _vendorTicketRefHash);
    bytes32 rootHash = LMerkleRoots.generateMerkleRoot(_storage, _merklePath, leafHash);
    require(LMerkleRoots.merkleRootIsActive(_storage, rootHash), "Merkle root is not active");
  }

  function listTicketC(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      bytes calldata _listTicketVendorProof)
    external
  {
    bytes32 leafHash = LEventsStorage.getLeafHash(_storage, _eventId, _vendorTicketRefHash);
    address ticketOwner = LEventsStorage.getLeafHashOwner(_storage, leafHash);
    uint ticketId = LEventsTickets.listTicket(_storage, _eventId, _vendorTicketRefHash, ticketOwner, _listTicketVendorProof);
    emit LogTicketListed(_eventId, ticketId, ticketOwner, leafHash);

    LEventsStorage.clearTemporaryLeafHashAndOwner(_storage, _eventId, _vendorTicketRefHash);
  }

  function registerRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role)
    external
    onlyWhenExistent(_storage, _eventId)
  {
    LEventsRoles.registerRoleOnEvent(_storage, _eventId, _roleAddress, _role);
    emit LogRoleRegisteredOnEvent(_eventId, _roleAddress, _role);
  }

  function getEventState(IAventusStorage _storage, uint _eventId) private view returns (EventState) {
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    if (eventOwner == address(0)) return EventState.NonExistent;

    uint currentTime = LAventusTime.getCurrentTime(_storage);
    if (currentTime >= LEventsStorage.getOffSaleTime(_storage, _eventId)) return EventState.Inactive;

    return EventState.Trading;
  }
}