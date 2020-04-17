const TimeMachine = artifacts.require('TimeMachine');
const profilingHelper = require('./profilingHelper');

let testHelper, timeMachine;
let mockTimeKey;
let blockchainTime = new web3.utils.BN(0);

const oneMinute = new web3.utils.BN(60);
const oneDay = new web3.utils.BN(24 * 60 * 60);
const oneWeek = new web3.utils.BN(7 * 24 * 60 * 60);

async function init(_testHelper) {
  testHelper = _testHelper;
  timeMachine = await TimeMachine.deployed();
  blockchainTime = await timeMachine.getCurrentTime();
}

async function advanceToTime(_timestamp) {
  blockchainTime = _timestamp;
  return timeMachine.advanceToTime(_timestamp);
}

async function advanceByOneMinute() {
  const timestamp = blockchainTime.add(oneMinute);
  await advanceToTime(timestamp);
}

// Keep exports alphabetical.
module.exports = {
  advanceByOneMinute,
  advanceToTime,
  init,
  now: () => blockchainTime,
  oneDay,
  oneWeek
};