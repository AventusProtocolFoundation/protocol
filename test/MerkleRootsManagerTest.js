const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const MembersManager = artifacts.require("MembersManager");
const testHelper = require("./helpers/testHelper");
const web3Utils = require('web3-utils');

contract('MerkleRootsManager - de/registration', async () => {
  let merkleRootsManager, membersManager;
  let depositForScalingProvider;
  let depositForMerkleRoot;
  const defaultRootHash = web3Utils.soliditySha3("I am Merkle Root");
  const scalingProvider = testHelper.getAccount(1);
  const alternateScalingProvider = testHelper.getAccount(2);
  const notAScalingProvider = testHelper.getAccount(3);

  before(async () => {
    await testHelper.before();
    merkleRootsManager = await MerkleRootsManager.deployed();
    membersManager = await MembersManager.deployed();

    depositForScalingProvider = await membersManager.getNewMemberDeposit(testHelper.scalingProviderMemberType);
    depositForMerkleRoot = await merkleRootsManager.getNewMerkleRootDeposit();

    await registerScalingProviderSucceeds(scalingProvider);
  });

  after(async () => {
    await deregisterScalingProviderSucceeds(scalingProvider);

    await testHelper.checkFundsEmpty();
  });

  async function registerScalingProviderSucceeds(_address) {
    await testHelper.addAVTToFund(depositForScalingProvider, _address, "deposit");
    await membersManager.registerMember(_address, testHelper.scalingProviderMemberType, testHelper.evidenceURL, "Registering scalingProvider");
  }

  async function deregisterScalingProviderSucceeds(_address) {
    await membersManager.deregisterMember(_address, testHelper.scalingProviderMemberType);
    await testHelper.withdrawAVTFromFund(depositForScalingProvider, _address, "deposit");
  }

  async function registerMerkleRootSucceeds(_ownerAddress, _rootHash) {
    await testHelper.addAVTToFund(depositForMerkleRoot, _ownerAddress, "deposit");
    await merkleRootsManager.registerMerkleRoot(_ownerAddress, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash);

    // check that this action was properly logged
    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootRegistered);

    assert.equal(eventArgs.rootHash, _rootHash, "wrong hash");
    assert.equal(eventArgs.ownerAddress, _ownerAddress, "wrong owner address");
    assert.equal(eventArgs.deposit.toNumber(), depositForMerkleRoot.toNumber(), "wrong deposit");
  }

  async function registerMerkleRootFails(_ownerAddress, _rootHash) {
    await testHelper.addAVTToFund(depositForMerkleRoot, _ownerAddress, "deposit");
    await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(_ownerAddress, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash));
    await testHelper.withdrawAVTFromFund(depositForMerkleRoot, _ownerAddress, "deposit");
  }

  async function deregisterMerkleRootSucceeds(_ownerAddress, _rootHash) {
    await merkleRootsManager.deregisterMerkleRoot(_rootHash, {from: _ownerAddress});
    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootDeregistered);
    assert.equal(eventArgs.rootHash, _rootHash, "wrong Merkle Root hash");
    await testHelper.withdrawAVTFromFund(depositForMerkleRoot, _ownerAddress, "deposit");
  }

  async function deregisterMerkleRootFails(_address, _rootHash) {
    await testHelper.expectRevert(() => merkleRootsManager.deregisterMerkleRoot(_rootHash, {from: _address}));
  }

  context("A successfully registered Merkle root", async () => {

    beforeEach(async () => {
      await registerMerkleRootSucceeds(scalingProvider, defaultRootHash);
    });

    it("can be deregistered", async () => {
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
    });

    it("cannot be deregistered if it has already been deregistered", async () => {
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
      await deregisterMerkleRootFails(scalingProvider, defaultRootHash);
    });

    it("can only be deregistered by its owner", async () => {
      await deregisterMerkleRootFails(alternateScalingProvider, defaultRootHash);
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
    });

    it("can only be deregistered if it exists", async () => {
      const nonExistingHash = web3Utils.soliditySha3("I do not exist");
      await deregisterMerkleRootFails(scalingProvider, nonExistingHash);

      // Clean up
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
    });

  });

  context("A Merkle root cannot be registered", async () => {

    it("if owner does not have enough deposit", async () => {
      // Scaling provider doesn't have any AVT, so registration should fail
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(scalingProvider, testHelper.evidenceURL, "Registering a MerkleRoot", defaultRootHash));
      await registerMerkleRootSucceeds(scalingProvider, defaultRootHash);
      // Clean up
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
    });

    it("if owner is not registered as a scaling provider", async () => {
      await deregisterScalingProviderSucceeds(scalingProvider);
      await registerMerkleRootFails(scalingProvider, defaultRootHash);

      // Restore setup state
      await registerScalingProviderSucceeds(scalingProvider);
    });

    it("if it is already registered with the same hash", async () => {
      await registerMerkleRootSucceeds(scalingProvider, defaultRootHash);
      await registerMerkleRootFails(scalingProvider, defaultRootHash);

      let differentHash = web3Utils.soliditySha3("I am a different Merkle Root");
      await registerMerkleRootSucceeds(scalingProvider, differentHash);

      // clean up
      await deregisterMerkleRootSucceeds(scalingProvider, defaultRootHash);
      await deregisterMerkleRootSucceeds(scalingProvider, differentHash);
    });

    it("if sender is not a scaling provider", async () => {
      await testHelper.addAVTToFund(depositForScalingProvider, notAScalingProvider, "deposit");
      await registerMerkleRootFails(notAScalingProvider, defaultRootHash);

      await registerScalingProviderSucceeds(notAScalingProvider);
      await registerMerkleRootSucceeds(notAScalingProvider, defaultRootHash);

      await deregisterMerkleRootSucceeds(notAScalingProvider, defaultRootHash);
      await deregisterScalingProviderSucceeds(notAScalingProvider);
      await testHelper.withdrawAVTFromFund(depositForScalingProvider, notAScalingProvider, "deposit");
    });

  });

});

