const EventsManager = artifacts.require("EventsManager");
const votingTestHelper = require("./votingTestHelper");
const web3Utils = require('web3-utils');

let testHelper, eventsManager;

const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
const oneWeek = oneDay.times(7);
const eventSupportURL = "my support url that is really just a non-empty string";
const averageTicketPriceInUSCents = 675;
const eventDescBase = "This is NOT an event id: this is event number: ";

let brokerAddress;
let eventOwner;
let onSaleTime, offSaleTime, eventDesc;
let eventCount = 1;

async function before(_testHelper, _brokerAddress, _eventOwner) {
  testHelper = _testHelper;
  votingTestHelper.before(testHelper);

  brokerAddress = _brokerAddress;
  eventOwner = _eventOwner;

  eventsManager = await EventsManager.deployed();
  eventsManager = testHelper.profilingHelper.profileContract(eventsManager, "eventsManager");
}

after(async () => await testHelper.checkFundsEmpty());

async function withdrawDeposit(_depositAmount, _withdrawer) {
  await testHelper.withdrawAVTFromFund(_depositAmount, _withdrawer, "deposit");
}

function setupUniqueEventParameters() {
  // Vary the name so we get a unique event every time this is called.
  eventDesc = eventDescBase + eventCount++;
  // Set the times based on "now" as some tests advance the clock.
  onSaleTime = testHelper.now().plus(60 * oneDay); // Must be big enough to allow 2 challenges.
  offSaleTime = onSaleTime.plus(oneWeek);
}

// TODO: return eventDeposit instead of storing it as a local variables.
async function makeEventDeposit() {
  let deposits = await eventsManager.getNewEventDeposit(averageTicketPriceInUSCents);
  let eventDeposit = deposits[1];
  await testHelper.addAVTToFund(eventDeposit, eventOwner, "deposit");
  return eventDeposit;
}

async function withdrawEventDeposit(eventDeposit) {
  await withdrawDeposit(eventDeposit, eventOwner);
}

async function advanceTimeEndEventAndWithdrawDeposit(eventId, eventDeposit) {
  await testHelper.advanceTimeToEventEnd(eventId);
  await eventsManager.endEvent(eventId);
  await withdrawEventDeposit(eventDeposit);
}

// TODO: return ownerProof so it can be used later OR pass it in so it can be invalid too.
// TODO: rename to doCreatEventFromValidSender or redesign this so it can support a bad eventOwner and/or brokerAddress.
// TODO: remove isViaBroker: it assumes prior set up of the broker. Just pass the sender in and default in the calling code.
// TODO: move offSaleTime to be after onSaleTime in the parameter list.
async function doCreateEvent(_isViaBroker, _offSaleTime, _onSaleTime, _eventSupportURL) {
  // Hash the variable length parameters to create fixed length parameters.
  // See: http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
  const eventDescHash = await web3Utils.soliditySha3(eventDesc);
  const urlHash = await web3Utils.soliditySha3(_eventSupportURL);
  const keccak256Msg = await web3Utils.soliditySha3(eventDescHash, urlHash, _onSaleTime, _offSaleTime,
      averageTicketPriceInUSCents);
  const ownerProof = testHelper.createSignedMessage(eventOwner, keccak256Msg);
  const sender = _isViaBroker ? brokerAddress : eventOwner;
  await eventsManager.createEvent(eventDesc, _eventSupportURL, _onSaleTime, _offSaleTime, averageTicketPriceInUSCents,
      ownerProof, {from: sender});
}

async function createValidEvent(_isViaBroker) {
  await doCreateEvent(_isViaBroker, offSaleTime, onSaleTime, eventSupportURL);
  let eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
  assert.equal(eventArgs.eventDesc, eventDesc);
  assert.equal(eventArgs.onSaleTime.toNumber(), onSaleTime.toNumber());
  assert.equal(eventArgs.offSaleTime.toNumber(), offSaleTime.toNumber());
  assert.equal(eventArgs.averageTicketPriceInUSCents.toNumber(), averageTicketPriceInUSCents);
  return eventArgs.eventId.toNumber();
}

async function makeEventDepositAndCreateValidEvent(_isViaBroker) {
  setupUniqueEventParameters();
  let deposit = await makeEventDeposit();
  let id = await createValidEvent(_isViaBroker);
  return {id, deposit};
}

