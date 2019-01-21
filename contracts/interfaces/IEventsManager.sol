pragma solidity ^0.5.2;

interface IEventsManager {

  /**
   * @notice Event emitted for a createEvent transaction.
   */
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, uint offSaleTime);

  /**
   * @notice Event emitted for a sellTicket transaction.
   */
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      address indexed buyer);

  /**
   * @notice Event emitted for a resellTicket transaction.
   */
  event LogTicketResold(uint indexed eventId, uint indexed ticketId, bytes resellerProof, bytes doorData,
      address indexed newBuyer);

  /**
   * @notice Event emitted for a cancelTicket transaction.
   */
  event LogTicketCancelled(uint indexed eventId, uint indexed ticketId, bytes vendorProof);

  /**
   * @notice Event emitted for a listTicket transaction.
   */
  event LogTicketListed(uint indexed eventId, uint ticketId, address indexed ticketOwner, bytes32 indexed leafHash);

  /**
   * @notice Event emitted for a registerRoleOnEvent transaction.
   */
  event LogRoleRegisteredOnEvent(uint indexed eventId, address indexed roleAddress, string role);

  /**
   * @notice Create an event
   * @param _eventDesc Description of the event
   * @param _offSaleTime The end timestamp for ticket sales
   * @param _ownerProof The event details signed by the owner
   */
  function createEvent(string calldata _eventDesc, uint _offSaleTime, bytes calldata _ownerProof) external;

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
   * @param _vendorProof signed proof from the event owner/primary if cancelling via a validator
   */
  function cancelTicket(uint _eventId, uint _ticketId, bytes calldata _vendorProof) external;

  /**
   * @notice Register a member for an event
   * @param _eventId ID of the event
   * @param _roleAddress address associated with the role
   * @param _role must be either "Primary", "Secondary" or "Validator"
   */
   // TODO: Add a proof to allow validator to add roles.
   // TODO: Remove support for adding a validator this way.
  function registerRoleOnEvent(uint _eventId, address _roleAddress, string calldata _role) external;

  /**
   * @notice Sell a ticket on the secondary market.
   * @param _eventId ID of the event
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _ticketOwnerPermission signed by the owner
   * @param _newBuyer address of the new buyer of the ticket.
   * @param _resellerProof the details signed by the reseller
   * @param _doorData the credentials necessary to be authenticated at the event's entrance (can be empty bytes)
   */
  function resellTicket(uint _eventId, uint _ticketId, bytes calldata _ticketOwnerPermission, address _newBuyer,
      bytes calldata _resellerProof, bytes calldata _doorData) external;

  /**
   * @notice List a ticket for resale on the protocol which was originally a merkle tree sale.
   * @param _eventId ID of the event
   * @param _vendorTicketRefHash hash of vendor-generated (event owner or primary) unique ticket reference for the event
   * @param _ticketMetadata ticket details as stored in the merkle tree
   * @param _vendorProof the vendor (event owner or primary) signed details from the original sale
   * @param _doorData the credentials necessary to be authenticated at the event's entrance (can be empty bytes)
   * @param _ticketOwnerProof vendorTicketRefHash signed by the ticket owner
   * @param _merklePath sibling hash path of the merkle tree
   */
  function listTicket(uint _eventId, bytes32 _vendorTicketRefHash, string calldata _ticketMetadata,
      bytes calldata _vendorProof, bytes calldata _doorData, bytes calldata _ticketOwnerProof, bytes32[] calldata _merklePath)
    external;
}