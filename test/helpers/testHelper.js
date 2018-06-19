const AventusStorage = artifacts.require("AventusStorage.sol");
const AventusVote = artifacts.require("AventusVote.sol");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const web3Utils = require('web3-utils');

const oneDay = 86400;    // seconds in one day.
const oneWeek = 7 * oneDay;
const mockTimeKey = web3.sha3("MockCurrentTime");

let blockChainTime = new web3.BigNumber(0);
let aventusStorage, avtAddress, aventusVote;
let lastEventBlockNumber = -1;

async function before() {
  aventusStorage = await AventusStorage.deployed();
  avtAddress = await aventusStorage.getAddress(web3.sha3("AVT"));
  aventusVote = await AventusVote.deployed();
  blockChainTime = new web3.BigNumber(web3.eth.getBlock(web3.eth.blockNumber).timestamp);
  await useMockTime();
  lastEventBlockNumber = -1;
}

// Call this from your after() method as standard. Switch to afterEach to debug any issues.
async function checkFundsEmpty(alsoCheckStakes) {
  for (let i = 0; i < 5; ++i) {
    checkFundIsEmpty('deposit', i);
    if (alsoCheckStakes) checkFundIsEmpty('stake', i);
  }
  let lockBalance = await aventusStorage.getUInt(web3.sha3("LockBalance"));
  assert.equal(lockBalance.toNumber(), 0, "Total balance not cleared");
}

async function checkFundIsEmpty(fund, accountNum) {
  const depositBalance = (await aventusVote.getBalance(fund, getAccount(accountNum))).toNumber();
  assert.equal(0, depositBalance, (fund + " account " + accountNum + " has AVT"));
}

function getAccount(id) {
  return web3.eth.accounts[id];
}

async function useMockTime() {
  let mockTimeInstance = await LAventusTimeMock.deployed();
  await aventusStorage.setAddress(web3.sha3("LAventusTimeInstance"), mockTimeInstance.address);
  await aventusStorage.setUInt(mockTimeKey, blockChainTime);
}

async function setMockTime(_timeStamp) {
 await aventusStorage.setUInt(mockTimeKey, _timeStamp);
 blockChainTime = await aventusStorage.getUInt(mockTimeKey);
}

async function advanceByDays(days) {
  let currentTime = await aventusStorage.getUInt(mockTimeKey);
  await advanceToTime(currentTime.plus(days * oneDay));
}

async function advanceToTime(_timeStamp) {
 let currentTime = await aventusStorage.getUInt(mockTimeKey);
 assert(_timeStamp >= currentTime);
 await setMockTime(_timeStamp);
}
async function advanceToProposalPeriod(_proposalId, _period) {
  const periodKey = web3Utils.soliditySha3("Proposal", _proposalId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await advanceToTime(parseInt(period));
}
async function advanceTimeToVotingStart(_proposalId) { await advanceToProposalPeriod(_proposalId, "votingStart"); }
async function advanceTimeToRevealingStart(_proposalId) { await advanceToProposalPeriod(_proposalId, "revealingStart"); }
async function advanceTimeToEndOfProposal(_proposalId) { await advanceToProposalPeriod(_proposalId, "revealingEnd"); }

async function advanceToEventPeriod(_eventId, _period) {
  const periodKey = web3Utils.soliditySha3("Event", _eventId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await advanceToTime(parseInt(period));
}
async function advanceTimeToEventTicketSaleStart(_eventId) { await advanceToEventPeriod(_eventId, "ticketSaleStartTime"); }
async function advanceTimeToEventEnd(_eventId) { await advanceToEventPeriod(_eventId, "eventTime"); }

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
        reject("Duplicate events: ", log.length);
      }
    });
  });
}

function createSignedMessage(_signer, _keccak256Msg) {
  const signedMessage = web3.eth.sign(_signer, _keccak256Msg);
  assert.equal(signedMessage.length, 132);
  return signedMessage;
}

const ganacheRevert = 'Error: VM Exception while processing transaction: revert';
const gethRevert = 'exited with an error (status 0)';

module.exports = {
    expectRevert: async (myFunc) => {
        try {
            await myFunc();
            assert.fail("TEST FAILED");
        } catch (error) {
            assert(
              error.toString().includes(ganacheRevert) ||
              error.toString().includes(gethRevert),
              "Was not expecting: " + error.toString());
        }
    },

    now: () => blockChainTime,
    getStorage: () => aventusStorage,

    before,
    checkFundsEmpty,
    getAccount,
    getEventArgs,
    advanceByDays,
    advanceTimeToVotingStart,
    advanceTimeToRevealingStart,
    advanceTimeToEndOfProposal,
    advanceTimeToEventTicketSaleStart,
    advanceTimeToEventEnd,
    createSignedMessage,

    getAVTAddress: () => avtAddress
}
