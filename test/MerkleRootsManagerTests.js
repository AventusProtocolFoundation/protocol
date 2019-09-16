const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');

contract('MerkleRootsManager - registration', async () => {
  let merkleRootsManager, accounts, goodValidator, badSender;
  const goodTreeDepth = new testHelper.BN(3);
  const goodLargeTreeDepth = new testHelper.BN(100);
  const badTreeDepth = new testHelper.BN(300);
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
    let deposit, goodRootExpiryTime;
    const rootHash = testHelper.randomBytes32();

    async function registerMerkleRootSucceeds() {
      await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeDepth, goodRootExpiryTime, goodTreeContentURL,
          {from: goodValidator});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootRegistered');
      assert.equal(logArgs.rootOwner, goodValidator);
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.treeContentURL, goodTreeContentURL);
      testHelper.assertBNEquals(logArgs.treeDepth, goodTreeDepth);
      testHelper.assertBNEquals(logArgs.rootExpiryTime, goodRootExpiryTime);
      testHelper.assertBNEquals(logArgs.rootDeposit, deposit);
    }

    // No such thing as a bad rootHash as we do not know anything about the data in the root nor what can give a zero hash
    async function registerMerkleRootFails(_treeDepth, _rootExpiryTime, _treeContentURL, _sender, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(rootHash, _treeDepth, _rootExpiryTime,
          _treeContentURL, {from: _sender}), _expectedError);
    }

    beforeEach(async () => {
      goodRootExpiryTime = timeTestHelper.now().add(timeTestHelper.oneWeek);
      deposit = await merkleRootsManager.getNewMerkleRootDeposit(goodTreeDepth, goodRootExpiryTime);
      await avtTestHelper.addAVT(deposit, goodValidator);
    });

    afterEach(async () => {
      await avtTestHelper.withdrawAVT(deposit, goodValidator);
    });

    context('succeeds with', async () => {
      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeAndDeregisterMerkleRoot(rootHash);
      });

      it('good parameters', async () => {
        await registerMerkleRootSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('treeDepth', async () => {
          await registerMerkleRootFails(badTreeDepth, goodRootExpiryTime, goodTreeContentURL, goodValidator,
              'Tree depth must not exceed the maximum allowed value');
        });

        it('rootExpiryTime', async () => {
          const badRootExpiryTime = timeTestHelper.now().sub(testHelper.BN_ONE);
          await registerMerkleRootFails(goodTreeDepth, badRootExpiryTime, goodTreeContentURL, goodValidator,
              'Root expiry time must be in the future');
        });

        it('sender', async () => {
          await registerMerkleRootFails(goodTreeDepth, goodRootExpiryTime, goodTreeContentURL, badSender,
              'Sender must be a registered validator');
        });

        it('treeContentURL', async () => {
          await registerMerkleRootFails(goodTreeDepth, goodRootExpiryTime, badTreeContentURL, goodValidator,
              'Tree content URL must not be empty');
        });
      });

      context('bad state', async () => {
        it('the same rootHash has already been registered', async () => {
          await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeDepth, goodRootExpiryTime, goodTreeContentURL,
              {from: goodValidator});
          await registerMerkleRootFails(goodTreeDepth, goodRootExpiryTime, goodTreeContentURL, goodValidator,
              'Merkle root is already active');

          await merkleRootsTestHelper.advanceTimeAndDeregisterMerkleRoot(rootHash);
        });
      });
    });
  });

  context('deregisterMerkleRoot()', async () => {
    let goodRootHash, deposit;

    async function deregisterMerkleRootSucceeds() {
      await merkleRootsManager.deregisterMerkleRoot(goodRootHash);
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootDeregistered');
      assert.equal(logArgs.rootOwner, goodValidator);
      assert.equal(logArgs.rootHash, goodRootHash);
    }

    async function deregisterMerkleRootFails(_rootHash, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.deregisterMerkleRoot(_rootHash), _expectedError);
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
          await merkleRootsTestHelper.advanceToDeregistrationTime(goodRootHash);
        });

        it('good parameters', async () => {
          await deregisterMerkleRootSucceeds();
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        beforeEach(async () => {
          await merkleRootsTestHelper.advanceToDeregistrationTime(goodRootHash);
        });

        afterEach(async () => {
          await merkleRootsManager.deregisterMerkleRoot(goodRootHash);
        });

        it('rootHash', async () => {
          const badRootHash = testHelper.randomBytes32();
          await deregisterMerkleRootFails(badRootHash, 'Merkle root must be active');
        });
      });

      context('bad state', async () => {
        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeAndDeregisterMerkleRoot(goodRootHash);
        });

        it('before root expiry time', async () => {
          await deregisterMerkleRootFails(goodRootHash, 'Must be after cooling off period');
        });
      });
    });
  });

  context('getNewMerkleRootDeposit()', async () => {
    let goodRootExpiryTime;

    async function getNewMerkleRootDepositSucceeds(_treeDepth) {
      const baseDeposit = merkleRootsTestHelper.getBaseDeposit();
      const treeDeposit = merkleRootsTestHelper.getDepositMultiplier().mul(timeTestHelper.oneWeek).mul(_treeDepth);

      const expectedDeposit = baseDeposit.gte(treeDeposit) ? baseDeposit : treeDeposit;

      const actualDeposit = await merkleRootsManager.getNewMerkleRootDeposit(_treeDepth, goodRootExpiryTime);
      testHelper.assertBNEquals(actualDeposit, expectedDeposit);
    }

    async function getNewMerkleRootDepositFails(_treeDepth, _rootExpiryTime, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.getNewMerkleRootDeposit(_treeDepth, _rootExpiryTime),
          _expectedError);
    }

    beforeEach(async () => {
      goodRootExpiryTime = timeTestHelper.now().add(timeTestHelper.oneWeek);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('small tree depth', async () => {
          await getNewMerkleRootDepositSucceeds(goodTreeDepth);
        });

        it('large tree depth', async () => {
          await getNewMerkleRootDepositSucceeds(goodLargeTreeDepth);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('treeDepth (greater than max permitted value)', async () => {
          await getNewMerkleRootDepositFails(badTreeDepth, goodRootExpiryTime,
              'Tree depth must not exceed the maximum allowed value');
        });

        it('treeDepth (zero)', async () => {
          const badZeroTreeDepth = testHelper.BN_ZERO;
          await getNewMerkleRootDepositFails(badZeroTreeDepth, goodRootExpiryTime, 'Tree depth cannot be zero');
        });

        it('rootExpiryTime (in the past)', async () => {
          const badRootExpiryTime = timeTestHelper.now().sub(testHelper.BN_ONE);
          await getNewMerkleRootDepositFails(goodTreeDepth, badRootExpiryTime, 'Root expiry time must be in the future');
        });

        it('rootExpiryTime (too far in future)', async () => {
          const badRootExpiryTime = goodRootExpiryTime.mul(goodTreeDepth);
          await getNewMerkleRootDepositFails(goodTreeDepth, badRootExpiryTime,
              'Last event time must not exceed the maximum allowed value');
        });
      });

      // NOTE: there is no bad state for getNewMerkleRootDeposit()
    });
  });
});