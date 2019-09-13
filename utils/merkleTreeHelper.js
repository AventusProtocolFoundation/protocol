const {MerkleTree} = require('merkletreejs');
const keccak256 = require('keccak256');

// NOTE; This must increment from zero and the order must match TransactionType in LMerkleLeafRules.
const TransactionType = {
  Sell: 0,
  Resell: 1,
  Transfer: 2,
  Cancel: 3,
  Redeem: 4,
  Update: 5,
  Bad: 6
}

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_BYTES = '0x';
const EMPTY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

function getBaseLeaf(_txType) {
  const sell = _txType === TransactionType.Sell;
  const resell = _txType === TransactionType.Resell;

  const eventId = 0;
  const ticketRef = 'Ticket ref';
  const vendor = EMPTY_ADDRESS;
  const immutableRulesData = web3.eth.abi.encodeParameters(['string', 'address[]'], ['', []]);

  const immutableData = {
    eventId,
    ticketRef,
    vendor,
    immutableRulesData
  }

  const snarkMerchantCommitment = EMPTY_BYTES;
  const snarkTicketOwnerCommitment = EMPTY_BYTES;
  const snarkProof = createDummySnarkProof(EMPTY_HASH, EMPTY_HASH);
  const snarkData = encodeSnarkData(snarkMerchantCommitment, snarkTicketOwnerCommitment, snarkProof);
  const mutableRulesData = web3.eth.abi.encodeParameters(['uint', 'uint'], [0, 0]);
  const prevLeafHash = sell ? EMPTY_HASH : web3.utils.randomHex(32);
  const prevMerklePath = sell ? [] : [web3.utils.randomHex(32)];
  const properties = 'properties';
  const mutableData = {
    snarkData,
    mutableRulesData,
    prevLeafHash,
    prevMerklePath,
    properties
  }

  const provenance = sell || resell ? web3.eth.abi.encodeParameters(['bytes', 'bytes'], [EMPTY_BYTES, EMPTY_BYTES]) :
      EMPTY_BYTES;

  return {
    txType: _txType,
    immutableData,
    mutableData,
    provenance
  }
}

function encodeImmutableData(_immutableData) {
  return web3.eth.abi.encodeParameters(['uint', 'string', 'address', 'bytes'],
    [_immutableData.eventId, _immutableData.ticketRef, _immutableData.vendor, _immutableData.immutableRulesData]);
}

function encodeMutableData(_mutableData) {
  return web3.eth.abi.encodeParameters(['bytes', 'bytes', 'bytes32', 'bytes32[]', 'string'],
      [_mutableData.snarkData, _mutableData.mutableRulesData, _mutableData.prevLeafHash, _mutableData.prevMerklePath,
          _mutableData.properties]);

}
function encodeLeaf(_leaf) {
  const immutableData = encodeImmutableData(_leaf.immutableData);
  const mutableData = encodeMutableData(_leaf.mutableData);
  return web3.eth.abi.encodeParameters(['uint', 'bytes', 'bytes', 'bytes'],
      [_leaf.txType, immutableData, mutableData, _leaf.provenance]);
}

function createModificationLeaf(_previousLeaf, _previousLeafMerklePath, _txType) {
  const prevLeafHash = web3.utils.soliditySha3(encodeLeaf(_previousLeaf));

  const modificationLeaf = JSON.parse(JSON.stringify(_previousLeaf)); // Deep clone
  modificationLeaf.txType = _txType;
  modificationLeaf.mutableData.prevLeafHash = prevLeafHash;
  modificationLeaf.mutableData.prevMerklePath = _previousLeafMerklePath;
  return modificationLeaf;
}

async function createDummySnarkData(_merchant, _ticketOwner) {
  const merchantHash = web3.utils.randomHex(32);
  const merchantCommitment = await web3.eth.sign(merchantHash, _merchant);
  const ticketOwnerHash = web3.utils.randomHex(32);
  const ticketOwnerCommitment = await web3.eth.sign(ticketOwnerHash, _ticketOwner);
  const snarkProof = createDummySnarkProof(merchantHash, ticketOwnerHash);

  return encodeSnarkData(merchantCommitment, ticketOwnerCommitment, snarkProof);
}

function encodeSnarkData(_merchantCommitment, _ticketOwnerCommitment, _snarkProof) {
  return web3.eth.abi.encodeParameters(['bytes', 'bytes', 'bytes'], [_merchantCommitment, _ticketOwnerCommitment, _snarkProof]);
}

/**
 * @return snarkProof, encoded as bytes
   snarkProof = {
     proof : {
       uint pairs for A, B, C, H, K, etc
     },
     input: ["0x0",  // MUST be ZERO
       merchantHash split into 8 uints,
       ticketOwnerHash split into 8 uints,
       merchantAddress as a little-endian byte ordered uint
       ticketOwnerAddress as a little-endian byte ordered uint]
    }
 */
function createDummySnarkProof(_merchantHash, _ownerHash) {
  return web3.eth.abi.encodeParameters(['uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]',
      'uint[2]', 'uint[2]', 'uint[2]', 'uint[]'], [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
      ['0x0', ...splitHashForInput(_merchantHash), ...splitHashForInput(_ownerHash), '0x0', '0x0']]);
}

function splitHashForInput(_hash) {
  return _hash.slice(2).match(/.{1,8}/g).map(el => '0x' + el);
}

function createTree(_dataLeaves) {
  const dataLeaves = Array.isArray(_dataLeaves) ? _dataLeaves : [_dataLeaves];
  const tree = new MerkleTree(dataLeaves, keccak256, {hashLeaves: true, sortPairs: true});
  return {
    leafData: dataLeaves[0],
    leafHash: '0x'+tree.leaves[0].toString('hex'),
    merklePath: tree.getHexProof(tree.leaves[0]),
    rootHash: tree.getHexRoot(),
    leaves: tree.getLeaves(),
    getMerklePath: (leaf, id) => tree.getHexProof(leaf, id)
  };
}

function createRandomTree(_treeDepth) {
  return createTree(Array(2 ** _treeDepth).fill().map(() => web3.utils.randomHex(32)));
}

function combinedHash(_first, _second) {
  if (!_first) { return _second; }
  if (!_second) { return _first; }

  if (_first < _second) {
    return web3.utils.soliditySha3(_first, _second);
  }
  return web3.utils.soliditySha3(_second, _first);
}

function getSubTreeMerkleProof(_leafHash, _merklePath, _subTreeSize) {
  const numSlicedLayers = _merklePath.length - _subTreeSize + 1;
  let leafHash = _leafHash;

  for (let i = 0; i < numSlicedLayers; i++) {
    leafHash = combinedHash(leafHash, _merklePath[i]);
  }
  return [leafHash, _merklePath.slice(numSlicedLayers)];
}

module.exports = {
  createDummySnarkData,
  createModificationLeaf,
  createRandomTree,
  createTree,
  encodeLeaf,
  getBaseLeaf,
  getSubTreeMerkleProof,
  TransactionType
}