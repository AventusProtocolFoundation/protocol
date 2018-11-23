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
      await merkleRootsManager.registerMerkleRoot(goodRootHash, {from: goodScalingProvider});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager.LogMerkleRootRegistered);
      assert.equal(logArgs.ownerAddress, goodScalingProvider);
      assert.equal(logArgs.rootHash, goodRootHash);
    }

    // No such thing as a bad rootHash as we do not know anything about the data in the root nor what can give a zero hash.
    async function registerMerkleRootFails(_rootHash, _sender, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(_rootHash, {from: _sender}), _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await registerMerkleRootSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('sender', async () => {
          await registerMerkleRootFails(goodUniqueRootHash(), badSender, 'Sender must be an active scaling provider');
        });
      });

      context('bad states', async () => {
        it('the same rootHash has already been registered', async () => {
          const goodRootHash = goodUniqueRootHash();
          await merkleRootsManager.registerMerkleRoot(goodRootHash, {from: goodScalingProvider});
          await registerMerkleRootFails(goodRootHash, goodScalingProvider, 'Merkle root is already active');
        });

        it('the address is not registered as a scaling provider', async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodScalingProvider, scalingProviderType);
          await registerMerkleRootFails(goodUniqueRootHash(), goodScalingProvider,
              'Sender must be an active scaling provider');
          await membersTestHelper.depositAndRegisterMember(goodScalingProvider, scalingProviderType);
        });
      });
    });
  });
});