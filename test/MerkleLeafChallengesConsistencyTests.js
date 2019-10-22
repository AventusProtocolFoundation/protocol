const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const merkleLeafTestHelper = require('./helpers/merkleLeafTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const sigmaHelper = require('../utils/sigma/sigmaHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const TransactionType = merkleTreeHelper.TransactionType;

contract('MerkleLeafChallenges - consistency', async () => {
  let accounts, merkleLeafChallenges;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, avtTestHelper);
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'challenger', 'ticketOwner');

    await merkleLeafTestHelper.init(testHelper, eventsTestHelper, sigmaHelper, accounts);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();

    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
  });

  after(async () => {
    await validatorsTestHelper.advanceToDeregistrationTime(accounts.validator, "Validator");
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('challengeLeafConsistency', async () => {
    let leaf, merkleTree, prevMerkleTree;

    async function challengeLeafConsistencySucceeds(_expectedChallengeReason, _encodedLeaf) {
      const encodedLeaf = _encodedLeaf || merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

      await merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, merkleTree.merklePath, {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
      assert.equal(logArgs.rootOwner, accounts.validator);
      assert.equal(logArgs.rootHash, merkleTree.rootHash);
      assert.equal(logArgs.leafHash, merkleTree.leafHash);
      assert.equal(logArgs.challengeReason, _expectedChallengeReason);
    }

    async function challengeLeafConsistencyFails(_expectedError, _falsifyMerklePath, _encodedLeaf) {
      const encodedLeaf = _encodedLeaf || merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
      const merklePath = _falsifyMerklePath ? [testHelper.randomBytes32()] : merkleTree.merklePath;

      await testHelper.expectRevert(() =>
          merkleLeafChallenges.challengeLeafConsistency(encodedLeaf, merklePath, {from: accounts.challenger}),
          _expectedError);
    }

    context('succeeds', async () => {
      afterEach(async () => {
        await avtTestHelper.withdrawAVT(merkleTree.deposit, accounts.challenger);
      });

      context('for a sale leaf', async () => {
        beforeEach(async () => {
          leaf = await merkleLeafTestHelper.createSaleLeaf();
        });

        it('if the referenced event id does not exist', async () => {
          leaf.immutableData.eventId = 9999;

          await challengeLeafConsistencySucceeds('Sell for non-existent event');
        });

        it('if the prevLeafHash and prevMerklePath fields are non-empty', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Sell must have no previous leaf data');
        });

        it('if the vendor is not the event owner or registered primary', async () => {
          leaf.immutableData.vendor = accounts.validator;

          await challengeLeafConsistencySucceeds('Vendor must be valid Primary or event owner');
        });

        it('if the propertiesProof is invalid', async () => {
          const propertiesProof = await testHelper.sign(leaf.immutableData.vendor, testHelper.randomBytes32());
          const saleProof = await testHelper.sign(accounts.eventOwner,
              testHelper.hash(TransactionType.Sell, leaf.immutableData.eventId, leaf.immutableData.ticketRef));
          leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [saleProof, propertiesProof]);

          await challengeLeafConsistencySucceeds('Ticket property must be signed by vendor');
        });

        it('if the saleProof is invalid', async () => {
          const propertiesProof = await testHelper.sign(accounts.eventOwner,
              testHelper.hash(TransactionType.Sell, leaf.mutableData.properties));
          const saleProof = await testHelper.sign(leaf.immutableData.vendor, testHelper.randomBytes32());
          leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [saleProof, propertiesProof]);

          await challengeLeafConsistencySucceeds('Ticket identity must be signed by vendor');
        });

        it('if the sigma merchant signed hash is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.validator, accounts.ticketOwner,
              leaf.immutableData);
          await challengeLeafConsistencySucceeds('Sigma merchant signed hash must be signed by vendor');
        });

        it('if the sigma proof is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createInvalidSigmaData(accounts.eventOwner, accounts.ticketOwner,
              leaf.immutableData);

          await challengeLeafConsistencySucceeds('Sigma proof is invalid');
        });

        it('if the numResells is greater than zero', async () => {
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [1, 0]);

          await challengeLeafConsistencySucceeds('Sell must have zero value for num resells in rules data');
        });

        it('if the numTransfers is greater than zero', async () => {
          leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [0, 1]);

          await challengeLeafConsistencySucceeds('Sell must have zero value for num transfers in rules data');
        });
      });

      context('for a resale leaf', async () => {
        const ticketOwnerProof = testHelper.randomBytes32(); // We don't check the ticket owner proof.

        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createResaleLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the reseller proof is invalid but signed by a valid reseller', async () => {
          const resellerProof = await testHelper.sign(accounts.eventOwner, testHelper.randomBytes32());
          leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);

          await challengeLeafConsistencySucceeds('Reseller proof must contain correct data and be signed by valid reseller');
        });

        it('if the reseller proof is valid but not signed by a valid reseller', async () => {
          const resellerProof = await testHelper.sign(accounts.ticketOwner, testHelper.hash(ticketOwnerProof));
          leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);

          await challengeLeafConsistencySucceeds('Reseller proof must contain correct data and be signed by valid reseller');
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous Merkle root must be registered');
        });

        it('if the sigma merchant signed hash is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createSigmaData(accounts.validator, accounts.ticketOwner,
              leaf.immutableData);

          await challengeLeafConsistencySucceeds('Sigma merchant signed hash must be signed by reseller');
        });

        it('if the sigma proof is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createInvalidSigmaData(accounts.eventOwner, accounts.ticketOwner,
              leaf.immutableData);

          await challengeLeafConsistencySucceeds('Sigma proof is invalid');
        });
      });

      context('for a transfer leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createTransferLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous Merkle root must be registered');
        });

        it('if the sigma proof is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createInvalidSigmaData(accounts.eventOwner, accounts.ticketOwner,
              leaf.immutableData);

          await challengeLeafConsistencySucceeds('Sigma proof is invalid');
        });
      });

      context('for an update leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createUpdateLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the update proof is invalid', async () => {
          leaf.provenance = await testHelper.sign(accounts.eventOwner, testHelper.randomBytes32());

          await challengeLeafConsistencySucceeds(
              'Update proof must contain correct data and be signed by original vendor or event owner');
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous Merkle root must be registered');
        });
      });

      context('for a cancel leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createCancelLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the cancel proof is invalid', async () => {
          leaf.provenance = await testHelper.sign(accounts.eventOwner, testHelper.randomBytes32());
          await challengeLeafConsistencySucceeds(
              'Proof must contain correct data and be signed by original vendor or event owner');
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous Merkle root must be registered');
        });

        it('if the sigma data was not cleared', async () => {
          leaf.mutableData.sigmaData = '0x1234';
          await challengeLeafConsistencySucceeds('Cancel leaf must have no sigma data');
        });
      });

      context('for a redeem leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createRedeemLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the redeem proof is invalid', async () => {
          leaf.provenance = await testHelper.sign(accounts.eventOwner, testHelper.randomBytes32());
          await challengeLeafConsistencySucceeds(
              'Proof must contain correct data and be signed by original vendor or event owner');
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous Merkle root must be registered');
        });

        it('if the sigma proof is invalid', async () => {
          leaf.mutableData.sigmaData = await sigmaHelper.createInvalidSigmaData(accounts.eventOwner, accounts.ticketOwner,
              leaf.immutableData);

          await challengeLeafConsistencySucceeds('Sigma proof is invalid');
        });
      });

      it('for an invalid transaction type', async () => {
        leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Bad);
        await challengeLeafConsistencySucceeds('Leaf is incorrectly formatted');
      });

      it ('with incorrectly formatted leaf data', async () => {
        const badLeafEncoding = testHelper.encodeParams(['uint','string','bytes'], [1,'bad',testHelper.randomBytes32()]);

        await challengeLeafConsistencySucceeds('Leaf is incorrectly formatted', badLeafEncoding);
      });

    });

    context ('fails', async () => {
      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it ('refers to a node', async () => {
        // a merkle node pre-image would be composed of two bytes32 child hashes
        const node = testHelper.encodeParams(['bytes32', 'bytes32'], [testHelper.randomBytes32(), testHelper.randomBytes32()]);
        await challengeLeafConsistencyFails('Challenge failed - nodes cannot be challenged', false, node);
      });

      context('for a sale leaf', async () => {
        beforeEach(async () => {
          leaf = await merkleLeafTestHelper.createSaleLeaf();
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a resale leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createResaleLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a transfer leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createTransferLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for an update leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createUpdateLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a cancel leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createCancelLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });

      context('for a redeem leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await merkleLeafTestHelper.createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await merkleLeafTestHelper.createRedeemLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to a registered merkle root', true);
        });
      });
    });
  });
});