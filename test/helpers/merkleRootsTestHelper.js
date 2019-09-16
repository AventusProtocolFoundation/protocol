const merkleTreeHelper = require('../../utils/merkleTreeHelper');

let testHelper, avtTestHelper, timeTestHelper, merkleRootsManager;

let deposits;

const treeContentURL = 'ipfs.io/ipfs/Qmc2ZFNuVemgyRZrMSfzSYZWnZQMsznnW8drMz3UhaiBVv';

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;
  merkleRootsManager = testHelper.getMerkleRootsManager();

  // Mirrors values in parameter registry
  deposits = {
    base: avtTestHelper.toNat(new testHelper.BN(100)),
    multiplier: avtTestHelper.oneAVTTo18SigFig.div(new testHelper.BN(25000))
  }
}

async function createAndRegisterMerkleTree(_encodedLeaves, _validator) {
  const tree = merkleTreeHelper.createTree(_encodedLeaves);
  const root = await depositAndRegisterMerkleRoot(_validator, tree.rootHash, 2);
  return { ...tree, ...root };
}

async function depositAndRegisterMerkleRoot(_validator, _rootHash, _treeDepth, _rootExpiryTime) {
  const rootHash = _rootHash || testHelper.randomBytes32();
  const treeDepth = _treeDepth || 10;
  const rootExpiryTime = _rootExpiryTime || timeTestHelper.now().add(timeTestHelper.oneWeek);
  const deposit = await merkleRootsManager.getNewMerkleRootDeposit(treeDepth, rootExpiryTime);
  await avtTestHelper.addAVT(deposit, _validator);
  await merkleRootsManager.registerMerkleRoot(rootHash, treeDepth, rootExpiryTime, treeContentURL, {from: _validator});

  return { rootHash, deposit };
}

async function advanceTimeAndDeregisterMerkleRoot(_rootHash) {
  await advanceToDeregistrationTime(_rootHash);
  return merkleRootsManager.deregisterMerkleRoot(_rootHash);
}

async function advanceTimeDeregisterRootAndWithdrawDeposit(_rootHash, _validator, _deposit) {
  await advanceTimeAndDeregisterMerkleRoot(_rootHash);
  return avtTestHelper.withdrawAVT(_deposit, _validator);
}

async function advanceToDeregistrationTime(_rootHash) {
  const rootDeregistrationtime = await merkleRootsManager.getMerkleRootDeregistrationTime(_rootHash);
  return timeTestHelper.advanceToTime(rootDeregistrationtime);
}

async function autoChallengeTreeDepth(_leafHash, _merklePath, _challenger) {
  return merkleRootsManager.autoChallengeTreeDepth(_leafHash, _merklePath, {from: _challenger});
}

// Keep exports alphabetical
module.exports = {
  advanceTimeAndDeregisterMerkleRoot,
  advanceTimeDeregisterRootAndWithdrawDeposit,
  advanceToDeregistrationTime,
  autoChallengeTreeDepth,
  createAndRegisterMerkleTree,
  depositAndRegisterMerkleRoot,
  getBaseDeposit: () => deposits.base,
  getDepositMultiplier: () => deposits.multiplier,
  init,
}