const AventusStorage = artifacts.require("AventusStorage.sol");
const ProposalsManager = artifacts.require("ProposalsManager.sol");
const AVTManager = artifacts.require("AVTManager.sol");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const Versioned = artifacts.require("Versioned");
const IERC20 = artifacts.require("IERC20");
const web3Utils = require('web3-utils');
const profilingHelper = require("./profilingHelper");

const accounts = web3.eth.accounts;

const oneDay = 86400;    // seconds in one day.
const oneWeek = 7 * oneDay;
const mockTimeKey = web3Utils.soliditySha3("MockCurrentTime");

// TODO: make these member types an object
const brokerMemberType = 'Broker';
const primaryMemberType = 'Primary';
const secondaryMemberType = 'Secondary';
const tokenBondingCurveMemberType = 'TokenBondingCurve';
const scalingProviderMemberType = 'ScalingProvider';
const invalidMemberType = 'invalid';

const evidenceURL = "http://www.example.com/events?eventid=1111";
const ONE_AVT = new web3.BigNumber(1 * 10**18);

let blockChainTime = new web3.BigNumber(0);
let aventusStorage, avtAddress, proposalsManager, realTimeInstance, mockTimeInstance, avt;
let lastEventBlockNumber = -1;

let profiledEventArgs = profilingHelper.profileFunction("TestHelper.getEventArgs", getEventArgs);

async function before() {
  aventusStorage = await AventusStorage.deployed();
  aventusStorage = profilingHelper.profileContract(aventusStorage, "aventusStorage");
  versioned = await Versioned.deployed();
  versioned = profilingHelper.profileContract(versioned, "versioned");
  avtAddress = await aventusStorage.getAddress(web3Utils.soliditySha3("AVTERC20Instance"));
  avt = IERC20.at(avtAddress);
  proposalsManager = await ProposalsManager.deployed();
  proposalsManager = profilingHelper.profileContract(proposalsManager, "proposalsManager");
  avtManager = await AVTManager.deployed();
  avtManager = profilingHelper.profileContract(avtManager, "avtManager");
  realTimeInstance = await LAventusTime.deployed();
  realTimeInstance = profilingHelper.profileContract(realTimeInstance, "realTimeInstance");
  mockTimeInstance = await LAventusTimeMock.deployed();
  mockTimeInstance = profilingHelper.profileContract(mockTimeInstance, "mockTimeInstance");

  blockChainTime = new web3.BigNumber(web3.eth.getBlock(web3.eth.blockNumber).timestamp);
  await initMockTime();
  lastEventBlockNumber = -1;
}

// Call this from your after() method as standard. Switch to afterEach to debug any issues.
async function checkFundsEmpty(alsoCheckStakes) {
  for (let i = 0; i < 5; ++i) {
    checkFundIsEmpty('deposit', i);
    if (alsoCheckStakes) checkFundIsEmpty('stake', i);
  }
  let totalAVTFunds = await avt.balanceOf(aventusStorage.address);
  assert.equal(totalAVTFunds.toNumber(), 0, "Total balance not cleared");
}

async function checkFundIsEmpty(fund, accountNum) {
  const depositBalance = (await avtManager.getBalance(fund, getAccount(accountNum))).toNumber();
  assert.equal(0, depositBalance, (fund + " account " + accountNum + " has AVT"));
}

function getAccount(id) {
  return accounts[id];
}

async function getTimeKey() {
  const versionMajorMinor = await getVersionMajorMinor();
  return web3Utils.soliditySha3("LAventusTimeInstance" + "-" + versionMajorMinor);
}

async function useRealTime() {
  await aventusStorage.setAddress(await getTimeKey(), realTimeInstance.address);
}

async function useMockTime() {
  await aventusStorage.setAddress(await getTimeKey(), mockTimeInstance.address);
}

async function initMockTime() {
  await useMockTime();
  await aventusStorage.setUInt(mockTimeKey, blockChainTime);
}

async function setMockTime(_timestamp) {
 await aventusStorage.setUInt(mockTimeKey, _timestamp);
 blockChainTime = await aventusStorage.getUInt(mockTimeKey);
}

// TODO: Remove this. Use advanceTo<...>Period instead.
async function advanceByDays(days) {
  let currentTime = await aventusStorage.getUInt(mockTimeKey);
  await advanceToTime(currentTime.plus(days * oneDay));
}

async function advanceToTime(_timestamp) {
  let currentTime = await aventusStorage.getUInt(mockTimeKey);
  assert(_timestamp >= currentTime);
  await setMockTime(_timestamp);
}

