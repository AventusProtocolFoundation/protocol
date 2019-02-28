let testHelper, avtTestHelper, timeTestHelper, merkleRootsManager, aventusStorage;

// Mirrors value in parameter registry
const coolingOffPeriodDays = 14;
let deposits;

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;
  merkleRootsManager = testHelper.getMerkleRootsManager();
  aventusStorage = testHelper.getAventusStorage();

  // Mirrors values in parameter registry
  deposits = {
    base: avtTestHelper.toNat(new testHelper.BN(100)),
    multiplier: avtTestHelper.oneAVTTo18SigFig.div(new testHelper.BN(25000))
  }
}

async function depositAndRegisterMerkleRoot(_validator, _rootHash, _treeDepth, _lastEventTime) {
  const rootHash = _rootHash || testHelper.randomBytes32();
  const treeDepth = _treeDepth || 10;
  const lastEventTime = _lastEventTime || timeTestHelper.now().add(timeTestHelper.oneWeek);
  const deposit = await merkleRootsManager.getNewMerkleRootDeposit(treeDepth, lastEventTime);
  await avtTestHelper.addAVT(deposit, _validator);
  await merkleRootsManager.registerMerkleRoot(rootHash, treeDepth, lastEventTime, {from: _validator});

  return { rootHash, deposit };
}

async function advanceTimeAndDeregisterMerkleRoot(_rootHash) {
  await advanceTimeToCoolingOffPeriodEnd(_rootHash);
  await merkleRootsManager.deregisterMerkleRoot(_rootHash);
}

async function advanceTimeDeregisterRootAndWithdrawDeposit(_rootHash, _validator, _deposit) {
  await advanceTimeAndDeregisterMerkleRoot(_rootHash);
  await avtTestHelper.withdrawAVT(_deposit, _validator);
}

async function advanceTimeToCoolingOffPeriodEnd(_rootHash) {
  const lastEventTimeKey = testHelper.hash('MerkleRoot', _rootHash, 'lastEventTime');
  const lastEventTime = await aventusStorage.getUInt(lastEventTimeKey);
  const coolingOffPeriodSeconds = timeTestHelper.oneDay.mul(new testHelper.BN(coolingOffPeriodDays));
  await timeTestHelper.advanceToTime(lastEventTime.add(coolingOffPeriodSeconds));
}

// Keep exports alphabetical
module.exports = {
  advanceTimeAndDeregisterMerkleRoot,
  advanceTimeDeregisterRootAndWithdrawDeposit,
  advanceTimeToCoolingOffPeriodEnd,
  depositAndRegisterMerkleRoot,
  getBaseDeposit: () => deposits.base,
  getDepositMultiplier: () => deposits.multiplier,
  init,
}