pragma solidity ^0.5.2;

interface IEventsManager {

  /**
   * @notice Event emitted for a createEvent transaction.
   */
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, uint eventTime, uint offSaleTime);

  /**
  * @notice Event emitted when an event is taken off sale.
  */
  event LogEventTakenOffSale(uint indexed eventId);

  /**
   * @notice Event emitted for a registerRoleOnEvent transaction.
   */
  event LogEventRoleRegistered(uint indexed eventId, address indexed roleAddress, string role);

  /**
   * @notice Event emitted for a sellTicket transaction.
   */
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      address indexed buyer);

  /**
   * @notice Event emitted for a resellTicket transaction.
   */
  event LogTicketResold(uint indexed eventId, uint indexed ticketId, address indexed newBuyer);

  /**
   * @notice Event emitted for a cancelTicket transaction.
   */
  event LogTicketCancelled(uint indexed eventId, uint indexed ticketId);

  /**
   * @notice Create an event
   * @param _eventDesc Description of the event
   * @param _eventTime Timestamp indicating when tickets for an event expire
   * @param _offSaleTime The end timestamp for ticket sales
   * @param _ownerProof The event details signed by the owner
   * @param _eventOwner The event owner
   */
  function createEvent(string calldata _eventDesc, uint _eventTime, uint _offSaleTime, bytes calldata _ownerProof,
      address _eventOwner) external;

  /**
   * @notice Take event off sale in order to disable ticket sales/resales
   * @param _eventId ID of the event
   * @param _eventOwnerProof signed proof from the event owner
   */
  function takeEventOffSale(uint _eventId, bytes calldata _eventOwnerProof) external;

  /**
   * @notice Sell ticket on behalf of a signer to a buyer specified by the signer
   * @param _eventId event id for the event to end
   * @param _vendorTicketRefHash hash of the vendor (event owner or primary) generated unique ticket reference for the event
   * @param _ticketMetadata ticket details
   * @param _buyer address of the ticket buyer (can be empty address)
   */
  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata, address _buyer) external;

  /**
   * @notice Cancel ticket and transfer ownership to event owner
   * @param _eventId event id for the event in context
   * @param _ticketId ticket Id for the ticket to be cancelled
   */
  function cancelTicket(uint _eventId, uint _ticketId) external;

  /**
   * @notice Register a member for an event
   * @param _eventId ID of the event
   * @param _roleAddress address associated with the role
   * @param _role must be either "Primary" or "Secondary"
   * @param _registerRoleEventOwnerProof signed proof from the event owner for registering a role
   */
  function registerRoleOnEvent(uint _eventId, address _roleAddress, string calldata _role,
      bytes calldata _registerRoleEventOwnerProof) external;

  /**
   * @notice Sell a ticket on the secondary market.
   * @param _eventId ID of the event
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _ticketOwnerPermission signed by the owner
   * @param _newBuyer address of the new buyer of the ticket.
   */
  function resellTicket(uint _eventId, uint _ticketId, bytes calldata _ticketOwnerPermission, address _newBuyer) external;
}
