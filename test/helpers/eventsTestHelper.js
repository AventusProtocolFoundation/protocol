const EventsManager = artifacts.require("EventsManager");
const ProposalsManager = artifacts.require("ProposalsManager");
const MembersManager = artifacts.require("MembersManager");
const AventusStorage = artifacts.require("AventusStorage");
const web3Utils = require('web3-utils');

const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
const oneWeek = oneDay.times(7);
let testHelper, eventsManager, proposalsManager, storage;

let validEventId, eventDeposit;

let brokerAddress;
let eventOwner;

const eventCapacity = 5;
const eventSupportURL = "my support url that is really just a non-empty string";
const averageTicketPriceInUSCents = 675;
let ticketSaleStartTime, eventTime, eventDesc;
const eventDescBase = "This is NOT an event id: this is event number: ";
let eventCount = 1;

const vendorTicketRefBase = "UniqueVendorTicketRef ";
let ticketCount = 1;

async function before(_testHelper, _brokerAddress, _eventOwner) {
  testHelper = _testHelper;

  brokerAddress = _brokerAddress;
  eventOwner = _eventOwner;

  eventsManager = await EventsManager.deployed();
  membersManager = await MembersManager.deployed();
  storage = await AventusStorage.deployed();
  proposalsManager = testHelper.getProposalsManager();
};

after(async () => await testHelper.checkFundsEmpty());

async function withdrawDeposit(_depositAmount, _withdrawer) {
  await testHelper.withdrawAVTFromFund(_depositAmount, _withdrawer, "deposit");
}

function setupUniqueEventParameters() {
  // Vary the name so we get a unique event every time this is called.
  eventDesc = eventDescBase + eventCount++;
  // Set the times based on "now" as some tests advance the clock.
  ticketSaleStartTime = testHelper.now().plus(30 * oneDay);
  eventTime = ticketSaleStartTime.plus(oneWeek);
}

async function makeEventDeposit() {
  let deposits = await eventsManager.getNewEventDeposit(averageTicketPriceInUSCents);
  eventDeposit = deposits[1];
  await testHelper.addAVTToFund(eventDeposit, eventOwner, "deposit");
}

async function withdrawEventDeposit() {
  await withdrawDeposit(eventDeposit, eventOwner);
}

async function endEventAndWithdrawDeposit() {
  await testHelper.advanceTimeToEventEnd(validEventId);
  await eventsManager.unlockEventDeposit(validEventId);
  await withdrawEventDeposit();
}


async function doCreateEvent(_useSignedCreateEvent, _eventTime, _ticketSaleStartTime, _eventSupportURL) {
  let sender, ownerProof;
  if (_useSignedCreateEvent) {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    let keccak256Msg = await web3Utils.soliditySha3(await web3Utils.soliditySha3(eventDesc),
        await web3Utils.soliditySha3(_eventSupportURL), _ticketSaleStartTime, _eventTime, eventCapacity,
        averageTicketPriceInUSCents);
    sender = brokerAddress;
    ownerProof = testHelper.createSignedMessage(eventOwner, keccak256Msg);
  } else {
    sender = eventOwner;
    ownerProof = '0x';
  }
  await eventsManager.createEvent(eventDesc, _eventSupportURL, _ticketSaleStartTime, _eventTime, eventCapacity,
      averageTicketPriceInUSCents, ownerProof, {from: sender});
}

async function createValidEvent(_useSignedCreateEvent) {
  await doCreateEvent(_useSignedCreateEvent, eventTime, ticketSaleStartTime, eventSupportURL);
  let eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
  assert.equal(eventArgs.eventDesc, eventDesc);
  assert.equal(eventArgs.ticketSaleStartTime.toNumber(), ticketSaleStartTime.toNumber());
  assert.equal(eventArgs.eventTime.toNumber(), eventTime.toNumber());
  assert.equal(eventArgs.averageTicketPriceInUSCents.toNumber(), averageTicketPriceInUSCents);
  validEventId = eventArgs.eventId.toNumber();
}


async function makeEventDepositAndCreateValidEvent(_useSignedCreateEvent) {
  setupUniqueEventParameters();
  await makeEventDeposit();
  await createValidEvent(_useSignedCreateEvent);
}

// selling tickets
async function sellTicketSucceeds(_eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _sellerProof, _doorData, _seller) {
  await eventsManager.sellTicket(_eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _sellerProof, _doorData, {from: _seller});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketSale);
  assert.equal(eventArgs.vendorTicketRefHash, _vendorTicketRefHash);
  assert.equal(eventArgs.ticketMetadata, _ticketMetadata);
  assert.equal(eventArgs.buyer, _buyer);
  assert.equal(eventArgs.sellerProof, _sellerProof);
  assert.equal(eventArgs.doorData, _doorData);
  return eventArgs.ticketId.toNumber();
}


// Refunding tickets
async function refundTicketSucceeds(_eventId, _ticketId, _sender, _vendorProof) {
  await eventsManager.refundTicket(_eventId, _ticketId, _vendorProof, {from: _sender});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketRefund);
  assert.equal(_ticketId, eventArgs.ticketId.toNumber());
  assert.equal(_vendorProof, eventArgs.vendorProof);
};


module.exports = {
  before,
  getTicketSaleStartTime: () => ticketSaleStartTime,
  getEventTime: () => eventTime,
  getValidEventId: () => validEventId,
  getEventDeposit: () => eventDeposit,
  getEventSupportURL: () => eventSupportURL,
  getEventCapacity: () => eventCapacity,
  getEventsManager: () => eventsManager,
  getMembersManager: () => membersManager,

  makeEventDeposit,
  withdrawDeposit,
  withdrawEventDeposit,
  setupUniqueEventParameters,
  doCreateEvent,
  createValidEvent,
  makeEventDepositAndCreateValidEvent,
  endEventAndWithdrawDeposit,
  sellTicketSucceeds,
  refundTicketSucceeds
}
