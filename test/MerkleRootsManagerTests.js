const testHelper = require('./helpers/testHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

contract('MerkleRootsManager', async () => {
  let merkleRootsManager, accounts, goodValidator, badSender;
  let hashCount = 0;
  const validatorType = membersTestHelper.memberTypes.validator;

  before(async () => {
    await testHelper.init();
    await merkleProofTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    accounts = testHelper.getAccounts('validator', 'alternateValidator');
    goodValidator = accounts.validator;
    badSender = accounts.alternateValidator;
    await membersTestHelper.depositAndRegisterMember(goodValidator, validatorType);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodValidator, validatorType);
    await avtTestHelper.checkFundsEmpty(accounts, false);
  });

  function goodUniqueRootHash() {
    return testHelper.hash('this is hash number ' + ++hashCount);
  }

  context('registerMerkleRoot()', async () => {
    async function registerMerkleRootSucceeds() {
      const goodRootHash = goodUniqueRootHash();
      await merkleRootsManager.registerMerkleRoot(goodRootHash, {from: goodValidator});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootRegistered');
      assert.equal(logArgs.ownerAddress, goodValidator);
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
          await registerMerkleRootFails(goodUniqueRootHash(), badSender, 'Sender must be an active validator');
        });
      });

      context('bad states', async () => {
        it('the same rootHash has already been registered', async () => {
          const goodRootHash = goodUniqueRootHash();
          await merkleRootsManager.registerMerkleRoot(goodRootHash, {from: goodValidator});
          await registerMerkleRootFails(goodRootHash, goodValidator, 'Merkle root is already active');
        });

        it('the address is not registered as a validator', async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodValidator, validatorType);
          await registerMerkleRootFails(goodUniqueRootHash(), goodValidator,
              'Sender must be an active validator');
          await membersTestHelper.depositAndRegisterMember(goodValidator, validatorType);
        });
      });
    });
  });
});