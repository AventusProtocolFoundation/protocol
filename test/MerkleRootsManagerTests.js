const testHelper = require('./helpers/testHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

contract('MerkleRootsManager', async () => {
  let merkleRootsManager;
  let hashCount = 0;
  const accounts = testHelper.getAccounts('scalingProvider', 'alternateScalingProvider');
  const scalingProviderType = membersTestHelper.memberTypes.scalingProvider;

  const goodScalingProvider = accounts.scalingProvider;
  const goodOwnerAddress = accounts.scalingProvider;
  const goodSender = goodOwnerAddress;
  const badSender = accounts.alternateScalingProvider;

  before(async () => {
    await testHelper.init();
    await merkleProofTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    await membersTestHelper.depositAndRegisterMember(goodScalingProvider, scalingProviderType);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodScalingProvider, scalingProviderType);
    await avtTestHelper.checkFundsEmpty(accounts, false);
  });

  function goodUniqueRootHash() {
    return testHelper.hash('this is hash number ' + ++hashCount);
  }

  context('registerMerkleRoot()', async () => {
    async function registerMerkleRootSucceeds() {
      const goodRootHash = goodUniqueRootHash();
      await merkleRootsManager.registerMerkleRoot(goodOwnerAddress, goodRootHash, {from: goodSender});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager.LogMerkleRootRegistered);
      assert.equal(logArgs.ownerAddress, goodOwnerAddress);
      assert.equal(logArgs.rootHash, goodRootHash);
      assert.equal(logArgs.deposit.toNumber(), 0);
    }

    // No such thing as a bad rootHash as we do not know anything about the data in the root nor what can give a zero hash.
    async function registerMerkleRootFails(_ownerAddress, _rootHash, _sender, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(_ownerAddress, _rootHash, {from: _sender}),
          _expectedError);
    }

    it('succeeds with all good parameters', async () => {
      await registerMerkleRootSucceeds();
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('bad ownerAddress', async () => {
          const badOwnerAddress = accounts.alternateScalingProvider;
          await registerMerkleRootFails(badOwnerAddress, goodUniqueRootHash(), goodSender, 'Address must be an active scaling provider');
        });

        it('bad sender', async () => {
          await registerMerkleRootFails(goodOwnerAddress, goodUniqueRootHash(), badSender, 'Merkle root owner address must match sender address');
        });
      });

      context('bad states', async () => {
        it('the same rootHash has already been registered', async () => {
          const goodRootHash = goodUniqueRootHash();
          await merkleRootsManager.registerMerkleRoot(goodOwnerAddress, goodRootHash, {from: goodSender});
          await registerMerkleRootFails(goodOwnerAddress, goodRootHash, goodSender, 'Merkle root is already active');
        });

        it('the address is not registered as a scaling provider', async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodScalingProvider, scalingProviderType);
          await registerMerkleRootFails(goodOwnerAddress, goodUniqueRootHash(), goodSender, 'Address must be an active scaling provider');
          await membersTestHelper.depositAndRegisterMember(goodScalingProvider, scalingProviderType);
        });
      });
    });
  });
});