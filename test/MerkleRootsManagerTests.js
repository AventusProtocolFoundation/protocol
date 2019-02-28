const testHelper = require('./helpers/testHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');

contract('MerkleRootsManager - registration', async () => {
  let merkleRootsManager, accounts, goodValidator, badSender;
  const validatorType = membersTestHelper.memberTypes.validator;
  const goodTreeDepth = new testHelper.BN(3);
  const goodLargeTreeDepth = new testHelper.BN(100);
  const badTreeDepth = new testHelper.BN(300);

  before(async () => {
    await testHelper.init();
    await merkleProofTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    accounts = testHelper.getAccounts('validator', 'alternateValidator');
    goodValidator = accounts.validator;
    badSender = accounts.alternateValidator;
    await membersTestHelper.depositAndRegisterMember(goodValidator, validatorType);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodValidator, validatorType);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('registerMerkleRoot()', async () => {
    let deposit, goodLastEventTime;
    const rootHash = testHelper.randomBytes32();

    async function registerMerkleRootSucceeds() {
      await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeDepth, goodLastEventTime, {from: goodValidator});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootRegistered');
      assert.equal(logArgs.ownerAddress, goodValidator);
      assert.equal(logArgs.rootHash, rootHash);
      testHelper.assertBNEquals(logArgs.treeDepth, goodTreeDepth);
      testHelper.assertBNEquals(logArgs.lastEventTime, goodLastEventTime);
    }

    // No such thing as a bad rootHash as we do not know anything about the data in the root nor what can give a zero hash
    async function registerMerkleRootFails(_treeDepth, _lastEventTime, _sender, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(rootHash, _treeDepth, _lastEventTime,
          {from: _sender}), _expectedError);
    }

    beforeEach(async () => {
      goodLastEventTime = timeTestHelper.now().add(timeTestHelper.oneWeek);
      deposit = await merkleRootsManager.getNewMerkleRootDeposit(goodTreeDepth, goodLastEventTime);
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
          await registerMerkleRootFails(badTreeDepth, goodLastEventTime, goodValidator,
              'Tree depth must not exceed the maximum allowed value');
        });

        it('lastEventTime', async () => {
          const badLastEventTime = timeTestHelper.now().sub(testHelper.BN_ONE);
          await registerMerkleRootFails(goodTreeDepth, badLastEventTime, goodValidator,
              'Last event time must be in the future');
        });

        it('sender', async () => {
          await registerMerkleRootFails(goodTreeDepth, goodLastEventTime, badSender, 'Sender must be an active validator');
        });
      });

      context('bad state', async () => {
        it('the same rootHash has already been registered', async () => {
          await merkleRootsManager.registerMerkleRoot(rootHash, goodTreeDepth, goodLastEventTime, {from: goodValidator});
          await registerMerkleRootFails(goodTreeDepth, goodLastEventTime, goodValidator, 'Merkle root is already active');

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
          await merkleRootsTestHelper.advanceTimeToCoolingOffPeriodEnd(goodRootHash);
        });

        it('good parameters', async () => {
          await deregisterMerkleRootSucceeds();
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        beforeEach(async () => {
          await merkleRootsTestHelper.advanceTimeToCoolingOffPeriodEnd(goodRootHash);
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

        it('before last event time', async () => {
          await deregisterMerkleRootFails(goodRootHash, 'Must be after cooling off period');
        });
      });
    });
  });

  context('getNewMerkleRootDeposit()', async () => {
    let goodLastEventTime;

    async function getNewMerkleRootDepositSucceeds(_treeDepth) {
      const baseDeposit = merkleRootsTestHelper.getBaseDeposit();
      const treeDeposit = merkleRootsTestHelper.getDepositMultiplier().mul(timeTestHelper.oneWeek).mul(_treeDepth);

      const expectedDeposit = baseDeposit.gte(treeDeposit) ? baseDeposit : treeDeposit;

      const actualDeposit = await merkleRootsManager.getNewMerkleRootDeposit(_treeDepth, goodLastEventTime);
      testHelper.assertBNEquals(actualDeposit, expectedDeposit);
    }

    async function getNewMerkleRootDepositFails(_treeDepth, _lastEventTime, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.getNewMerkleRootDeposit(_treeDepth, _lastEventTime),
          _expectedError);
    }

    beforeEach(async () => {
      goodLastEventTime = timeTestHelper.now().add(timeTestHelper.oneWeek);
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
          await getNewMerkleRootDepositFails(badTreeDepth, goodLastEventTime,
              'Tree depth must not exceed the maximum allowed value');
        });

        it('treeDepth (zero)', async () => {
          const badZeroTreeDepth = testHelper.BN_ZERO;
          await getNewMerkleRootDepositFails(badZeroTreeDepth, goodLastEventTime, 'Tree depth cannot be zero');
        });

        it('lastEventTime (in the past)', async () => {
          const badLastEventTime = timeTestHelper.now().sub(testHelper.BN_ONE);
          await getNewMerkleRootDepositFails(goodTreeDepth, badLastEventTime, 'Last event time must be in the future');
        });

        it('lastEventTime (too far in future)', async () => {
          const badLastEventTime = goodLastEventTime.mul(goodTreeDepth);
          await getNewMerkleRootDepositFails(goodTreeDepth, badLastEventTime,
              'Last event time must not exceed the maximum allowed value');
        });
      });

      // NOTE: there is no bad state for getNewMerkleRootDeposit()
    });
  });
});