async function sellTicketSucceeds(_eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _vendorProof, _doorData, _vendor) {
  await eventsManager.sellTicket(_eventId, _vendorTicketRefHash, _ticketMetadata, _buyer, _vendorProof, _doorData,
      {from: _vendor});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketSale);
  assert.equal(eventArgs.vendorTicketRefHash, _vendorTicketRefHash);
  assert.equal(eventArgs.ticketMetadata, _ticketMetadata);
  assert.equal(eventArgs.buyer, _buyer);
  assert.equal(eventArgs.vendorProof, _vendorProof);
  assert.equal(eventArgs.doorData, _doorData);
  return eventArgs.ticketId;
}

async function returnTicketSucceeds(_eventId, _ticketId, _sender, _vendorProof) {
  await eventsManager.returnTicket(_eventId, _ticketId, _vendorProof, {from: _sender});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketReturn);
  assert.equal(_ticketId, eventArgs.ticketId.toNumber());
  assert.equal(_vendorProof, eventArgs.vendorProof);
}

async function generateOwnerProof(_eventId, _signer) {
  let keccak256Msg = await web3Utils.soliditySha3(_eventId);
  return testHelper.createSignedMessage(_signer, keccak256Msg);
}

async function challengeEvent(_eventId, _challengeOwner) {
  const existingDeposit = await eventsManager.getExistingEventDeposit(_eventId);
  await testHelper.addAVTToFund(existingDeposit, _challengeOwner, "deposit");
  await eventsManager.challengeEvent(_eventId, {from: _challengeOwner});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventChallenged);
  return {challengeProposalId : eventArgs.proposalId.toNumber(), deposit : existingDeposit};
}

async function endEventChallenge(_eventId, _challengeProposalId, _challengeOwner, _challengeEnder) {
  await testHelper.advanceTimeToEndOfProposal(_challengeProposalId);
  await eventsManager.endEventChallenge(_eventId, {from: _challengeEnder});
  const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventChallengeEnded);
  assert.equal(_challengeProposalId, eventArgs.proposalId.toNumber());
}

async function withdrawSuccessfulChallengeWinnings(_challengeProposalId, _challengeOwner, _challengeEnder, _voter, _deposit) {
  const challengeOwnerAndEnderWinnings = _deposit.dividedToIntegerBy(10);
  await testHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeOwner, 'deposit');
  await testHelper.withdrawAVTFromFund(challengeOwnerAndEnderWinnings, _challengeEnder, 'deposit');

  await votingTestHelper.claimVoterWinnings(_challengeProposalId, _voter);
  const totalVoterWinnings = _deposit.minus(challengeOwnerAndEnderWinnings).minus(challengeOwnerAndEnderWinnings);

  await testHelper.withdrawAVTFromFund(totalVoterWinnings, _voter, 'deposit');
  await testHelper.withdrawAVTFromFund(_deposit, _challengeOwner, 'deposit');
  return totalVoterWinnings.mod(2).toNumber();
}

async function challengeEventAndMarkAsFraudulent(_eventId, _challengeOwner, _challengeEnder, _voter) {
  const challenge = await challengeEvent(_eventId, _challengeOwner);

  await testHelper.addAVTToFund(testHelper.oneAVT, _voter, 'stake');
  await votingTestHelper.advanceTimeCastAndRevealVotes(challenge.challengeProposalId, [{voter: _voter, option: 1}]);

  await endEventChallenge(_eventId, challenge.challengeProposalId, _challengeOwner, _challengeEnder, _voter);

  const remainder = await withdrawSuccessfulChallengeWinnings(challenge.challengeProposalId, _challengeOwner, _challengeEnder, _voter, challenge.deposit);
  await testHelper.withdrawAVTFromFund(testHelper.oneAVT, _voter, 'stake');

  if (remainder > 0) {
    console.log(`TODO: Deal with challenge (Id: ${challenge.challengeProposalId}) remainder of ${remainder} AVT`);
  }
}

module.exports = {
  before,
  getOnSaleTime: () => onSaleTime,
  getOffSaleTime: () => offSaleTime,
  getEventSupportURL: () => eventSupportURL,
  getEventsManager: () => eventsManager,

  generateOwnerProof,
  makeEventDeposit,
  withdrawDeposit,
  withdrawEventDeposit,
  setupUniqueEventParameters,
  doCreateEvent,
  createValidEvent,
  makeEventDepositAndCreateValidEvent,
  advanceTimeEndEventAndWithdrawDeposit,
  sellTicketSucceeds,
  returnTicketSucceeds,
  challengeEventAndMarkAsFraudulent
};