// TODO: Move to votingTestHelper.
async function advanceToProposalPeriod(_proposalId, _period) {
  const periodKey = web3Utils.soliditySha3("Proposal", _proposalId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await advanceToTime(parseInt(period));
}
async function advanceTimeToVotingStart(_proposalId) { await advanceToProposalPeriod(_proposalId, "votingStart"); }
async function advanceTimeToRevealingStart(_proposalId) { await advanceToProposalPeriod(_proposalId, "revealingStart"); }
async function advanceTimeToEndOfProposal(_proposalId) { await advanceToProposalPeriod(_proposalId, "revealingEnd"); }

// TODO: Move these to eventsTestHelper.
async function advanceToEventPeriod(_eventId, _timestampLabel) {
  const timestampKey = web3Utils.soliditySha3("Event", _eventId, _timestampLabel);
  const timestamp = await aventusStorage.getUInt(timestampKey);
  await advanceToTime(parseInt(timestamp));
}
async function advanceTimeToEventOnSaleTime(_eventId) { await advanceToEventPeriod(_eventId, "onSaleTime"); }
// TODO: Rename to advanceTimeToEventOffSaleTime
async function advanceTimeToEventEnd(_eventId) { await advanceToEventPeriod(_eventId, "offSaleTime"); }

//TODO: Rename to getLogArgs - "Event" is an overloaded term in our protocol.
function getEventArgs(eventListenerFunction) {
  return new Promise((resolve, reject) => {
    let eventListener = eventListenerFunction({}, {fromBlock: lastEventBlockNumber + 1});
    return eventListener.get((error, log) => {
      if (error) {
        reject(error);
      } else if (log.length == 1) {
        let event = log[0];
        lastEventBlockNumber = event.blockNumber;
        resolve(event.args);
      } else if (log.length > 1) {
        reject(`Duplicate events: ${log.length}`);
      }
    });
  });
}

function createSignedMessage(_signer, _keccak256Msg) {
  const signedMessage = web3.eth.sign(_signer, _keccak256Msg);
  assert.equal(signedMessage.length, 132);
  return signedMessage;
}

function createSignedSecret(_secret, _signer) {
  let hexSecret = web3Utils.soliditySha3(_secret);
  const signedSecret = web3.eth.sign(_signer, hexSecret);
  assert.equal(signedSecret.length, 132);
  return signedSecret;
}

async function getVersion() {
  let v = await versioned.getVersion();
  return v;
}

async function getVersionMajorMinor() {
  let v = await versioned.getVersionMajorMinor();
  return v;
}

function convertToAVTDecimal(_oneAvtInUSCents, _amount) {
  return (_amount * (10**18)) / _oneAvtInUSCents;
}

const ganacheRevert = 'Error: VM Exception while processing transaction: revert';
const gethRevert = 'exited with an error (status 0)';

function getMultipleEventArgs(eventListenerFunction) {
  return new Promise((resolve, reject) => {
    let eventListener = eventListenerFunction({}, {fromBlock: lastEventBlockNumber + 1});
    return eventListener.get((error, log) => {
      if (error) {
        reject(error);
      } else if (log.length < 1) {
        reject("No logs present: ", log.length);
      } else {
        let lastEvent = log[log.length-1];
        lastEventBlockNumber = lastEvent.blockNumber;
        resolve(log.map(event => event.args));
      }
    });
  });
}

async function addAVTToFund(_amount, _sender, _fund) {
  if (_sender != getAccount(0)) {
    // Any other account will not have any AVT: give them what they need.
    await avt.transfer(_sender, _amount);
  }

  await avt.approve(aventusStorage.address, _amount, {from: _sender});
  await avtManager.deposit(_fund, _amount, {from: _sender});
}

async function withdrawAVTFromFund(_depositAmount, _withdrawer, _fund) {
  await avtManager.withdraw(_fund, _depositAmount, {from: _withdrawer});
}

// TODO: Move to eventsTestHelper.
function createVendorTicketProof(_eventId, _vendorTicketRefHash, _vendor, _buyer, _isPrimaryIntegrated) {
  let msgHash;
  if (_isPrimaryIntegrated) {
    msgHash = web3Utils.soliditySha3(_eventId, _vendorTicketRefHash, _buyer);
  } else {
    msgHash = web3Utils.soliditySha3(_eventId, _vendorTicketRefHash);
  }
  return createSignedMessage(_vendor, msgHash);
}

// TODO: Move to eventsTestHelper.
async function getFreeEventDepositUSCents() {
  return await aventusStorage.getUInt(web3Utils.soliditySha3("Events", "freeEventDepositAmountUSCents"));
}

// TODO: Move to eventsTestHelper.
async function getPaidEventDepositUSCents() {
  return await aventusStorage.getUInt(web3Utils.soliditySha3("Events", "paidEventDepositAmountUSCents"));
}

async function getOneAVTUSCents() {
  return await aventusStorage.getUInt(web3Utils.soliditySha3("OneAVTInUSCents"));
}

async function expectRevert(myFunc) {
  try {
    await myFunc();
    assert.fail("TEST FAILED");
  } catch (error) {
    assert(error.toString().includes(ganacheRevert) || error.toString().includes(gethRevert), "ERROR: " + error.toString());
  }
}

module.exports = {
    expectRevert,
    now: () => blockChainTime,
    getStorage: () => aventusStorage,
    getProposalsManager: () => proposalsManager,
    getAVTManager: () => avtManager,
    getAVTContract: () => avt,
    before,
    checkFundsEmpty,
    getAccount,
    useRealTime,
    useMockTime,
    getEventArgs: profiledEventArgs,
    advanceByDays,
    advanceTimeToVotingStart,
    advanceTimeToRevealingStart,
    advanceTimeToEndOfProposal,
    advanceTimeToEventOnSaleTime,
    advanceTimeToEventEnd,
    createSignedMessage,
    createSignedSecret,
    createVendorTicketProof,
    getFreeEventDepositUSCents,
    getOneAVTUSCents,
    getPaidEventDepositUSCents,
    getVersion,
    getVersionMajorMinor,
    convertToAVTDecimal,
    brokerMemberType,
    primaryMemberType,
    secondaryMemberType,
    tokenBondingCurveMemberType,
    scalingProviderMemberType,
    invalidMemberType,
    evidenceURL,
    getMultipleEventArgs,
    oneDay,
    oneAVT: ONE_AVT,
    addAVTToFund,
    withdrawAVTFromFund,
    profilingHelper,
}