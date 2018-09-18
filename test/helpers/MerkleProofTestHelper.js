/**
 * @title MerkleProofTestHelper.js
 * @dev Helper functions to assist in the creation of tests for the Merkle Tree Proof
 * https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/helpers/merkleTree.js
 */


const web3Utils = require('web3-utils');

//TODO: Turn this into a context and move to MerkleRootsManagerProofTest
class MerkleProofTestHelper {
  constructor (elements) {
    // Filter empty strings and hash elements
    this.elements = elements.filter(el => el).map(el => web3Utils.soliditySha3(el));

    // Sort elements
    this.elements.sort();

    // Create layers
    this.layers = this.getLayers(this.elements);
  }

  getElements () {
    return this.elements.length;
  }

  getLayers (elements) {
    if (elements.length === 0) {
      return [['']];
    }

    const layers = [];
    layers.push(elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  getNextLayer (elements) {
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(this.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, []);
  }

  combinedHash (first, second) {
    if (!first) { return second; }
    if (!second) { return first; }

    if (first < second) {
      return web3Utils.soliditySha3(first, ":", second);
    }
    return web3Utils.soliditySha3(second, ":", first);
  }

  getRoot () {
    return this.layers[this.layers.length - 1][0];
  }

  getMerklePath (el) {
    let idx = this.elements.indexOf(el);

    if (idx === -1) {
      throw new Error("Element does not exist in Merkle tree");
    }

    return this.layers.reduce((path, layer) => {
      const pairElement = this.getPairElement(idx, layer);

      if (pairElement) {
        path.push(pairElement);
      }

      idx = Math.floor(idx / 2);

      return path;
    }, []);
  }

  getPairElement (idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (pairIdx < layer.length) {
      return layer[pairIdx];
    } else {
      return null;
    }
  }
}

module.exports = {
  MerkleProofTestHelper,
};