pragma solidity ^0.4.24;

interface IEventsManager {

  /**
   * Event emitted for a createEvent transaction.
   */
  event LogEventCreated(uint indexed eventId, string eventDesc, string eventSupportURL, uint ticketSaleStartTime, uint eventTime, uint averageTicketPriceInUSCents, uint depositInAVTDecimals);

  /**
   * Event emitted for a unlockEventDeposit transaction.
   */
  event LogUnlockEventDeposit(uint indexed eventId);

  /**
   * Event emitted for a cancelEvent transaction.
   */
  event LogEventCancelled(uint indexed eventId);

  /**
   * Event emitted for a sellTicket transaction.
   */
  event LogTicketSale(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata, bytes sellerProof, bytes doorData, address indexed buyer);

  /**
   * Event emitted for a resellTicket transaction.
   */
  event LogTicketResale(uint indexed eventId, uint indexed ticketId, address indexed newBuyer, bytes sellerProof);

  /**
   * Event emitted for a refundTicket transaction.
   */
  event LogTicketRefund(uint indexed eventId, uint indexed ticketId, bytes vendorProof);

  /**
   * Event emitted for a registerRole transaction.
   */
  event LogRegisterRole(uint indexed eventId, string role, address indexed _address);

  /**
   * Event emitted for a deregisterRole transaction.
   */
  event LogDeregisterRole(uint indexed eventId, string role, address indexed _address);

  /**
   * Event emitted for a challengeEvent transaction.
   */
  event LogEventChallenged(uint indexed eventId, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * @notice Create an event
   * @param _eventDesc Description of the event
   * @param _eventSupportURL Verifiable official supporting url for the event
   * @param _ticketSaleStartTime The start timestamp for ticket sales
   * @param _eventTime The start timestamp of the event
   * @param _capacity Number of tickets (capacity) for the event
   * @param _averageTicketPriceInUSCents Average ticket price in US Cents
   * @param _ownerProof The event details signed by the owner (MUST be empty if not called via a broker)
   * @return eventId_ Unique identifier of newly created event
   */
  function createEvent(string _eventDesc, string _eventSupportURL, uint _ticketSaleStartTime, uint _eventTime, uint _capacity,
      uint _averageTicketPriceInUSCents, bytes _ownerProof)
    external
    returns (uint eventId_);

  /**
   * Cancel an event
   * @param _eventId Event id for the event to end
   * @param _ownerProof Proof from event owner when sent via a broker (must be blank if sent from event owner)
   */
  function cancelEvent(uint _eventId, bytes _ownerProof) external;

  /**
   * @dev Complete the process of event ending to balance the deposits
   * @param _eventId - event id for the event to end
   */
  function unlockEventDeposit(uint _eventId) external;

  /**
   * @dev Sell ticket on behalf of a signer to a buyer specified by the signer
   * @param _eventId - event id for the event to end
   * @param _vendorTicketRefHash - hash of the vendor (event owner or primary delegate) generated unique ticket reference for the event
   * @param _ticketMetadata - ticket details
   * @param _buyer - address of the ticket buyer (can be empty address)
   * @param _sellerProof the details signed by the seller (can be empty bytes)
   * @param _doorData - the credentials necessary to be authenticated at the event's entrance (can be empty bytes)
   */
  function sellTicket(uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata, address _buyer, bytes _sellerProof, bytes _doorData) external;

  /**
   * @dev Refund sale of a ticket
   * @param _eventId - event id for the event in context
   * @param _ticketId - ticket Id for the ticket to be refunded
   * @param _vendorProof - signed proof from the event owner/primary if refunding via a broker
   */
  function refundTicket(uint _eventId, uint _ticketId, bytes _vendorProof) external;

  /**
   * @dev Register a member for an event
   * @param _eventId - ID of the event
   * @param _role - role must be a member type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
   * @param _address - member address
   */
  function registerRole(uint _eventId, string _role, address _address) external;

  /**
   * @dev Deregister a member from an event
   * @param _eventId - ID of the event
   * @param _role - role must be a member type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
   * @param _address - member address
   */
  function deregisterRole(uint _eventId, string _role, address _address) external;

  /**
   * Sell a ticket on the secondary market.
   * @param _eventId - ID of the event
   * @param _ticketId identifier for the ticket: unique to this event.
   * @param _ownerPermission - signed by the owner
   * @param _newBuyer address of the new buyer of the ticket.
   * @param _sellerProof the details signed by the seller (can be empty bytes)
   */
  function resellTicket(uint _eventId, uint _ticketId, bytes _ownerPermission, address _newBuyer, bytes _sellerProof)
    external;

  /**
   * @dev Check if a member is registered for an event
   * @param _eventId - ID of the event
   * @param _role - role must be a member type of either "PrimaryDelegate", "SecondaryDelegate" or "Broker"
   * @param _address - address to check
   * @return _registered - returns true if the supplied address is registered
   */
  function roleIsRegistered(uint _eventId, string _role, address _address)
    external
    view
    returns (bool registered_);

  /**
   * @notice Calculate the appropriate event deposit In USCents and in AVT
   * @dev the parameter list WILL change when the deposit calculation is more mature
   * @param _averageTicketPriceInUSCents  - average ticket price in US Cents
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

  /**
  * @dev Create a challenge for the specified event.
  * @param _eventId id for the event to be challenged
  * @return proposalId_ id for proposal representing the challenge
  */
  function challengeEvent(uint _eventId) external returns (uint proposalId_);
}