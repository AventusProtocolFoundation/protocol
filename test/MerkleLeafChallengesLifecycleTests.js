const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');
const sigmaHelper = require('../utils/sigma/sigmaHelper');

const TransactionType = merkleTreeHelper.TransactionType;
const EMPTY_BYTES = '0x';

contract('MerkleLeafChallenges - lifecycle', async () => {
  let accounts, merkleLeafChallenges;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'challenger', 'ticketOwner');

    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
  });

  after(async () => {
    await validatorsTestHelper.advanceToDeregistrationTime(accounts.validator, "Validator");
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function createSaleLeaf() {
    const leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Sell);

    leaf.immutableData.vendor = accounts.eventOwner;
    leaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.eventOwner, accounts.ticketOwner,
        leaf.immutableData);
    return leaf;
  }

  async function createResaleLeaf(_previousLeaf, _previousLeafMerklePath) {
    const resaleLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Resell);
    const ticketOwnerProof = await testHelper.sign(accounts.ticketOwner,
        testHelper.hash(TransactionType.Resell, resaleLeaf.mutableData.prevLeafHash, accounts.eventOwner));
    const resellerProof = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Resell, ticketOwnerProof));

    resaleLeaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);
    resaleLeaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [1, 0]);
    return resaleLeaf;
  }

  async function createTransferLeaf(_previousLeaf, _previousLeafMerklePath) {
    const transferLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Transfer);

    transferLeaf.provenance = await testHelper.sign(accounts.ticketOwner,
        testHelper.hash(TransactionType.Transfer, transferLeaf.mutableData.prevLeafHash));
    transferLeaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [0, 1]);
    return transferLeaf;
  }

  async function createUpdateLeaf(_previousLeaf, _previousLeafMerklePath) {
    return merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Update);
  }

  async function createCancelLeaf(_previousLeaf, _previousLeafMerklePath) {
    return merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Cancel);
  }

  async function createRedeemLeaf(_previousLeaf, _previousLeafMerklePath) {
    return merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Redeem);
  }

  context('challengeLeafLifecycle', async () => {
    let leaf, merkleTree, prevLeaf, prevMerkleTree;

    async function challengeLeafLifecycleSucceeds(_expectedChallengeReason) {
      const encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

      await merkleLeafChallenges.challengeLeafLifecycle(encodedLeaf, merkleTree.merklePath,
          merkleTreeHelper.encodeLeaf(prevLeaf), {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
      assert.equal(logArgs.rootOwner, accounts.validator);
      assert.equal(logArgs.rootHash, merkleTree.rootHash);
      assert.equal(logArgs.leafHash, merkleTree.leafHash);
      assert.equal(logArgs.challengeReason, _expectedChallengeReason);
    }

    async function challengeLeafLifecycleFails(_expectedError, _falsifyMerklePath) {
      const encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
      const merklePath = _falsifyMerklePath ? [testHelper.randomBytes32()] : merkleTree.merklePath;

      await testHelper.expectRevert(() =>
          merkleLeafChallenges.challengeLeafLifecycle(encodedLeaf, merklePath, merkleTreeHelper.encodeLeaf(prevLeaf),
          {from: accounts.challenger}), _expectedError);
    }

    beforeEach(async () => {
      prevLeaf = await createSaleLeaf();
      prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
    });

    context('succeeds', async () => {
      afterEach(async () => {
        await avtTestHelper.withdrawAVT(merkleTree.deposit, accounts.challenger);
      });

      context('for a resale leaf', async () => {
        it('if immutable data has been modified', async () => {
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.immutableData.eventId += 1;

          await challengeLeafLifecycleSucceeds('Immutable data must not be modified');
        });

        it('if the previous leaf is a cancel', async () => {
          prevLeaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous leaf is a redeem', async () => {
          prevLeaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous owner proof is incorrectly constructed', async () => {
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
          const ticketOwnerProof = await testHelper.sign(accounts.ticketOwner, testHelper.randomBytes32());
          const resellerProof = await testHelper.sign(accounts.eventOwner,
              testHelper.hash(TransactionType.Resell, ticketOwnerProof));
          leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);

          await challengeLeafLifecycleSucceeds(
            'Previous ticket owner proof must be signed by previous ticket owner');
        });

        it('if numResells has not been incremented', async () => {
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [2, 0]);

          await challengeLeafLifecycleSucceeds('Resell must increment num resells in rules data');
        });

        it('if numTransfers has been modified', async () => {
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [1, 1]);

          await challengeLeafLifecycleSucceeds('Resell must not modify num transfers in rules data');
        });
      });

      context('for a transfer leaf', async () => {
        it('if immutable data has been modified', async () => {
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.immutableData.eventId += 1;

          await challengeLeafLifecycleSucceeds('Immutable data must not be modified');
        });

        it('if the previous leaf is a cancel', async () => {
          prevLeaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous leaf is a redeem', async () => {
          prevLeaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous owner proof was incorrectly signed', async () => {
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.provenance = await testHelper.sign(accounts.ticketOwner, testHelper.randomBytes32());

          await challengeLeafLifecycleSucceeds('Previous ticket owner proof must be signed by previous ticket owner');
        });

        it('if the sigma merchant signed hash has been modified', async () => {
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.validator, accounts.ticketOwner,
              leaf.immutableData);
          await challengeLeafLifecycleSucceeds('Sigma merchant signed hash must not change on transfer');
        });

        it('if numResells has been modified', async () => {
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [1, 1]);

           await challengeLeafLifecycleSucceeds('Transfer must not modify num resells in rules data');
        });

        it('if numTransfers has not been incremented', async () => {
          leaf = await createTransferLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [0, 2]);

          await challengeLeafLifecycleSucceeds('Transfer must increment num transfers in rules data');
        });
      });

      context('for an update leaf', async () => {
        it('if immutable data has been modified', async () => {
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.immutableData.eventId += 1;

          await challengeLeafLifecycleSucceeds('Immutable data must not be modified');
        });

        it('if mutable rules data has been modified', async () => {
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData += 'dead';

          await challengeLeafLifecycleSucceeds('Transaction must not modify rules data');
        });

        it('if the previous leaf is a cancel', async () => {
          prevLeaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous leaf is a redeem', async () => {
          prevLeaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the sigma data has been modified', async () => {
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.sigmaData += 'dead';

          await challengeLeafLifecycleSucceeds('Ticket updates must not change the sigma data');
        });

        it ('if the mutable rules data has been modified', async () => {
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData += 'dead';

          await challengeLeafLifecycleSucceeds('Transaction must not modify rules data');
        });
      });

      context('for a cancel leaf', async () => {
        it('if immutable data has been modified', async () => {
          leaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.immutableData.eventId += 1;

          await challengeLeafLifecycleSucceeds('Immutable data must not be modified');
        });

        it ('if the mutable rules data has been modified', async () => {
          leaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData += 'dead';

          await challengeLeafLifecycleSucceeds('Transaction must not modify rules data');
        });

        it('if the previous leaf is a cancel', async () => {
          prevLeaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous leaf is a redeem', async () => {
          prevLeaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });
      });

      context('for a redeem leaf', async () => {
        it('if immutable data has been modified', async () => {
          leaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.immutableData.eventId += 1;

          await challengeLeafLifecycleSucceeds('Immutable data must not be modified');
        });

        it ('if the mutable rules data has been modified', async () => {
          leaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          leaf.mutableData.mutableRulesData += 'dead';

          await challengeLeafLifecycleSucceeds('Transaction must not modify rules data');
        });

        it('if the previous leaf is a cancel', async () => {
          prevLeaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });

        it('if the previous leaf is a redeem', async () => {
          prevLeaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
          prevMerkleTree = merkleTreeHelper.createTree(merkleTreeHelper.encodeLeaf(prevLeaf));
          leaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);

          await challengeLeafLifecycleSucceeds('Cancelled and redeemed tickets cannot be further modified');
        });
      });
    });

    context('fails', async () => {
      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(merkleTree.rootHash, accounts.validator,
          merkleTree.deposit);
      });

      it('if the previous leaf hash does not match the hash of the previous leaf', async () => {
        leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
        leaf.mutableData.prevLeafHash = testHelper.randomBytes32();

        await challengeLeafLifecycleFails('Challenged failed - previous leaf must match previous leaf hash');
      });

      context('for a resale leaf', async () => {
        beforeEach(async () => {
          leaf = await createResaleLeaf(prevLeaf, prevMerkleTree.merklePath);
        });

        it('if the update is in fact consistent with the previous leaf', async () => {
          await challengeLeafLifecycleFails('Challenge failed - leaf is consistent with previous leaf');
        });

        it('if the merkle proof provided is invalid', async () => {
          await challengeLeafLifecycleFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for an update leaf', async () => {
        beforeEach(async () => {
          leaf = await createUpdateLeaf(prevLeaf, prevMerkleTree.merklePath);
        });

        it('if the update is in fact consistent with the previous leaf', async () => {
          await challengeLeafLifecycleFails('Challenge failed - leaf is consistent with previous leaf');
        });

        it('if the merkle proof provided is invalid', async () => {
          await challengeLeafLifecycleFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a cancel leaf', async () => {
        beforeEach(async () => {
          leaf = await createCancelLeaf(prevLeaf, prevMerkleTree.merklePath);
        });

        it('if the update is in fact consistent with the previous leaf', async () => {
          await challengeLeafLifecycleFails('Challenge failed - leaf is consistent with previous leaf');
        });

        it('if the merkle proof provided is invalid', async () => {
          await challengeLeafLifecycleFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a redeem leaf', async () => {
        beforeEach(async () => {
          leaf = await createRedeemLeaf(prevLeaf, prevMerkleTree.merklePath);
        });

        it('if the update is in fact consistent with the previous leaf', async () => {
          await challengeLeafLifecycleFails('Challenge failed - leaf is consistent with previous leaf');
        });

        it('if the merkle proof provided is invalid', async () => {
          await challengeLeafLifecycleFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });
    });
  });
});