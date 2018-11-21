// Based on  https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/helpers/merkleTree.js

let leaves, layers;
let testHelper;

async function init(_testHelper) {
  testHelper = _testHelper;
}

function createTree(_numberOfLevels, _leafData) {
  leaves = createLeaves(_numberOfLevels, _leafData);
  layers = getLayers(leaves);
  const leafHash = testHelper.hash(..._leafData);
  const merklePath = getMerklePath(leafHash);
  const rootHash = getRoot();
  return {merklePath, rootHash, leafHash, leaves};
}

function createLeaves(_levels, _leafData) {
  let elements = [];
  elements.push(_leafData);

  for (let i = 1; i < (Math.pow(2, _levels-1) ); i++) {
    elements.push([i]);
  }

  elements = elements.filter(el => el.length > 0).map(el => testHelper.hash(...el));
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
    return testHelper.hash(_first, _second);
  }
  return testHelper.hash(_second, _first);
}

function getRoot() {
  return layers[layers.length - 1][0];
}

function getMerklePath(_element) {
  let idx = leaves.indexOf(_element);

  if (idx === -1) {
    throw new Error('Element does not exist in Merkle tree');
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

function getPairElement(_idx, _layer) {
  const pairIdx = _idx % 2 === 0 ? _idx + 1 : _idx - 1;

  if (pairIdx < _layer.length) {
    return _layer[pairIdx];
  } else {
    return null;
  }
}

// Keep exports alphabetical.
module.exports = {
  createTree,
  getMerklePath,
  init,
};