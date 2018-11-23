pragma solidity ^0.4.24;

interface IEventsManager {

  /**
   * @notice Event emitted for a createEvent transaction.
   */
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, string eventSupportURL,
      uint onSaleTime, uint offSaleTime, uint averageTicketPriceInUSCents, uint depositInAVTDecimals);

  /**
   * @notice Event emitted for a endEvent transaction.
   */
  event LogEventEnded(uint indexed eventId);

  /**
   * @notice Event emitted for a cancelEvent transaction.
   */
  event LogEventCancelled(uint indexed eventId);

  /**
   * @notice Event emitted for a sellTicket transaction.
   */
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      bytes vendorProof, bytes doorData, address indexed buyer);

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
   * @notice Event emitted for a registerMemberOnEvent transaction.
   */
  event LogMemberRegisteredOnEvent(uint indexed eventId, address indexed memberAddress, string memberType);

  /**
   * @notice Event emitted for a deregisterMemberFromEvent transaction.
   */
  event LogMemberDeregisteredFromEvent(uint indexed eventId, address indexed memberAddress, string memberType);

  /**
   * @notice Create an event
   * @param _eventDesc Description of the event
   * @param _eventSupportURL Verifiable official supporting url for the event
   * @param _onSaleTime The start timestamp for ticket sales
   * @param _offSaleTime The end timestamp for ticket sales
   * @param _averageTicketPriceInUSCents Average ticket price in US Cents
   * @param _ownerProof The event details signed by the owner
   */
  function createEvent(string _eventDesc, string _eventSupportURL, uint _onSaleTime, uint _offSaleTime,
      uint _averageTicketPriceInUSCents, bytes _ownerProof) external;

  /**
   * @notice Cancel an event
   * @param _eventId Event id for the event to end
   * @param _ownerProof Proof from event owner
   */
  function cancelEvent(uint _eventId, bytes _ownerProof) external;

  /**
   * @notice Complete the process of event ending to balance the deposits
   * @param _eventId event id for the event to end
   */
  function endEvent(uint _eventId) external;

  /**
   * @notice Sell ticket on behalf of a signer to a buyer specified by the signer
   * @param _eventId event id for the event to end
   * @param _vendorTicketRefHash hash of the vendor (event owner or primary) generated unique ticket reference for the event
   * @param _ticketMetadata ticket details
   * @param _buyer address of the ticket buyer (can be empty address)
   * @param _vendorProof the details signed by the vendor
   * @param _doorData the credentials necessary to be authenticated at the event's entrance (can be empty bytes)
   */
  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, address _buyer, bytes _vendorProof,
      bytes _doorData) external;

  /**
   * @notice Cancel ticket and transfer ownership to event owner
   * @param _eventId event id for the event in context
   * @param _ticketId ticket Id for the ticket to be cancelled
   * @param _vendorProof signed proof from the event owner/primary if cancelling via a broker
   */
  function cancelTicket(uint _eventId, uint _ticketId, bytes _vendorProof) external;

  /**
   * @notice Register a member for an event
   * @param _eventId ID of the event
   * @param _memberAddress member address
   * @param _memberType must be a member type of either "Primary", "Secondary" or "Broker"
   */
  function registerMemberOnEvent(uint _eventId, address _memberAddress, string _memberType) external;

  /**
   * @notice Deregister a member from an event
   * @param _eventId ID of the event
   * @param _memberAddress member address
   * @param _memberType must be a member type of either "Primary", "Secondary" or "Broker"
   */
  function deregisterMemberFromEvent(uint _eventId, address _memberAddress, string _memberType) external;

  /**
   * @notice Sell a ticket on the secondary market.
   * @param _eventId ID of the event
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _ticketOwnerPermission signed by the owner
   * @param _newBuyer address of the new buyer of the ticket.
   * @param _resellerProof the details signed by the reseller
   * @param _doorData the credentials necessary to be authenticated at the event's entrance (can be empty bytes)
   */
  function resellTicket(uint _eventId, uint _ticketId, bytes _ticketOwnerPermission, address _newBuyer, bytes _resellerProof,
      bytes _doorData) external;

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
  function listTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, bytes _vendorProof,
    bytes _doorData, bytes _ticketOwnerProof, bytes32[] _merklePath) external;

  /**
   * @notice Calculate the appropriate event deposit In USCents and in AVT
   * @dev the parameter list WILL change when the deposit calculation is more mature
   * @param _averageTicketPriceInUSCents average ticket price in US Cents
   * @return depositInUSCents_ calculated deposit in US cents
   * @return depositInAVTDecimals_ calculated deposit in AVT Decimals
   */
  function getNewEventDeposit(uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVT_);

  /**
   * @notice Get the deposit that was made for the specified event
   * @param _eventId unique identifer for the event
   * @return eventDeposit_ the deposit that was made for the specified event
   */
  function getExistingEventDeposit(uint _eventId) external view returns(uint eventDeposit_);

}