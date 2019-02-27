const testHelper = require('./helpers/testHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');

contract('MerkleRootsManager - auto challenges', async () => {
  const validatorType = membersTestHelper.memberTypes.validator;
  let accounts, merkleRootsManager

  before(async () => {
    await testHelper.init();
    await merkleProofTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    accounts = testHelper.getAccounts('validator', 'challenger');
    await membersTestHelper.depositAndRegisterMember(accounts.validator, validatorType);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.validator, validatorType);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('autoChallengeTreeDepth()', async () => {
    const treeDepth = 10;
    let rootHash, goodLeafHash, goodIllegalMerklePath, deposit;

    async function autoChallengeTreeDepthSucceeds(_leafHash, _illegalMerklePath) {
      await merkleRootsManager.autoChallengeTreeDepth(_leafHash, _illegalMerklePath, {from: accounts.challenger});

      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootAutoChallenged');
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.challenger, accounts.challenger);
    }

    async function autoChallengeTreeDepthFails(_leafHash, _illegalMerklePath, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.autoChallengeTreeDepth(_leafHash, _illegalMerklePath,
          {from: accounts.challenger}), _expectedError);
    }

    beforeEach(async () => {
      const goodTree = merkleProofTestHelper.createTree(treeDepth, testHelper.randomBytes32());
      goodLeafHash = goodTree.leafHash;
      // A path that proves the leaf exists at a lower depth than the validator declares
      // 'good' as will not revert a call to autoChallengeTreeDepth()
      goodIllegalMerklePath = goodTree.merklePath;
      rootHash = goodTree.rootHash;

      const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(accounts.validator, rootHash, treeDepth - 2);
      deposit = root.deposit;
    });

    context('succeeds with', async () => {
      afterEach(async () => {
        await avtTestHelper.withdrawAVT(deposit, accounts.challenger);
      });

      it('good parameters', async () => {
        await autoChallengeTreeDepthSucceeds(goodLeafHash, goodIllegalMerklePath);
      });

      it('good parameters after already challenged', async () => {
        // Move proof up one layer (still greater than declared)
        await autoChallengeTreeDepthSucceeds(...merkleProofTestHelper.getSubTreeMerkleProof(goodLeafHash, goodIllegalMerklePath,
            treeDepth - 1));

        // Supply original proof (greater depth than previous disproval)
        await autoChallengeTreeDepthSucceeds(goodLeafHash, goodIllegalMerklePath);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);
        });

        it('leafHash', async () => {
          const badLeafHash = testHelper.randomBytes32();

          await autoChallengeTreeDepthFails(badLeafHash, goodIllegalMerklePath, 'Merkle root must be active');
        });

        it('merklePath (invalid)', async () => {
          // Make a sufficiently long array of random data
          const badIllegalMerklePath = Array.from(Array(10), testHelper.randomBytes32);

          await autoChallengeTreeDepthFails(goodLeafHash, badIllegalMerklePath, 'Merkle root must be active');
        });

        it('merklePath (valid but too short)', async () => {
          // Move the proof up two layers
          await autoChallengeTreeDepthFails(...merkleProofTestHelper.getSubTreeMerkleProof(goodLeafHash, goodIllegalMerklePath,
              treeDepth - 2), 'Challenged leaf must exist at a greater depth than declared by validator');
        });
      });

      context('bad state', async () => {
        it('root has already been deregistered', async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          await autoChallengeTreeDepthFails(goodLeafHash, goodIllegalMerklePath, 'Merkle root must be active');
        });
      });
    });
  });

  context('autoChallengeLastEventTime()', async () => {
    let goodEventId, goodMerklePath, goodRemainingLeafData, rootHash, deposit;
    const treeDepth = 5;

    async function autoChallengeLastEventTimeSucceeds() {
      await merkleRootsManager.autoChallengeLastEventTime(goodEventId, goodRemainingLeafData, goodMerklePath,
          {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootAutoChallenged');
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.challenger, accounts.challenger);
    }

    async function autoChallengeLastEventTimeFails(_eventId, _remainingLeafData, _merklePath, _expectedError) {
      await testHelper.expectRevert(
          () => merkleRootsManager.autoChallengeLastEventTime(_eventId, _remainingLeafData, _merklePath), _expectedError);
    }

    beforeEach(async () => {
      // Creates event with event time 49 days from now
      goodEventId = await eventsTestHelper.createEvent(accounts.validator);

      goodRemainingLeafData = testHelper.randomBytes32();
      const tree = merkleProofTestHelper.createTree(treeDepth, [goodEventId, goodRemainingLeafData]);
      goodMerklePath = tree.merklePath;
      rootHash = tree.rootHash;

      const fraudulentLastEventTime = timeTestHelper.now().add(timeTestHelper.oneDay);
      const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(accounts.validator, rootHash, treeDepth,
          fraudulentLastEventTime);
      deposit = root.deposit;
    });

    context('succeeds with', async () => {
      afterEach(async () => {
        await avtTestHelper.withdrawAVT(deposit, accounts.challenger);
      });

      it('good parameters', async () => {
        await autoChallengeLastEventTimeSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);
        });

        it('eventId (invalid)', async () => {
          const badEventId = 9999;

          await autoChallengeLastEventTimeFails(badEventId, goodRemainingLeafData, goodMerklePath,
              'Merkle root must be active');
        });

        it('eventId (valid but before lastEventTime)', async () => {
          // Deregister the existing root and re-register with a valid lastEventTime
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          const legitimateLastEventTime = timeTestHelper.now().add(timeTestHelper.oneDay.mul(new testHelper.BN(99)));
          const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(accounts.validator, rootHash, treeDepth,
              legitimateLastEventTime);
          deposit = root.deposit;
          // What was previously a valid event id to challenge on will now revert
          const badEventId = goodEventId;

          await autoChallengeLastEventTimeFails(badEventId, goodRemainingLeafData, goodMerklePath,
              'Challenged leaf must have a later event time than declared by validator');
        });

        it('remainingLeafData', async () => {
          const badRemainingLeafData = testHelper.randomBytes32();

          await autoChallengeLastEventTimeFails(goodEventId, badRemainingLeafData, goodMerklePath,
              'Merkle root must be active');
        });

        it('merklePath', async () => {
          const badMerklePath = goodMerklePath;
          badMerklePath.push(testHelper.randomBytes32());

          await autoChallengeLastEventTimeFails(goodEventId, goodRemainingLeafData, badMerklePath,
              'Merkle root must be active');
        });
      });

      context('bad state', async () => {
        it('root has already been deregistered', async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          await autoChallengeLastEventTimeFails(goodEventId, goodRemainingLeafData, goodMerklePath,
              'Merkle root must be active');
        });
      });
    });
  });
});