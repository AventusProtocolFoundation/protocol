/**
 * @title MerkleRootsManagerTest.js
 * @dev Tests for MerkleRootsManager.sol
 * Adapted and expanded from version at:
 * https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/library/MerkleRootsManager.test.js
 */


const { MerkleProofTestHelper } = require("./helpers/MerkleProofTestHelper.js");
const web3Utils = require('web3-utils');

const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const maxTreeDepth = 16; // company-agreed max level
const expectedTreeDepth = 12; // company-agreed level of the functional merkle tree

contract("MerkleRootsManager - merkle proof", async () => {
  let merkleRootManager;

  before(async () => {
    merkleRootManager = await MerkleRootsManager.deployed();
  });

  // levels: number of levels in the tree, including the root level.
  // At level n, there are 2^n nodes
  // The first level is level 0
  function buildTreeElements (levels, seed) {
    let elements = [];

    if (!seed) {
      seed = 0;
    }

    for (var i = 1; i <= (Math.pow(2, levels-1) ); i++) {
      elements.push(i + seed);
    }
    return elements;
  }

  context("The generated merkle root", async () => {
    function initializeTree(numberOfLevels, leafIndex) {
      const elements = buildTreeElements(numberOfLevels);
      const merkleTree = new MerkleProofTestHelper(elements);
      const root = merkleTree.getRoot();
      const leaf = web3Utils.soliditySha3(elements[leafIndex]);

      return {merkleTree, root, leaf};
    }

    it("should be correct for a valid Merkle proof", async () => {
      let tree = initializeTree(expectedTreeDepth, 0);
      const path = tree.merkleTree.getMerklePath(tree.leaf);

      const generatedRoot = await merkleRootManager.generateMerkleRoot(path, tree.leaf);
      assert.equal(tree.root, generatedRoot, "Root was not correct for a valid proof");
    });

    it("should be correct for all leaves of a Merkle Tree", async () => {
      let numberOfLevels = 5;
      let numberOfLeaves = 2**(numberOfLevels - 1);

      const elements = buildTreeElements(numberOfLevels);
      const merkleTree = new MerkleProofTestHelper(elements);
      const root = merkleTree.getRoot();

      for (let i = 0; i < numberOfLeaves; i++) {
        let currentLeaf = elements[i];
        let hashedLeaf = web3Utils.soliditySha3(currentLeaf);
        let currentPath =  merkleTree.getMerklePath(hashedLeaf);
        let generatedRoot = await merkleRootManager.generateMerkleRoot(currentPath, hashedLeaf);
        assert.equal(root, generatedRoot, `Root was not correct for leaf ${currentLeaf}`);
      }
    });

    it("should be correct for a Merkle Tree of maximum level", async () => {
      let tree = initializeTree(maxTreeDepth, 0);
      const path = tree.merkleTree.getMerklePath(tree.leaf);

      const generatedRoot = await merkleRootManager.generateMerkleRoot(path, tree.leaf);
      assert.equal(tree.root, generatedRoot, "Root was not correct for a merkle tree of maximum level");
    });

    it("should be incorrect for an invalid Merkle path", async () => {
      let correctTree = initializeTree(expectedTreeDepth, 0);
      const badElements = buildTreeElements(expectedTreeDepth, 10);
      const badMerkleTree = new MerkleProofTestHelper(badElements);
      const badPath = badMerkleTree.getMerklePath(web3Utils.soliditySha3(badElements[0]));

      const generatedRoot = await merkleRootManager.generateMerkleRoot(badPath, correctTree.leaf);
      assert.notEqual(correctTree.root, generatedRoot, "Generated root should not be correct for an invalid path");
    });

    it("should be incorrect for a Merkle proof of invalid length", async () => {
      let tree = initializeTree(expectedTreeDepth, 0);
      const path = tree.merkleTree.getMerklePath(tree.leaf);
      const badPath = path.slice(0, path.length - 1);

      const generatedRoot = await merkleRootManager.generateMerkleRoot(badPath, tree.leaf);
      assert.notEqual(tree.root, generatedRoot, "Generated root should not be correct for path of invalid length");
    });

    it("should be incorrect for an empty Merkle path (and tree depth greater than 1)", async () => {
      let tree = initializeTree(expectedTreeDepth, 0);
      const badPath = [];

      const generatedRoot = await merkleRootManager.generateMerkleRoot(badPath, tree.leaf);
      assert.notEqual(tree.root, generatedRoot, "Generated root should not be correct for an empty proof");
    });
  });
});