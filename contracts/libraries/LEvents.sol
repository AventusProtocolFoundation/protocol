pragma solidity ^0.4.24;

import "../interfaces/IAventusStorage.sol";
import "./LAventities.sol";
import "./LAventusTime.sol";
import "./LEventsCommon.sol";
import "./LEventsEnact.sol";
import "./LEventsTickets.sol";
import "./LMerkleRoots.sol";
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
  event LogEventCreated(uint indexed eventId, address indexed eventOwner, string eventDesc, string eventSupportURL,
      uint onSaleTime, uint offSaleTime, uint averageTicketPriceInUSCents, uint depositInAVTDecimals);
  event LogEventCancelled(uint indexed eventId);
  event LogEventEnded(uint indexed eventId);
  event LogTicketSold(uint indexed eventId, uint indexed ticketId, bytes32 vendorTicketRefHash, string ticketMetadata,
      bytes vendorProof, bytes doorData, address indexed buyer);
  event LogTicketCancelled(uint indexed eventId, uint indexed ticketId, bytes vendorProof);
  event LogTicketResold(uint indexed eventId, uint indexed ticketId, bytes resellerProof, bytes doorData,
      address indexed newBuyer);
  event LogTicketListed(uint indexed eventId, uint ticketId, address indexed ticketOwner, bytes32 indexed leafHash);
  event LogMemberRegisteredOnEvent(uint indexed eventId, address indexed memberAddress, string memberType);
  event LogMemberDeregisteredFromEvent(uint indexed eventId, address indexed memberAddress, string memberType);

  modifier onlyWhenHashNonExistent(IAventusStorage _storage, bytes32 _eventHash) {
    require(!LEventsStorage.isExistingEventHash(_storage, _eventHash), "Event already exists");
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

  modifier onlyWhenExistent(IAventusStorage _storage, uint _eventId) {
    require(EventState.NonExistent != getEventState(_storage, _eventId), "Event must exist");
    _;
  }

  function createEvent(IAventusStorage _storage, string _eventDesc, string _eventSupportURL, uint _onSaleTime,
      uint _offSaleTime, uint _averageTicketPriceInUSCents, bytes _createEventOwnerProof)
    external
  {
    bytes32 eventHash = getEventHash(_eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime,
        _averageTicketPriceInUSCents);
    (address eventOwner, uint eventId, uint depositInAVTDecimals) = doCreateEvent(_storage, _onSaleTime, _offSaleTime,
      _averageTicketPriceInUSCents, _createEventOwnerProof, eventHash);
    emit LogEventCreated(eventId, eventOwner, _eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime,
        _averageTicketPriceInUSCents, depositInAVTDecimals);
  }

  function cancelEvent(IAventusStorage _storage, uint _eventId, bytes _cancelEventEventOwnerProof)
    external
    onlyInReportingPeriod(_storage, _eventId)
  {
    LEventsEnact.cancelEvent(_storage, _eventId, _cancelEventEventOwnerProof);
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
      string _ticketMetadata, address _buyer, bytes _sellTicketVendorProof, bytes _doorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    uint ticketId = LEventsTickets.addTicket(_storage, _eventId, _vendorTicketRefHash, _buyer, _sellTicketVendorProof);
    emit LogTicketSold(_eventId, ticketId, _vendorTicketRefHash, _ticketMetadata, _sellTicketVendorProof, _doorData, _buyer);
  }

  function cancelTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _cancelTicketVendorProof)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.cancelTicket(_storage, _eventId, _ticketId, _cancelTicketVendorProof);
    emit LogTicketCancelled(_eventId, _ticketId, _cancelTicketVendorProof);
  }

  function resellTicket(IAventusStorage _storage, uint _eventId, uint _ticketId, bytes _resellTicketTicketOwnerProof,
      address _newBuyer, bytes _resellTicketResellerProof, bytes _doorData)
    external
    onlyWhenTrading(_storage, _eventId)
  {
    LEventsTickets.resellTicket(_storage, _eventId, _ticketId, _resellTicketTicketOwnerProof, _newBuyer,
        _resellTicketResellerProof);
    emit LogTicketResold(_eventId, _ticketId, _resellTicketResellerProof, _doorData, _newBuyer);
  }

  function listTicketA(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, string _ticketMetadata,
      bytes _listTicketVendorProof, bytes _doorData, bytes _listTicketTicketOwnerProof)
    external
  {
    address ticketOwner = LEventsCommon.getSignerFromProof(_vendorTicketRefHash, _listTicketTicketOwnerProof);
    bytes32 leafHash = keccak256(abi.encodePacked(_eventId, _vendorTicketRefHash, _ticketMetadata, ticketOwner,
        _listTicketVendorProof, _doorData));
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

  function listTicketC(IAventusStorage _storage, uint _eventId, bytes32 _vendorTicketRefHash, bytes _listTicketVendorProof)
    external
  {
    bytes32 leafHash =_storage.getBytes32(keccak256(abi.encodePacked("Event", _eventId, "vendorTicketRefHash",
        _vendorTicketRefHash, "leafHash")));
    address ticketOwner = _storage.getAddress(keccak256(abi.encodePacked("LeafHash", leafHash, "ticketOwner")));
    uint ticketId = LEventsTickets.addTicket(_storage, _eventId, _vendorTicketRefHash, ticketOwner, _listTicketVendorProof);
    emit LogTicketListed(_eventId, ticketId, ticketOwner, leafHash);
  }

  function registerMemberOnEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
    onlyWhenExistent(_storage, _eventId)
  {
    LEventsCommon.registerMemberOnEvent(_storage, _eventId, _memberAddress, _memberType);
    emit LogMemberRegisteredOnEvent(_eventId, _memberAddress, _memberType);
  }

  function deregisterMemberFromEvent(IAventusStorage _storage, uint _eventId, address _memberAddress, string _memberType)
    external
    onlyWhenExistent(_storage, _eventId)
  {
    LEventsCommon.deregisterMemberFromEvent(_storage, _eventId, _memberAddress, _memberType);
    emit LogMemberDeregisteredFromEvent(_eventId, _memberAddress, _memberType);
  }

  function getExistingEventDeposit(IAventusStorage _storage, uint _eventId)
    external
    view
    onlyWhenExistent(_storage, _eventId)
    returns (uint eventDeposit_) {
    eventDeposit_ = LEventsCommon.getExistingEventDeposit(_storage, _eventId);
  }

  function getNewEventDeposit(IAventusStorage _storage, uint _averageTicketPriceInUSCents)
    external
    view
    returns (uint depositInUSCents_, uint depositInAVTDecimals_)
  {
    (depositInUSCents_, depositInAVTDecimals_) = LEventsCommon.getNewEventDeposit(_storage, _averageTicketPriceInUSCents);
  }

  function doCreateEvent(IAventusStorage _storage, uint _onSaleTime, uint _offSaleTime, uint _averageTicketPriceInUSCents,
      bytes _createEventEventOwnerProof, bytes32 _eventHash)
    private
    onlyWhenHashNonExistent(_storage, _eventHash)
    returns (address eventOwner_, uint eventId_, uint depositInAVTDecimals_)
  {
    (eventOwner_, eventId_,  depositInAVTDecimals_) = LEventsEnact.createEvent(_storage, _onSaleTime, _offSaleTime,
        _averageTicketPriceInUSCents, _createEventEventOwnerProof, _eventHash);
  }

  function getEventHash(string _eventDesc, string _eventSupportURL, uint _onSaleTime, uint _offSaleTime,
      uint _averageTicketPriceInUSCents)
    private
    pure
    returns (bytes32 eventHash_)
  {
    require(bytes(_eventDesc).length > 0, "Event requires a non-empty description");
    require(bytes(_eventSupportURL).length > 0, "Event requires a non-empty support URL");
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