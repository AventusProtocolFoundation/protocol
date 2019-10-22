const {MerkleTree} = require('merkletreejs');
const keccak256 = require('keccak256');
const web3Tools = require('./web3Tools.js');

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
  const immutableRulesData = web3Tools.encodeParams(['string', 'address[]'], ['', []]);

  const immutableData = {
    eventId,
    ticketRef,
    vendor,
    immutableRulesData
  }

  const sigmaData = createDummySigmaData();
  const mutableRulesData = web3Tools.encodeParams(['uint', 'uint'], [0, 0]);
  const prevLeafHash = sell ? EMPTY_HASH : web3Tools.randomBytes32();
  const prevMerklePath = sell ? [] : [web3Tools.randomBytes32()];
  const properties = 'properties';
  const mutableData = {
    sigmaData,
    mutableRulesData,
    prevLeafHash,
    prevMerklePath,
    properties
  }

  const provenance = sell || resell ? web3Tools.encodeParams(['bytes', 'bytes'], [EMPTY_BYTES, EMPTY_BYTES]) :
      EMPTY_BYTES;

  return {
    txType: _txType,
    immutableData,
    mutableData,
    provenance
  }
}

function encodeImmutableData(_immutableData) {
  return web3Tools.encodeParams(['uint', 'string', 'address', 'bytes'],
    [_immutableData.eventId, _immutableData.ticketRef, _immutableData.vendor, _immutableData.immutableRulesData]);
}

function encodeMutableData(_mutableData) {
  return web3Tools.encodeParams(['bytes', 'bytes', 'bytes32', 'bytes32[]', 'string'],
      [_mutableData.sigmaData, _mutableData.mutableRulesData, _mutableData.prevLeafHash, _mutableData.prevMerklePath,
          _mutableData.properties]);
}

function encodeLeaf(_leaf) {
  const immutableData = encodeImmutableData(_leaf.immutableData);
  const mutableData = encodeMutableData(_leaf.mutableData);
  return web3Tools.encodeParams(['uint', 'bytes', 'bytes', 'bytes'],
      [_leaf.txType, immutableData, mutableData, _leaf.provenance]);
}

function createModificationLeaf(_previousLeaf, _previousLeafMerklePath, _txType) {
  const prevLeafHash = web3Tools.hash(encodeLeaf(_previousLeaf));

  const modificationLeaf = JSON.parse(JSON.stringify(_previousLeaf)); // Deep clone
  modificationLeaf.txType = _txType;
  modificationLeaf.mutableData.prevLeafHash = prevLeafHash;
  modificationLeaf.mutableData.prevMerklePath = _previousLeafMerklePath;
  return modificationLeaf;
}

function createDummySigmaData() {
  const dummySigmaProof = web3Tools.encodeParams(['uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]',
      'uint[2]'], [[0,0], [0,0], [0,0], [0,0], [0,0], [0,0], [0,0]]);
  return web3Tools.encodeParams(['bytes', 'bytes', 'bytes'], [EMPTY_BYTES, EMPTY_BYTES, dummySigmaProof]);
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

function combinedHash(_first, _second) {
  if (!_first) { return _second; }
  if (!_second) { return _first; }

  if (_first < _second) {
    return web3Tools.hash(_first, _second);
  }
  return web3Tools.hash(_second, _first);
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
  createModificationLeaf,
  createTree,
  encodeLeaf,
  getBaseLeaf,
  getSubTreeMerkleProof,
  TransactionType
}