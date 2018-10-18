/**
 * @title merkleProofTestHelper.js
 * @dev Helper functions to assist in the creation of tests for the Merkle Tree Proof
 * Based on  https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/helpers/merkleTree.js
 */
const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const web3Utils = require('web3-utils');

let leaves, layers;
let testHelper, merkleRootsManager;

async function before(_testHelper) {
  testHelper = _testHelper;
  merkleRootsManager = await MerkleRootsManager.deployed();
  merkleRootsManager = testHelper.profilingHelper.profileContract(merkleRootsManager, "merkleRootsManager");
};


function createTree(numberOfLevels, leafData) {
  leaves = createLeaves(numberOfLevels, leafData);
  layers = getLayers(leaves);
  const leafHash = web3Utils.soliditySha3(...leafData);
  const merklePath = getMerklePath(leafHash);
  const rootHash = getRoot();
  return {merklePath, rootHash, leafHash, leaves};
}

function createLeaves(levels, leafData) {
  let elements = [];
  elements.push(leafData);

  for (var i = 1; i < (Math.pow(2, levels-1) ); i++) {
    elements.push([i]);
  }

  elements = elements.filter(el => el.length > 0).map(el => web3Utils.soliditySha3(...el));
  elements.sort();
  return elements;
}

function getLayers(_elements) {
  if (_elements.length === 0) {
    return [['']];
  }

  const layers = [];
  layers.push(_elements);

  // Get next layer until we reach the root
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1]));
  }

  return layers;
}

function getNextLayer(_elements) {
  return _elements.reduce((layer, el, idx, arr) => {
    if (idx % 2 === 0) {
      // Hash the current element with its pair element
      layer.push(combinedHash(el, arr[idx + 1]));
    }

    return layer;
  }, []);
}

function combinedHash(_first, _second) {
  if (!_first) { return _second; }
  if (!_second) { return _first; }

  if (_first < _second) {
    return web3Utils.soliditySha3(_first, _second);
  }
  return web3Utils.soliditySha3(_second, _first);
}

function getRoot() {
  return layers[layers.length - 1][0];
}

function getMerklePath(_element) {
  let idx = leaves.indexOf(_element);

  if (idx === -1) {
    throw new Error("Element does not exist in Merkle tree");
  }

  return layers.reduce((path, layer) => {
    const pairElement = getPairElement(idx, layer);

    if (pairElement) {
      path.push(pairElement);
    }

    idx = Math.floor(idx / 2);

    return path;
  }, []);
}

function getPairElement(idx, layer) {
  const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

  if (pairIdx < layer.length) {
    return layer[pairIdx];
  } else {
    return null;
  }
}

module.exports = {
  getMerkleRootsManager: () => merkleRootsManager,

  before,
  createTree,
  getMerklePath
};