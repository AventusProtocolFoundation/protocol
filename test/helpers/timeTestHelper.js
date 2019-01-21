const LAventusTime = artifacts.require('LAventusTime');
const LAventusTimeMock = artifacts.require('LAventusTimeMock');
const profilingHelper = require('./profilingHelper');

let testHelper, realTimeInstance, mockTimeInstance, aventusStorage;
let mockTimeKey;
let blockChainTime = new web3.utils.BN(0);

// one day in seconds
const oneDay = new web3.utils.BN(24 * 60 * 60);
const oneWeek = oneDay.mul(new web3.utils.BN(7));

async function init(_testHelper) {
  testHelper = _testHelper;

  aventusStorage = testHelper.getAventusStorage();

  mockTimeKey = testHelper.hash('MockCurrentTime');
  const block = await web3.eth.getBlock('latest');
  blockChainTime = new web3.utils.BN(block.timestamp);

  realTimeInstance = await LAventusTime.deployed();
  realTimeInstance = profilingHelper.profileContract(realTimeInstance, 'realTimeInstance');
  mockTimeInstance = await LAventusTimeMock.deployed();
  mockTimeInstance = profilingHelper.profileContract(mockTimeInstance, 'mockTimeInstance');

  await initMockTime(blockChainTime);
}

async function advanceToTime(_timestamp) {
  let currentTime = await aventusStorage.getUInt(mockTimeKey);
  assert(_timestamp >= currentTime);
  await setMockTime(_timestamp);
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

async function getTimeKey() {
  const versionMajorMinor = await testHelper.getVersionMajorMinor();
  return testHelper.hash('LAventusTimeInstance' + '-' + versionMajorMinor);
}

async function advanceByNumDays(_numDays) {
  const currentTime = await aventusStorage.getUInt(mockTimeKey);
  const timeToAdvance = oneDay.mul(new web3.utils.BN(_numDays));
  const timestamp = currentTime.add(timeToAdvance);
  await setMockTime(timestamp);
}

// Keep exports alphabetical.
module.exports = {
  advanceByNumDays,
  advanceToTime,
  init,
  now: () => blockChainTime,
  oneDay,
  oneWeek,
  useRealTime,
  useMockTime
};