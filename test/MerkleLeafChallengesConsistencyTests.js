const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const snarksHelper = require('../utils/snarks/snarksHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const EMPTY_BYTES = '0x';
const validSecret = '28668f1fc6a154ef446cc6f00b690b4452d603f8c7b114b36499deb36408'; // secret needs to be a 60 char hex string
const TransactionType = merkleTreeHelper.TransactionType;

contract('MerkleLeafChallenges - consistency', async () => {
  let accounts, merkleLeafChallenges;
  let ticketId = 0;
  let eventOwnerSnarkData;
  let validatorSnarkData;
  let invalidSnarkData;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'challenger', 'ticketOwner');

    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);

    const goodSnarkData = await snarksHelper.generateSnarkData(validSecret, accounts.eventOwner, accounts.ticketOwner);
    eventOwnerSnarkData = snarksHelper.encodeSnarkData(goodSnarkData);
    validatorSnarkData = await snarksHelper.generateEncodedSnarkData(validSecret, accounts.validator, accounts.ticketOwner);
    const badVal = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbada';
    goodSnarkData.proofObj.proof.A = [badVal, badVal];
    invalidSnarkData = snarksHelper.encodeSnarkData(goodSnarkData);
  });

  after(async () => {
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function createSaleLeaf() {
    const leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Sell);
    const eventId = (await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator)).toString();
    const propertiesProof = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Sell, leaf.mutableData.properties));
    const saleProof = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Sell, eventId, leaf.immutableData.ticketRef));

    leaf.immutableData.eventId = eventId;
    leaf.immutableData.vendor = accounts.eventOwner;
    leaf.mutableData.snarkData = eventOwnerSnarkData;
    leaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [saleProof, propertiesProof]);
    return leaf;
  }

  async function createResaleLeaf(_previousLeaf, _previousLeafMerklePath) {
    const resellLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Resell);
    const ticketOwnerProof = await testHelper.sign(accounts.ticketOwner,
        testHelper.hash(TransactionType.Resell, resellLeaf.mutableData.prevLeafHash, accounts.eventOwner));
    const resellerProof = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Resell, ticketOwnerProof));
    resellLeaf.provenance = testHelper.encodeParams(['bytes', 'bytes'], [resellerProof, ticketOwnerProof]);
    resellLeaf.mutableData.snarkData = eventOwnerSnarkData;
    return resellLeaf;
  }

  async function createTransferLeaf(_previousLeaf, _previousLeafMerklePath) {
    const transferLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Transfer);
    transferLeaf.provenance = await testHelper.sign(accounts.ticketOwner,
        testHelper.hash(TransactionType.Transfer, transferLeaf.mutableData.prevLeafHash));
    transferLeaf.mutableData.snarkData = eventOwnerSnarkData;
    return transferLeaf;
  }

  async function createUpdateLeaf(_previousLeaf, _previousLeafMerklePath) {
    const updateLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Update);
    updateLeaf.mutableData.properties = 'My event | Doors 20:30 | Seat H' + ticketId;
    updateLeaf.provenance = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Update, updateLeaf.mutableData.prevLeafHash, updateLeaf.mutableData.properties));
    return updateLeaf;
  }

  async function createCancelLeaf(_previousLeaf, _previousLeafMerklePath) {
    const cancelLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Cancel);
    cancelLeaf.provenance = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Cancel, cancelLeaf.mutableData.prevLeafHash));
    cancelLeaf.mutableData.snarkData = EMPTY_BYTES;
    return cancelLeaf;
  }

  async function createRedeemLeaf(_previousLeaf, _previousLeafMerklePath) {
    const redeemLeaf = merkleTreeHelper.createModificationLeaf(_previousLeaf, _previousLeafMerklePath,
        TransactionType.Redeem);
    redeemLeaf.provenance = await testHelper.sign(accounts.eventOwner,
        testHelper.hash(TransactionType.Redeem, redeemLeaf.mutableData.prevLeafHash));
    return redeemLeaf;
  }

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

    async function challengeLeafConsistencyFails(_expectedError, _falsifyMerklePath, _encodedLeaf, _pastChallengeWindow) {
      const encodedLeaf = _encodedLeaf || merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
      const merklePath = _falsifyMerklePath ? [testHelper.randomBytes32()] : merkleTree.merklePath;

      if (_pastChallengeWindow) {
        await timeTestHelper.advancePastChallengeWindow();
      }

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
          leaf = await createSaleLeaf();
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

        it('if the snark merchant signed hash is invalid', async () => {
          leaf.mutableData.snarkData = validatorSnarkData;

           await challengeLeafConsistencySucceeds('Snark merchant signed hash must be signed by vendor');
        });

        it('if the snark data is empty', async () => {
          leaf.mutableData.snarkData = EMPTY_BYTES;

          await challengeLeafConsistencySucceeds('Leaf is incorrectly formatted');
        });

        it('if the snark proof is invalid', async () => {
          leaf.mutableData.snarkData = invalidSnarkData;

          await challengeLeafConsistencySucceeds('Snark proof is invalid');
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
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createResaleLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
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

          await challengeLeafConsistencySucceeds('Previous merkle root must be active');
        });

        it('if the snark merchant signed hash is invalid', async () => {
          leaf.mutableData.snarkData = validatorSnarkData;

          await challengeLeafConsistencySucceeds('Snark merchant signed hash must be signed by reseller');
        });

        it('if the snark proof is invalid', async () => {
          leaf.mutableData.snarkData = invalidSnarkData;

          await challengeLeafConsistencySucceeds('Snark proof is invalid');
        });
      });

      context('for a transfer leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createTransferLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the previous merkle root does not exist', async () => {
          leaf.mutableData.prevLeafHash = testHelper.randomBytes32();
          leaf.mutableData.prevMerklePath = [testHelper.randomBytes32()];

          await challengeLeafConsistencySucceeds('Previous merkle root must be active');
        });

        it('if the snark proof is invalid', async () => {
          leaf.mutableData.snarkData = invalidSnarkData;

          await challengeLeafConsistencySucceeds('Snark proof is invalid');
        });
      });

      context('for an update leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createUpdateLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
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

          await challengeLeafConsistencySucceeds('Previous merkle root must be active');
        });
      });

      context('for a cancel leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createCancelLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
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

          await challengeLeafConsistencySucceeds('Previous merkle root must be active');
        });

        it('if the snark data was not cleared', async () => {
          leaf.mutableData.snarkData = '0x1234';
          await challengeLeafConsistencySucceeds('Cancel leaf must have no snark data');
        });
      });

      context('for a redeem leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createRedeemLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
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

          await challengeLeafConsistencySucceeds('Previous merkle root must be active');
        });

        it('if the snark proof is invalid', async () => {
          leaf.mutableData.snarkData = invalidSnarkData;

          await challengeLeafConsistencySucceeds('Snark proof is invalid');
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
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it ('refers to a node', async () => {
        // a merkle node pre-image would be composed of two bytes32 child hashes
        const node = testHelper.encodeParams(['bytes32', 'bytes32'], [testHelper.randomBytes32(), testHelper.randomBytes32()]);
        await challengeLeafConsistencyFails('Challenge failed - nodes cannot be challenged', false, node);
      });

      it('the challenge window has passed', async () => {
        leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Bad); // would cause challenge to succeed - if it were made in time
        await challengeLeafConsistencyFails('Challenge window expired', false, null, true);
      });

      context('for a sale leaf', async () => {
        beforeEach(async () => {
          leaf = await createSaleLeaf();
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });

      context('for a resale leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createResaleLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });

      context('for a transfer leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createTransferLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
              prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });

      context('for an update leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createUpdateLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });

      context('for a cancel leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createCancelLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });

      context('for a redeem leaf', async () => {
        beforeEach(async () => {
          const saleLeaf = await createSaleLeaf();
          prevMerkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(merkleTreeHelper.encodeLeaf(saleLeaf),
              accounts.validator);
          leaf = await createRedeemLeaf(saleLeaf, prevMerkleTree.merklePath);
        });

        afterEach(async () => {
          await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(prevMerkleTree.rootHash, accounts.validator,
            prevMerkleTree.deposit);
        });

        it('if the leaf under challenge is in fact legitimate', async () => {
          await challengeLeafConsistencyFails('Challenge failed - leaf is consistent');
        });

        it('if the merkle proof is invalid', async () => {
          await challengeLeafConsistencyFails('Leaf and path do not refer to an active merkle root', true);
        });
      });
    });
  });
});