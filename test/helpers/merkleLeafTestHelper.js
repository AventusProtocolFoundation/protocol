const merkleTreeHelper = require('../../utils/merkleTreeHelper');
const TransactionType = merkleTreeHelper.TransactionType;

let testHelper, sigmaHelper, eventsTestHelper, accounts;

async function init(_testHelper, _eventsTestHelper, _sigmaHelper, _accounts) {
  testHelper = _testHelper;
  eventsTestHelper = _eventsTestHelper;
  sigmaHelper = _sigmaHelper;
  accounts = _accounts;
}

async function createSaleLeaf() {
  const leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Sell);
  const eventId = (await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator)).toString();
  const propertiesProof = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Sell, leaf.mutableData.properties));
  const saleProof = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Sell, eventId, leaf.immutableData.ticketRef));

  leaf.immutableData.eventId = eventId;
  leaf.immutableData.vendor = accounts.eventOwner;
  leaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.eventOwner, accounts.ticketOwner,
      leaf.immutableData);
  leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [saleProof, propertiesProof]);
  return leaf;
}

async function createResaleLeaf(_previousLeaf, _previousLeafMerklePath) {
  const resellLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
      TransactionType.Resell);
  const ticketOwnerProof = await testHelper.sign(accounts.ticketOwner,
      testHelper.hash(TransactionType.Resell, resellLeaf.mutableData.prevLeafHash, accounts.eventOwner));
  const resellerProof = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Resell, ticketOwnerProof));
  resellLeaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);
  resellLeaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.eventOwner, accounts.ticketOwner,
      resellLeaf.immutableData);
  return resellLeaf;
}

async function createTransferLeaf(_previousLeaf, _previousLeafMerklePath) {
  const transferLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
      TransactionType.Transfer);
  transferLeaf.provenance = await testHelper.sign(accounts.ticketOwner,
      testHelper.hash(TransactionType.Transfer, transferLeaf.mutableData.prevLeafHash));
  transferLeaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.eventOwner, accounts.ticketOwner,
      transferLeaf.immutableData);
  return transferLeaf;
}

async function createUpdateLeaf(_previousLeaf, _previousLeafMerklePath) {
  const ticketId = 0;
  const updateLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
      TransactionType.Update);
  updateLeaf.mutableData.properties = 'My event | Doors 20:30 | Seat H' + ticketId;
  updateLeaf.provenance = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Update, updateLeaf.mutableData.prevLeafHash, updateLeaf.mutableData.properties));
  return updateLeaf;
}

async function createCancelLeaf(_previousLeaf, _previousLeafMerklePath) {
  const EMPTY_BYTES = '0x';
  const cancelLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
      TransactionType.Cancel);
  cancelLeaf.provenance = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Cancel, cancelLeaf.mutableData.prevLeafHash));
  cancelLeaf.mutableData.sigmaData = EMPTY_BYTES;
  return cancelLeaf;
}

async function createRedeemLeaf(_previousLeaf, _previousLeafMerklePath) {
  const redeemLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
      TransactionType.Redeem);
  redeemLeaf.provenance = await testHelper.sign(accounts.eventOwner,
      testHelper.hash(TransactionType.Redeem, redeemLeaf.mutableData.prevLeafHash));
  return redeemLeaf;
}

// Keep exports alphabetical
module.exports = {
  createCancelLeaf,
  createRedeemLeaf,
  createResaleLeaf,
  createSaleLeaf,
  createTransferLeaf,
  createUpdateLeaf,
  init
}