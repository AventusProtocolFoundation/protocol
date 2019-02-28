pragma solidity ^0.5.2;

import "../interfaces/IAventusStorage.sol";
import "./LAventusTime.sol";
import "./LEventsEvents.sol";
import "./LEventsRoles.sol";
import "./LEventsTickets.sol";
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
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, uint eventTime, uint offSaleTime);
  event LogEventTakenOffSale(uint indexed eventId);
  event LogEventRoleRegistered(uint indexed eventId, address indexed roleAddress, string role);
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      address indexed buyer);
  event LogTicketCancelled(uint indexed eventId, uint indexed ticketId);
  event LogTicketResold(uint indexed eventId, uint indexed ticketId, address indexed newBuyer);

  modifier onlyWhenTrading(IAventusStorage _storage, uint _eventId) {
    require(EventState.Trading == getEventState(_storage, _eventId), "Event must be trading");
    _;
  }

  modifier onlyWhenExistent(IAventusStorage _storage, uint _eventId) {
    require(EventState.NonExistent != getEventState(_storage, _eventId), "Event must exist");
    _;
  }

  function createEvent(IAventusStorage _storage, string calldata _eventDesc, uint _eventTime, uint _offSaleTime,
      bytes calldata _createEventOwnerProof, address _eventOwner)
    external
  {
    (uint eventId, bool validatorRegisteredOnEvent) = LEventsEvents.createEvent(_storage, _eventDesc, _eventTime, _offSaleTime,
        _createEventOwnerProof, _eventOwner);
    emit LogEventCreated(eventId, _eventOwner, _eventDesc, _eventTime, _offSaleTime);
    if (validatorRegisteredOnEvent) {
      emit LogEventRoleRegistered(eventId, msg.sender, "Validator");
    }
  }

  function takeEventOffSale(IAventusStorage _storage, uint _eventId, bytes calldata _eventOwnerProof)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsEvents.takeEventOffSale(_storage, _eventId, _eventOwnerProof);
    emit LogEventTakenOffSale(_eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      string calldata _ticketMetadata, address _buyer)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    uint ticketId = LEventsTickets.sellTicket(_storage, _eventId, _vendorTicketRefHash, _buyer);
    emit LogTicketSold(_eventId, ticketId, _vendorTicketRefHash, _ticketMetadata, _buyer);
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.cancelTicket(_storage, _eventId, _ticketId);
    emit LogTicketCancelled(_eventId, _ticketId);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes calldata _resellTicketTicketOwnerProof,
      address _newBuyer)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.resellTicket(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof, _newBuyer);
    emit LogTicketResold(_eventId, _ticketId, _newBuyer);
  }

  function registerRoleOnEvent(IAventusStorage _storage, uint _eventId, address _roleAddress, string calldata _role,
      bytes calldata _registerRoleEventOwnerProof)
    external
    onlyWhenExistent(_storage, _eventId)
  {
    LEventsRoles.registerRoleOnEvent(_storage, _eventId, _roleAddress, _role, _registerRoleEventOwnerProof);
    emit LogEventRoleRegistered(_eventId, _roleAddress, _role);
  }

  function getEventState(IAventusStorage _storage, uint _eventId)
    private
    view
    returns (EventState)
  {
    address eventOwner = LEventsStorage.getEventOwner(_storage, _eventId);
    if (eventOwner == address(0)) return EventState.NonExistent;

    uint currentTime = LAventusTime.getCurrentTime(_storage);
    if (currentTime >= LEventsStorage.getOffSaleTime(_storage, _eventId)) return EventState.Inactive;

    return EventState.Trading;
  }
}
