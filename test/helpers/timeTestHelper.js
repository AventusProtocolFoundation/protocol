const LAventusTime = artifacts.require('LAventusTime');
const LAventusTimeMock = artifacts.require('LAventusTimeMock');
const TimeMachine = artifacts.require('TimeMachine');
const profilingHelper = require('./profilingHelper');

let testHelper, timeMachine;
let mockTimeKey;
let blockchainTime = new web3.utils.BN(0);

const challengeWindow = new web3.utils.BN(20 * 60);
// one day in seconds
const oneDay = new web3.utils.BN(24 * 60 * 60);
const oneWeek = oneDay.mul(new web3.utils.BN(7));

async function init(_testHelper) {
  testHelper = _testHelper;
  timeMachine = await TimeMachine.deployed();
  blockchainTime = await timeMachine.getCurrentTime();
}

async function advanceToTime(_timestamp) {
  blockchainTime = _timestamp;
  return timeMachine.advanceToTime(_timestamp);
}

async function advanceByNumDays(_numDays) {
  const timeToAdvance = oneDay.mul(new web3.utils.BN(_numDays));
  const timestamp = blockchainTime.add(timeToAdvance);
  await advanceToTime(timestamp);
}

async function advancePastChallengeWindow() {
  const timestamp = blockchainTime.add(challengeWindow);
  await advanceToTime(timestamp);
}

// Keep exports alphabetical.
module.exports = {
  advanceByNumDays,
  advancePastChallengeWindow,
  advanceToTime,
  init,
  now: () => blockchainTime,
  oneDay,
  oneWeek
};