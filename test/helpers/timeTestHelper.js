const LAventusTime = artifacts.require('LAventusTime');
const LAventusTimeMock = artifacts.require('LAventusTimeMock');
const profilingHelper = require('./profilingHelper');

let testHelper, realTimeInstance, mockTimeInstance, aventusStorage;
let mockTimeKey;
let blockChainTime = new web3.BigNumber(0);

// one day in seconds
const oneDay = 24 * 60 * 60;
const oneWeek = oneDay * 7;

async function init(_testHelper) {
  testHelper = _testHelper;

  aventusStorage = testHelper.getAventusStorage();

  mockTimeKey = testHelper.hash('MockCurrentTime');
  blockChainTime = new web3.BigNumber(web3.eth.getBlock(web3.eth.blockNumber).timestamp);

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

// Keep exports alphabetical.
module.exports = {
  advanceToTime,
  init,
  now: () => blockChainTime,
  oneDay,
  oneWeek,
  useRealTime,
  useMockTime
};