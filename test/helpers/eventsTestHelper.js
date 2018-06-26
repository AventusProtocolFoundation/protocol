const EventsManager = artifacts.require("EventsManager");
const AventusVote = artifacts.require("AventusVote");
const AppsManager = artifacts.require("AppsManager");
const testHelper = require("./testHelper");
const web3Utils = require('web3-utils');

const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
const oneWeek = oneDay.times(7);
let eventsManager, aventusVote, avt;

let validEventId, eventDeposit;

let appAddress;
let eventOwner;

const eventCapacity = 5;
const eventSupportURL = "my support url that is really just a non-empty string";
const eventAverageTicketPriceInUSCents = 675;
let eventTicketSaleStartTime, eventTime, eventDesc;
const eventDescBase = "This is NOT an event id: this is event number: ";
let eventCount = 1;

const ticketDetailsBase = "Unallocated seating. Ticket number: ";
let ticketCount = 1;

async function before(_appAddress, _eventOwner) {
  await testHelper.before();

  appAddress = _appAddress;
  eventOwner = _eventOwner;

  eventsManager = await EventsManager.deployed();
  appsManager = await AppsManager.deployed();
  aventusVote = testHelper.getAventusVote();

  avt = testHelper.getAVTContract();
};

after(async () => await testHelper.checkFundsEmpty());

async function makeDeposit(_amount, _depositer) {
  if (_depositer != testHelper.getAccount(0)) {
    // Any other account will not have any AVT: give them what they need.
    await avt.transfer(_depositer, _amount);
  }
  await avt.approve(aventusVote.address, _amount, {from: _depositer});
  await aventusVote.deposit("deposit", _amount, {from: _depositer});
}

async function withdrawDeposit(_depositAmount, _withdrawer) {
  await aventusVote.withdraw("deposit", _depositAmount, {from: _withdrawer});
}

function setupUniqueEventParameters() {
  // Vary the name so we get a unique event every time this is called.
  eventDesc = eventDescBase + eventCount++;
  // Set the times based on "now" as some tests advance the clock.
  eventTicketSaleStartTime = testHelper.now().plus(30 * oneDay);
  eventTime = eventTicketSaleStartTime.plus(oneWeek);
}

async function depositAndWhitelistApp(_appAddress) {
  let amount = await appsManager.getAppDeposit();
  await makeDeposit(amount, _appAddress);
  await appsManager.registerApp(_appAddress);
}

async function dewhitelistAppAndWithdrawDeposit(_appAddress) {
  await appsManager.deregisterApp(_appAddress);
  let deposit = await appsManager.getAppDeposit();
  await withdrawDeposit(deposit, _appAddress);
}

async function makeEventDeposit() {
  let deposits = await eventsManager.getEventDeposit(eventCapacity, eventAverageTicketPriceInUSCents, eventTicketSaleStartTime);
  eventDeposit = deposits[1];
  await makeDeposit(eventDeposit, eventOwner);
}

async function withdrawEventDeposit() {
  await withdrawDeposit(eventDeposit, eventOwner);
}

async function endEventAndWithdrawDeposit() {
  await testHelper.advanceTimeToEventEnd(validEventId);
  await eventsManager.unlockEventDeposit(validEventId);
  await withdrawEventDeposit();
}


async function doCreateEvent(_eventIsSigned, _eventTime, _eventTicketSaleStartTime, _eventSupportURL) {
  if (_eventIsSigned) {
    // Hash the variable length parameters to create fixed length parameters.
    // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
    let keccak256Msg = await web3Utils.soliditySha3(await web3Utils.soliditySha3(eventDesc), _eventTime, eventCapacity,
        eventAverageTicketPriceInUSCents, _eventTicketSaleStartTime, await web3Utils.soliditySha3(_eventSupportURL), eventOwner);
    let signedMessage = testHelper.createSignedMessage(eventOwner, keccak256Msg);
    await eventsManager.signedCreateEvent(signedMessage, eventDesc, _eventTime, eventCapacity, eventAverageTicketPriceInUSCents,
        _eventTicketSaleStartTime, _eventSupportURL, eventOwner, {from: appAddress});
  } else {
    await eventsManager.createEvent( eventDesc, _eventTime, eventCapacity, eventAverageTicketPriceInUSCents,
       _eventTicketSaleStartTime, _eventSupportURL, {from: eventOwner});
  }
}

async function createValidEvent(_eventIsSigned) {
  await doCreateEvent(_eventIsSigned, eventTime, eventTicketSaleStartTime, eventSupportURL);
  let eventArgs;
  if (_eventIsSigned) {
    eventArgs = await testHelper.getEventArgs(eventsManager.LogSignedEventCreated);
  } else {
    eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
  }
  assert.equal(eventArgs.eventDesc, eventDesc);
  validEventId = eventArgs.eventId.toNumber();
}


async function makeEventDepositAndCreateValidEvent(_eventIsSigned) {
  setupUniqueEventParameters();
  await makeEventDeposit();
  await createValidEvent();
}

module.exports = {
  before,
  getEventTicketSaleStartTime: () => eventTicketSaleStartTime,
  getEventTime: () => eventTime,
  getValidEventId: () => validEventId,
  getEventDeposit: () => eventDeposit,
  getEventSupportURL: () => eventSupportURL,
  getEventCapacity: () => eventCapacity,
  getEventsManager: () => eventsManager,
  getAppsManager: () => appsManager,

  makeDeposit,
  makeEventDeposit,
  withdrawDeposit,
  withdrawEventDeposit,
  setupUniqueEventParameters,
  depositAndWhitelistApp,
  dewhitelistAppAndWithdrawDeposit,
  doCreateEvent,
  createValidEvent,
  makeEventDepositAndCreateValidEvent,
  endEventAndWithdrawDeposit
}
