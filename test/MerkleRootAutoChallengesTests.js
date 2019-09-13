const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const TransactionType = merkleTreeHelper.TransactionType;

contract('MerkleRootsManager - auto challenges', async () => {
  let accounts, merkleRootsManager

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    accounts = testHelper.getAccounts('validator', 'challenger');
    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
  });

  after(async () => {
    await validatorsTestHelper.advanceToDeregistrationTime(accounts.validator);
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('autoChallengeTreeDepth()', async () => {
    const treeDepth = 10;
    let rootHash, goodLeafHash, goodIllegalMerklePath, deposit;

    async function autoChallengeTreeDepthSucceeds(_leafHash, _illegalMerklePath) {
      await merkleRootsManager.autoChallengeTreeDepth(_leafHash, _illegalMerklePath, {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootAutoChallenged');
      assert.equal(logArgs.rootOwner, accounts.validator);
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.challenger, accounts.challenger);
    }

    async function autoChallengeTreeDepthFails(_leafHash, _illegalMerklePath, _expectedError) {
      await testHelper.expectRevert(() => merkleRootsManager.autoChallengeTreeDepth(_leafHash, _illegalMerklePath,
          {from: accounts.challenger}), _expectedError);
    }

    beforeEach(async () => {
      const goodTree = merkleTreeHelper.createRandomTree(treeDepth);
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
        await autoChallengeTreeDepthSucceeds(...merkleTreeHelper.getSubTreeMerkleProof(goodLeafHash, goodIllegalMerklePath,
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
          await autoChallengeTreeDepthFails(...merkleTreeHelper.getSubTreeMerkleProof(goodLeafHash, goodIllegalMerklePath,
              treeDepth - 2), 'Challenged leaf must exist at a greater depth than declared by validator');
        });
      });

      context('bad state', async () => {
        it('root has already been deregistered', async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          await autoChallengeTreeDepthFails(goodLeafHash, goodIllegalMerklePath, 'Merkle root must be active');
        });

        it('the challenge window has passed', async () => {
          await timeTestHelper.advancePastChallengeWindow();
          await autoChallengeTreeDepthFails(goodLeafHash, goodIllegalMerklePath, 'Challenge window expired');
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);
        });
      });
    });
  });

  context('autoChallengeRootExpiryTime()', async () => {
    let goodEncodedLeaf, goodMerklePath, rootHash, deposit;
    const treeDepth = 5;

    async function autoChallengeRootExpiryTimeSucceeds() {
      await merkleRootsManager.autoChallengeRootExpiryTime(goodEncodedLeaf, goodMerklePath,
          {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleRootsManager, 'LogMerkleRootAutoChallenged');
      assert.equal(logArgs.rootOwner, accounts.validator);
      assert.equal(logArgs.rootHash, rootHash);
      assert.equal(logArgs.challenger, accounts.challenger);
    }

    async function autoChallengeRootExpiryTimeFails(_encodedLeaf, _merklePath, _expectedError) {
      await testHelper.expectRevert(
          () => merkleRootsManager.autoChallengeRootExpiryTime(_encodedLeaf, _merklePath), _expectedError);
    }

    function createEncodedLeaf(_eventId) {
      const leaf = merkleTreeHelper.getBaseLeaf(merkleTreeHelper.TransactionType.Sell);
      leaf.immutableData.eventId = _eventId;

      return merkleTreeHelper.encodeLeaf(leaf);
    }

    beforeEach(async () => {
      // Creates event with event time 49 days from now
      const eventId = (await eventsTestHelper.createEvent(accounts.validator)).toString();

      goodEncodedLeaf = createEncodedLeaf(eventId);
      const tree = merkleTreeHelper.createTree(goodEncodedLeaf);
      goodMerklePath = tree.merklePath;
      rootHash = tree.rootHash;

      const fraudulentRootExpiryTime = timeTestHelper.now().add(timeTestHelper.oneDay);
      const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(accounts.validator, rootHash, treeDepth,
          fraudulentRootExpiryTime);
      deposit = root.deposit;
    });

    context('succeeds with', async () => {
      afterEach(async () => {
        await avtTestHelper.withdrawAVT(deposit, accounts.challenger);
      });

      it('good parameters', async () => {
        await autoChallengeRootExpiryTimeSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);
        });

        it('encodedLeaf (eventId valid but before rootExpiryTime)', async () => {
          // Deregister the existing root and re-register with a valid rootExpiryTime
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          const legitimateRootExpiryTime = timeTestHelper.now().add(timeTestHelper.oneDay.mul(new testHelper.BN(99)));
          const root = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(accounts.validator, rootHash, treeDepth,
              legitimateRootExpiryTime);
          deposit = root.deposit;
          // What was previously a valid leaf to challenge on will now revert
          const badEncodedLeaf = goodEncodedLeaf;

          await autoChallengeRootExpiryTimeFails(badEncodedLeaf, goodMerklePath,
              'Challenged leaf must have a later event time than declared by validator');
        });

        it('merklePath', async () => {
          const badMerklePath = goodMerklePath;
          badMerklePath.push(testHelper.randomBytes32());

          await autoChallengeRootExpiryTimeFails(goodEncodedLeaf, badMerklePath, 'Merkle root must be active');
        });
      });

      context('bad state', async () => {
        it('root has already been deregistered', async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);

          await autoChallengeRootExpiryTimeFails(goodEncodedLeaf, goodMerklePath, 'Merkle root must be active');
        });

        it('the challenge window has passed', async () => {
          await timeTestHelper.advancePastChallengeWindow();
          await autoChallengeRootExpiryTimeFails(goodEncodedLeaf, goodMerklePath, 'Challenge window expired');
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(rootHash, accounts.validator, deposit);
        });
      });
    });
  });

  context('extra tests for line coverage', async () => {
    async function createAndAutoChallengeBadLeaf() {
      const tree = merkleTreeHelper.createRandomTree(2);
      const registerRetVal = await merkleRootsTestHelper.depositAndRegisterMerkleRoot(
          accounts.validator, tree.rootHash, 1);
      await merkleRootsManager.autoChallengeTreeDepth(tree.leafHash, tree.merklePath, {from: accounts.challenger});
      await avtTestHelper.withdrawAVT(registerRetVal.deposit, accounts.challenger);
    }

    it('create and challenge more bad trees to check max penalties', async () => {
      await createAndAutoChallengeBadLeaf();
      await createAndAutoChallengeBadLeaf();
    })
  });
});