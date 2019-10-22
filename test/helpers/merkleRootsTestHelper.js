const merkleTreeHelper = require('../../utils/merkleTreeHelper');

let testHelper, avtTestHelper, timeTestHelper, merkleRootsManager;

let rootDeposit;

const treeContentURL = 'ipfs.io/ipfs/Qmc2ZFNuVemgyRZrMSfzSYZWnZQMsznnW8drMz3UhaiBVv';

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;
  merkleRootsManager = testHelper.getMerkleRootsManager();

  // Mirrors value in parameter registry
  rootDeposit = avtTestHelper.toAttoAVT(new testHelper.BN(200));
}

async function createAndRegisterMerkleTree(_encodedLeaves, _validator) {
  const tree = merkleTreeHelper.createTree(_encodedLeaves);
  const root = await depositAndRegisterMerkleRoot(_validator, tree.rootHash);
  return { ...tree, ...root };
}

async function depositAndRegisterMerkleRoot(_validator, _rootHash) {
  const rootHash = _rootHash || testHelper.randomBytes32();
  const deposit = await merkleRootsManager.getNewMerkleRootDeposit();
  await avtTestHelper.addAVT(deposit, _validator);
  await merkleRootsManager.registerMerkleRoot(rootHash, treeContentURL, {from: _validator});

  return { rootHash, deposit };
}

async function advanceTimeAndUnlockMerkleRootDeposit(_rootHash) {
  await advanceToDepositUnlockTime(_rootHash);
  return merkleRootsManager.unlockMerkleRootDeposit(_rootHash);
}

async function advanceTimeUnlockAndWithdrawRootDeposit(_rootHash, _validator, _deposit) {
  await advanceTimeAndUnlockMerkleRootDeposit(_rootHash);
  return avtTestHelper.withdrawAVT(_deposit, _validator);
}

async function advanceToDepositUnlockTime(_rootHash) {
  const rootDeregistrationtime = await merkleRootsManager.getMerkleRootDepositUnlockTime(_rootHash);
  return timeTestHelper.advanceToTime(rootDeregistrationtime);
}

// Keep exports alphabetical
module.exports = {
  advanceTimeAndUnlockMerkleRootDeposit,
  advanceTimeUnlockAndWithdrawRootDeposit,
  advanceToDepositUnlockTime,
  createAndRegisterMerkleTree,
  depositAndRegisterMerkleRoot,
  getRootDeposit: () => rootDeposit,
  init,
}