const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');

contract('MerkleRootsManager - registration', async () => {
  let merkleRootsManager, accounts, goodValidator, badSender;
  const goodTreeContentURL = 'ipfs.io/ipfs/Qmc2ZFNuVemgyRZrMSfzSYZWnZQMsznnW8drMz3UhaiBVv';
  const badTreeContentURL = '';

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    accounts = testHelper.getAccounts('validator', 'alternateValidator');
    goodValidator = accounts.validator;
    badSender = accounts.alternateValidator;
    await validatorsTestHelper.depositAndRegisterValidator(goodValidator);
  });

  after(async () => {
    await validatorsTestHelper.advanceToDeregistrationTime(goodValidator);
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(goodValidator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('registerMerkleRoot()', async () => {
    let deposit, rootHash;

    async function registerMerkleRootSucceeds() {
      await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeContentURL, {from: goodValidator});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootRegistered');
      assert.equal(logArgs.rootOwner, goodValidator);
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.treeContentURL, goodTreeContentURL);
      testHelper.assertBNEquals(logArgs.rootDeposit, deposit);
    }

    // No such thing as a bad rootHash as we do not know anything about the data in the root nor what can give a zero hash
    async function registerMerkleRootFails(_treeContentURL, _sender, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(rootHash, _treeContentURL, {from: _sender}),
          _expectedError);
    }

    beforeEach(async () => {
      deposit = await merkleRootsManager.getNewMerkleRootDeposit();
      await avtTestHelper.addAVT(deposit, goodValidator);
      rootHash = testHelper.randomBytes32();
    });

    afterEach(async () => {
      await avtTestHelper.withdrawAVT(deposit, goodValidator);
    });

    context('succeeds with', async () => {
      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeAndUnlockMerkleRootDeposit(rootHash);
      });

      it('good parameters', async () => {
        await registerMerkleRootSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('sender', async () => {
          await registerMerkleRootFails(goodTreeContentURL, badSender, 'Sender must be a registered validator');
        });

        it('treeContentURL', async () => {
          await registerMerkleRootFails(badTreeContentURL, goodValidator, 'Tree content URL must not be empty');
        });
      });

      context('bad state', async () => {
        it('the same rootHash has already been registered', async () => {
          await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeContentURL, {from: goodValidator});
          await registerMerkleRootFails(goodTreeContentURL, goodValidator, 'Merkle root is already registered');

          await merkleRootsTestHelper.advanceTimeAndUnlockMerkleRootDeposit(rootHash);
        });
      });
    });
  });

  context('unlockMerkleRootDeposit()', async () => {
    let goodRootHash, deposit;

    async function unlockMerkleRootDepositSucceeds() {
      await merkleRootsManager.unlockMerkleRootDeposit(goodRootHash);
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootDepositUnlocked');
      assert.equal(logArgs.rootOwner, goodValidator);
      assert.equal(logArgs.rootHash, goodRootHash);
    }

    async function unlockMerkleRootDepositFails(_rootHash, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.unlockMerkleRootDeposit(_rootHash), _expectedError);
    }

    beforeEach(async () => {
      const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(goodValidator);
      goodRootHash = root.rootHash;
      deposit = root.deposit;
    });

    afterEach(async () => {
      await avtTestHelper.withdrawAVT(deposit, goodValidator);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        beforeEach(async () => {
          await merkleRootsTestHelper.advanceToDepositUnlockTime(goodRootHash);
        });

        it('good parameters', async () => {
          await unlockMerkleRootDepositSucceeds();
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        beforeEach(async () => {
          await merkleRootsTestHelper.advanceToDepositUnlockTime(goodRootHash);
        });

        afterEach(async () => {
          await merkleRootsManager.unlockMerkleRootDeposit(goodRootHash);
        });

        it('rootHash', async () => {
          const badRootHash = testHelper.randomBytes32();
          await unlockMerkleRootDepositFails(badRootHash, 'Root has no deposit');
        });
      });

      context('bad state', async () => {
        it('before root deposit unlock time', async () => {
          await unlockMerkleRootDepositFails(goodRootHash, 'Must be after root deposit unlock time');
          await merkleRootsTestHelper.advanceTimeAndUnlockMerkleRootDeposit(goodRootHash);
        });

        it('root deposit already unlocked', async () => {
          await merkleRootsTestHelper.advanceToDepositUnlockTime(goodRootHash);
          await unlockMerkleRootDepositSucceeds();
          await unlockMerkleRootDepositFails(goodRootHash, 'Root has no deposit');
        });
      });
    });
  });

  context('getNewMerkleRootDeposit()', async () => {
    async function getNewMerkleRootDepositSucceeds() {
      const expectedRootDeposit = merkleRootsTestHelper.getRootDeposit();
      const actualRootDeposit = await merkleRootsManager.getNewMerkleRootDeposit();
      testHelper.assertBNEquals(actualRootDeposit, expectedRootDeposit);
    }

    context('succeeds with', async () => {
      it('with good parameters', async () => {
        await getNewMerkleRootDepositSucceeds();
      });
    });
  });
});