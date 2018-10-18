pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAventities.sol';
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsEnact.sol";
import "./LEventsTickets.sol";
import "./LMerkleRoots.sol";
import './LProposal.sol';
import "./LEventsStorage.sol";

/* @dev All external methods in here are called from EventsManager and have the same function signature (and interface
 * documentation) as their namesakes in EventsManager. Each of these methods should do the following and ONLY the following:
 *   - check that the event is in the correct state
 *   - call the method of the same name in a sublibrary to actually make the required change
 *   - emit the correct log
 * In particular, the methods SHOULD NOT check proofs or msg.sender validity - these checks should be done in the sublibrary.
 */

library LEvents {

  enum EventState {NonExistent, Reporting, Trading, Inactive}

  // See IEventsManager interface for logs description
  event LogEventCreated(uint indexed eventId, string eventDesc, string eventSupportURL, uint onSaleTime, uint offSaleTime,
      uint averageTicketPriceInUSCents, uint depositInAVTDecimals);
  event LogEventCancelled(uint indexed eventId);
  event LogEventEnded(uint indexed eventId);
  event LogTicketSale(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      bytes vendorProof, bytes doorData, address indexed buyer);
  event LogTicketReturn(uint indexed eventId, uint indexed ticketId, bytes vendorProof);
  event LogTicketResale(uint indexed eventId, uint indexed ticketId, address indexed newBuyer, bytes resellerProof);
  event LogTicketListed(uint indexed eventId, uint ticketId, address indexed ticketOwner, bytes32 indexed leafHash);
  event LogTicketSentToFriend(uint indexed eventId, uint indexed ticketId, bytes newDoorData);
  event LogMemberRegisteredOnEvent(uint indexed eventId, address indexed memberAddress, string memberType);
  event LogMemberDeregisteredFromEvent(uint indexed eventId, address indexed memberAddress, string memberType);
  event LogEventChallenged(uint indexed eventId, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd);
  event LogEventChallengeEnded(uint indexed eventId, uint indexed proposalId, uint votesFor, uint votesAgainst);

  modifier onlyWhenHashNonExistent(IAventusStorage _storage, bytes32 _eventHash) {
    require(!LEventsStorage.isExistingEventHash(_storage, _eventHash), "Event already exists");
    _;
  }

  modifier onlyWhenActive(IAventusStorage _storage, uint _eventId) {
    EventState state = getEventState(_storage, _eventId);
    require(EventState.Trading == state || EventState.Reporting == state, "Event must be active");
    _;
  }

  modifier onlyWhenTrading(IAventusStorage _storage, uint _eventId) {
    require(EventState.Trading == getEventState(_storage, _eventId), "Event must be trading");
    _;
  }

  modifier onlyInReportingPeriod(IAventusStorage _storage, uint _eventId) {
    require(EventState.Reporting == getEventState(_storage, _eventId), "Event must be in reporting period");
    _;
  }

  modifier onlyWhenInactive(IAventusStorage _storage, uint _eventId) {
    require(EventState.Inactive == getEventState(_storage, _eventId), "Event must be inactive");
    _;
  }

  function createEvent(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _onSaleTime,
      uint _offSaleTime, uint _averageTicketPriceInUSCents, bytes _ownerProof)
    external
  {
    bytes32 eventHash = getEventHash(_eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime,
        _averageTicketPriceInUSCents);
    (uint eventId, uint depositInAVTDecimals) = doCreateEvent(_storage, _eventSupportURL, _onSaleTime, _offSaleTime,
        _averageTicketPriceInUSCents, _ownerProof, eventHash);
    emit LogEventCreated(eventId, _eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime, _averageTicketPriceInUSCents,
        depositInAVTDecimals);
  }

  function challengeEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyWhenActive(_storage, _eventId)
  {
    uint proposalId = LEventsEnact.challengeEvent(_storage, _eventId);
    (uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd) = LProposal.getTimestamps(_storage,
        proposalId);
    emit LogEventChallenged(_eventId, proposalId, lobbyingStart, votingStart, revealingStart, revealingEnd);
  }

  function endEventChallenge(IAventusStorage _storage, uint _eventId)
    external
  {
    (uint proposalId, uint votesFor, uint votesAgainst) = LEventsEnact.endEventChallenge(_storage, _eventId);
    emit LogEventChallengeEnded(_eventId, proposalId, votesFor, votesAgainst);
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId, bytes _ownerProof)
    external
    onlyInReportingPeriod(_storage, _eventId)
  {
    LEventsEnact.cancelEvent(_storage, _eventId, _ownerProof);
    emit LogEventCancelled(_eventId);
  }

  function endEvent(IAventusStorage _storage, uint _eventId)
    external
    onlyWhenInactive(_storage, _eventId)
  {
    LEventsEnact.endEvent(_storage, _eventId);
    emit LogEventEnded(_eventId);
  }

  function sellTicket(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash,
      string _ticketMetadata, address _buyer, bytes _vendorProof, bytes _doorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    uint ticketId = LEventsTickets.addTicket(_storage, _eventId, _vendorTicketRefHash, _buyer, _vendorProof, _doorData);
    emit LogTicketSale(_eventId, ticketId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData, _buyer);
  }

  function returnTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _vendorProof)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.returnTicket(_storage, _eventId, _ticketId, _vendorProof);
    emit LogTicketReturn(_eventId, _ticketId, _vendorProof);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ticketOwnerPermission,
      address _newBuyer, bytes _resellerProof, bytes _doorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.resellTicket(_storage, _eventId, _ticketId, _ticketOwnerPermission, _newBuyer, _resellerProof, _doorData);
    emit LogTicketResale(_eventId, _ticketId, _newBuyer, _resellerProof);
  }

  function sendTicketToFriend(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _ticketOwnerPermission,
      bytes _newDoorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.sendTicketToFriend(_storage, _eventId, _ticketId, _ticketOwnerPermission, _newDoorData);
    emit LogTicketSentToFriend(_eventId, _ticketId, _newDoorData);
  }

  function listTicketA(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata,
      bytes _vendorProof, bytes _doorData, bytes _ticketOwnerProof)
    external
  {
    address ticketOwner = LEventsCommon.getSignerFromProof(_vendorTicketRefHash, _ticketOwnerProof);
    bytes32 leafHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _ticketMetadata, ticketOwner, _vendorProof,
        _doorData));
    _storage.setBytes32(keccak256(abi.encodePacked("Event", _eventId, "vendorTicketRefHash", _vendorTicketRefHash, "leafHash")),
        leafHash);
    _storage.setAddress(keccak256(abi.encodePacked("LeafHash", leafHash, "ticketOwner")), ticketOwner);
  }

  function listTicketB(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, bytes32[] _merklePath)
    view
    external
    onlyWhenTrading(_storage, _eventId)
  {
    bytes32 leafHash = _storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "vendorTicketRefHash",
        _vendorTicketRefHash, "leafHash")));
    bytes32 rootHash = LMerkleRoots.generateMerkleRoot(_storage, _merklePath, leafHash);
    require(LMerkleRoots.merkleRootIsActive(_storage, rootHash), "Merkle root is not active");
  }

  function listTicketC(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, bytes _vendorProof,
      bytes _doorData)
    external
  {
    bytes32 leafHash =_storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "vendorTicketRefHash",
        _vendorTicketRefHash, "leafHash")));
    address ticketOwner = _storage.getAddress(keccak256(abi.encodePacked("LeafHash", leafHash, "ticketOwner")));
    uint ticketId = LEventsTickets.addTicket(_storage, _eventId, _vendorTicketRefHash, ticketOwner, _vendorProof, _doorData);
    emit LogTicketListed(_eventId, ticketId, ticketOwner, leafHash);
  }

  function registerMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
  {
    if (LEventsCommon.registerMemberOnEvent(_storage, _eventId, _memberAddress, _memberType)) {
      emit LogMemberRegisteredOnEvent(_eventId, _memberAddress, _memberType);
    }
  }

  function deregisterMemberFromEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
  {
    if (LEventsCommon.deregisterMemberFromEvent(_storage, _eventId, _memberAddress, _memberType)) {
      emit LogMemberDeregisteredFromEvent(_eventId, _memberAddress, _memberType);
    }
  }

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId) external view returns (uint eventDeposit_) {
    eventDeposit_ = LEventsCommon.getExistingEventDeposit(_storage, _eventId);
  }

  function getNewEventDeposit(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    (depositInUSCents_, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);
  }

  function doCreateEvent(IAventusStorage _storage, string _eventSupportURL, uint _onSaleTime,
      uint _offSaleTime, uint _averageTicketPriceInUSCents, bytes _ownerProof, bytes32 _eventHash)
    private
    onlyWhenHashNonExistent(_storage, _eventHash)
    returns (uint eventId_, uint depositInAVTDecimals_)
  {
    (eventId_,  depositInAVTDecimals_) = LEventsEnact.createEvent(_storage, _eventSupportURL, _onSaleTime,
        _offSaleTime, _averageTicketPriceInUSCents, _ownerProof, _eventHash);
  }

  function getEventHash(string _eventDesc, string _eventSupportURL, uint _onSaleTime, uint _offSaleTime,
      uint _averageTicketPriceInUSCents)
    private
    pure
    returns (bytes32 eventHash_)
  {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    bytes32 descHash = keccak256(abi.encodePacked(_eventDesc));
    bytes32 supportURLHash = keccak256(abi.encodePacked(_eventSupportURL));
    eventHash_ = keccak256(abi.encodePacked(descHash, supportURLHash, _onSaleTime, _offSaleTime, _averageTicketPriceInUSCents));
  }

  function getEventState(IAventusStorage _storage, uint _eventId) private view returns (EventState) {
    uint eventAventityId = LEventsStorage.getAventityId(_storage, _eventId);
    bool eventAventityIsActive = LAventities.aventityIsActive(_storage, eventAventityId);
    if (!eventAventityIsActive) return EventState.NonExistent;

    uint currentTime = LAventusTime.getCurrentTime(_storage);
    if (currentTime >= LEventsStorage.getOffSaleTime(_storage, _eventId)) return EventState.Inactive;

    if (currentTime >= LEventsStorage.getOnSaleTime(_storage, _eventId)) return EventState.Trading;

    return EventState.Reporting;
  }
}