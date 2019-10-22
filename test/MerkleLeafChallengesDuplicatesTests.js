const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const TransactionType = merkleTreeHelper.TransactionType;

contract('MerkleLeafChallenges', async () => {
  let accounts, merkleLeafChallenges;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'challenger');

    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
  });

  after(async () => {
    await validatorsTestHelper.advanceToDeregistrationTime(accounts.validator, "Validator");
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  context('challengeLeafDuplication', async () => {

    async function challengeLeafDuplicationSucceeds(_trxType, _sameTree) {
      const encodedExistingLeaf = createEncodedLeaf(1, _trxType);
      const encodedDuplicateLeaf = encodedExistingLeaf;

      let existingMerklePath, duplicateMerklePath, existingMerkleTree, duplicateMerkleTree;
      if (_sameTree) {
        existingMerkleTree = await createAndRegisterMerkleTree(encodedExistingLeaf, encodedDuplicateLeaf);
        existingMerklePath = existingMerkleTree.merklePath1;
        duplicateMerkleTree = existingMerkleTree;
        duplicateMerklePath = existingMerkleTree.merklePath2;
      } else {
        existingMerkleTree = await createAndRegisterMerkleTree(encodedExistingLeaf);
        existingMerklePath = existingMerkleTree.merklePath1;
        duplicateMerkleTree = await createAndRegisterMerkleTree(encodedDuplicateLeaf);
        duplicateMerklePath = duplicateMerkleTree.merklePath1;
      }

      await merkleLeafChallenges.challengeLeafDuplication(encodedDuplicateLeaf, duplicateMerklePath, encodedExistingLeaf,
          existingMerklePath, {from: accounts.challenger});
      const logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
      assert.equal(logArgs.rootOwner, accounts.validator);
      assert.equal(logArgs.rootHash, duplicateMerkleTree.rootHash);
      assert.equal(logArgs.leafHash, testHelper.hash(encodedDuplicateLeaf));
      assert.equal(logArgs.challengeReason, "Is a duplicate transaction leaf");

      if (!_sameTree) {
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(existingMerkleTree.rootHash, accounts.validator,
          existingMerkleTree.deposit);
      }

      await avtTestHelper.withdrawAVT(existingMerkleTree.deposit, accounts.challenger);
    }

    async function challengeLeafDuplicationFails(_duplicateLeaf, _duplicateMerklePath, _existingLeaf, _existingMerklePath,
        _expectedError) {
      await testHelper.expectRevert(() => merkleLeafChallenges.challengeLeafDuplication(_duplicateLeaf, _duplicateMerklePath,
          _existingLeaf, _existingMerklePath, {from: accounts.challenger}), _expectedError);
    }

    function createEncodedLeaf(_ticketId, _trxType) {
      const leaf = merkleTreeHelper.getBaseLeaf(_trxType);
      leaf.immutableData.ticketRef = 'Ticket ref' + _ticketId;
      leaf.mutableData.properties = 'My event | Doors 19:30 | Seat G' + _ticketId
      return merkleTreeHelper.encodeLeaf(leaf);
    }

    async function createAndRegisterMerkleTree(_encodedLeaf1, _encodedLeaf2, _isSibling) {
      const encodedLeaf2 = _encodedLeaf2 || testHelper.randomBytes32();
      let leaves = [_encodedLeaf1];
      if (!_isSibling) leaves.push(testHelper.randomBytes32());
      leaves.push(encodedLeaf2);

      const tree = await merkleRootsTestHelper.createAndRegisterMerkleTree(leaves, accounts.validator);
      tree.merklePath1 = tree.getMerklePath(tree.leaves[0], 0);
      const encodedLeaf2Index = _isSibling ? 1 : 2;
      tree.merklePath2 = tree.getMerklePath(tree.leaves[encodedLeaf2Index], encodedLeaf2Index);
      return tree;
    }

    function getRandomMerklePath() {
      return [testHelper.randomBytes32(),testHelper.randomBytes32(),testHelper.randomBytes32(),testHelper.randomBytes32()];
    }

    context('succeeds', async () => {
      it ('for a duplicate initial sale transaction leaf', async () => {
        await challengeLeafDuplicationSucceeds(TransactionType.Sell);
      });

      it ('for a duplicate modification transaction leaf', async () => {
        await challengeLeafDuplicationSucceeds(TransactionType.Resell);
      });

      it ('for a duplicate initial sale on the same tree', async () => {
        await challengeLeafDuplicationSucceeds(TransactionType.Sell, true);
      });
    });

    context('fails', async () => {
      let validLeaf, validTree;

      beforeEach(async () => {
        validLeaf = createEncodedLeaf(1, TransactionType.Sell);
      });

      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(validTree.rootHash, accounts.validator,
            validTree.deposit);
      });

      it ('when the duplicate leaf does not exist', async () => {
        validTree = await createAndRegisterMerkleTree(validLeaf);
        await challengeLeafDuplicationFails(testHelper.randomBytes32(), getRandomMerklePath(), validLeaf, validTree.merklePath1,
            'Challenge failed - duplicate leaf does not exist');
      });

      it ('when the existing leaf does not exist', async () => {
        validTree = await createAndRegisterMerkleTree(validLeaf);
        await challengeLeafDuplicationFails(validLeaf, validTree.merklePath1, testHelper.randomBytes32(), getRandomMerklePath(),
            'Challenge failed - existing leaf does not exist');
      });

      it ('when the leaf is a sibling hash', async () => {
        validTree = await createAndRegisterMerkleTree(validLeaf, validLeaf, true);
        await challengeLeafDuplicationFails(validLeaf, validTree.merklePath1, validLeaf, validTree.merklePath2,
            'Challenge failed - identical sibling hash is not counted as a duplicate');
      });

      it ('when the same leaf in the same tree is provided', async () => {
        validTree = await createAndRegisterMerkleTree(validLeaf);
        await challengeLeafDuplicationFails(validLeaf, validTree.merklePath1, validLeaf, validTree.merklePath1,
            'Challenge failed - same leaf in same tree is not counted as a duplicate');
      });
    });

    context('fails', async () => {
      let validLeaf1, validTree1, validLeaf2, validTree2;

      async function createLeavesAndRegisterTrees(_ticketId1, _ticketId2, _trxType, _wait) {
        validLeaf1 = createEncodedLeaf(_ticketId1, _trxType);
        validTree1 = await createAndRegisterMerkleTree(validLeaf1);
        if (_wait) await timeTestHelper.advanceByOneMinute();
        validLeaf2 = createEncodedLeaf(_ticketId2, _trxType);
        validTree2 = await createAndRegisterMerkleTree(validLeaf2);
      }

      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(validTree1.rootHash, accounts.validator,
            validTree1.deposit);
        await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(validTree2.rootHash, accounts.validator,
            validTree2.deposit);
      });

      it ('when challenged with a different ticket sale', async () => {
        await createLeavesAndRegisterTrees(1, 2, TransactionType.Sell);
        await challengeLeafDuplicationFails(validLeaf2, validTree2.merklePath1, validLeaf1, validTree1.merklePath1,
            'Challenge failed - not a duplicate');
      });

      it ('when the duplicate leaf was registered first', async () => {
        await createLeavesAndRegisterTrees(1, 1, TransactionType.Sell, true);
        await challengeLeafDuplicationFails(validLeaf1, validTree1.merklePath1, validLeaf2, validTree2.merklePath1,
            'Challenge failed - duplicate leaf was registered first');
      });

      it ('for a modification when the previous leaf and previous merklepath differ', async () => {
        await createLeavesAndRegisterTrees(1, 1, TransactionType.Resell);
        await challengeLeafDuplicationFails(validLeaf2, validTree2.merklePath1, validLeaf1, validTree1.merklePath1,
            'Challenge failed - not a duplicate');
      });
    });
  });
});