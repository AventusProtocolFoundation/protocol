const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const rulesHelper = require('../utils/rulesHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper');

const EMPTY_BYTES = '0x';
const TransactionType = merkleTreeHelper.TransactionType;
const ConditionType = rulesHelper.ConditionType;

contract('MerkleLeafChallenges - rules', async () => {
  let accounts, eventsManager, merkleLeafChallenges;
  let leaf, encodedLeaf, merkleTree;

  function threeMonthsFrom(timestamp) {
    return timestamp.add(timeTestHelper.oneWeek.mul(new testHelper.BN(12)));
  }

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    eventsManager = testHelper.getEventsManager();
    merkleLeafChallenges = testHelper.getMerkleLeafChallenges();
    accounts = testHelper.getAccounts('eventOwner', 'validator', 'challenger', 'whitelistedTicketOwner', 'ticketOwner');

    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
  });

  after(async () => {
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function challengeLeafRulesSucceeds(_expectedChallengeReason) {
    await merkleLeafChallenges.challengeLeafRules(encodedLeaf, merkleTree.merklePath, {from: accounts.challenger});
    const logArgs = await testHelper.getLogArgs(merkleLeafChallenges, 'LogMerkleLeafChallengeSucceeded');
    assert.equal(logArgs.rootOwner, accounts.validator);
    assert.equal(logArgs.rootHash, merkleTree.rootHash);
    assert.equal(logArgs.leafHash, merkleTree.leafHash);
    assert.equal(logArgs.challengeReason, _expectedChallengeReason);

    await avtTestHelper.withdrawAVT(merkleTree.deposit, accounts.challenger);
  }

  async function challengeLeafRulesFails(_expectedError) {
    await testHelper.expectRevert(() =>
        merkleLeafChallenges.challengeLeafRules(encodedLeaf, merkleTree.merklePath, {from: accounts.challenger}),
        _expectedError);
  }

  function createResaleTransactionRules() {
    let condition = rulesHelper.createLimitCondition('limited resales', ConditionType.NumPermittedResells, 3);
    let conditions = rulesHelper.createRuleConditions(condition, EMPTY_BYTES);
    condition = rulesHelper.createLimitCondition('limited change owners', ConditionType.NumPermittedChangesOfOwnership, 7);
    conditions = rulesHelper.createRuleConditions(condition, conditions);
    const resaleRule = rulesHelper.createRule('Resale Rule', conditions);
    const resaleRules = rulesHelper.createRules(resaleRule, EMPTY_BYTES);
    return rulesHelper.createTransactionRules(TransactionType.Resell, resaleRules);
  }

  function createTransferTransactionRules() {
    let condition = rulesHelper.createLimitCondition('limited transfers', ConditionType.NumPermittedTransfers, 5);
    let conditions = rulesHelper.createRuleConditions(condition, EMPTY_BYTES);
    condition = rulesHelper.createLimitCondition('limited change owners', ConditionType.NumPermittedChangesOfOwnership, 7);
    conditions = rulesHelper.createRuleConditions(condition, conditions);
    const transferRule = rulesHelper.createRule('Transfer Rule', conditions);
    const transferRules = rulesHelper.createRules(transferRule, EMPTY_BYTES);
    return rulesHelper.createTransactionRules(TransactionType.Transfer, transferRules);
  }

  async function createEventWithRulesAndPublishLeafToTestRules(_numResells, _numTransfers, _transactionType) {
    leaf = merkleTreeHelper.getBaseLeaf(_transactionType);
    let eventRules = rulesHelper.createEventRules(createResaleTransactionRules(), EMPTY_BYTES);
    eventRules = rulesHelper.createEventRules(createTransferTransactionRules(), eventRules);
    leaf.immutableData.eventId = (await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator, eventRules)).toString();
    leaf.mutableData.mutableRulesData = testHelper.encodeParams(['uint', 'uint'], [_numResells, _numTransfers]);
    encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
    merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
  }

  context('for event creation', async () => {
    it('fails with duplicate rules for the transaction type', async () => {
      const eventRules = rulesHelper.createEventRules(createResaleTransactionRules(), EMPTY_BYTES);
      const eventRulesWithDuplicateResaleRules = rulesHelper.createEventRules(createResaleTransactionRules(), eventRules);
      await testHelper.expectRevert(() => eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator,
          eventRulesWithDuplicateResaleRules, {from: accounts.challenger}), 'Rule duplicates for transaction type');
    });
  });

  context('for a sale leaf', async () => {
    let vipSaleStart, vipSaleEnd, generalSaleStart, generalSaleEnd

    function makeLeafVIP() {
      leaf.immutableData.immutableRulesData = testHelper.encodeParams(['string', 'address[]'], ['VIP', []]);
      encodedLeaf = merkleTreeHelper.encodeLeaf(leaf)
    }

    function createSaleEventRules() {
      // Set up two rules: sales are allowed if sold:
      //  - in the first period AND they are VIP tickets; OR
      //  - in the last period AND they are NOT VIP tickets
      const vipTicketGroupCondition = rulesHelper.createTicketGroupCondition('only VIP tickets', 'VIP', true);
      let vipConditions = rulesHelper.createRuleConditions(vipTicketGroupCondition, EMPTY_BYTES);
      const vipTimeCondition = rulesHelper.createTransactionTimeCondition('early sales period', vipSaleStart, vipSaleEnd);
      vipConditions = rulesHelper.createRuleConditions(vipTimeCondition, vipConditions);
      const vipRule = rulesHelper.createRule('VIP sales', vipConditions);

      const nonVipTicketGroupCondition = rulesHelper.createTicketGroupCondition('not VIP tickets', 'VIP', false);
      let generalConditions = rulesHelper.createRuleConditions(nonVipTicketGroupCondition, EMPTY_BYTES);
      const generalTimeCondition = rulesHelper.createTransactionTimeCondition('late sales period', generalSaleStart,
          generalSaleEnd);
      generalConditions = rulesHelper.createRuleConditions(generalTimeCondition, generalConditions);
      const generalSaleRule = rulesHelper.createRule('General sales', generalConditions);

      const saleRules = rulesHelper.createRules(generalSaleRule, rulesHelper.createRules(vipRule, EMPTY_BYTES));

      const saleTransactionRules = rulesHelper.createTransactionRules(TransactionType.Sell, saleRules);
      return rulesHelper.createEventRules(saleTransactionRules, EMPTY_BYTES);
    }

    beforeEach(async () => {
      vipSaleStart = timeTestHelper.now();
      vipSaleEnd = threeMonthsFrom(vipSaleStart);
      generalSaleStart = threeMonthsFrom(vipSaleEnd);
      generalSaleEnd = threeMonthsFrom(generalSaleStart);

      const eventId = await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator, createSaleEventRules());
      leaf = merkleTreeHelper.getBaseLeaf(TransactionType.Sell);
      leaf.immutableData.eventId = eventId.toString();
      encodedLeaf = merkleTreeHelper.encodeLeaf(leaf)
    });

    context('succeeds', async () => {
      it('if non-VIP sale attempted in early sale period', async () => {
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
        await challengeLeafRulesSucceeds('All rules failed: General sales - late sales period; VIP sales - only VIP tickets');
      });

      it('if VIP sale attempted in later sale period', async () => {
        await timeTestHelper.advanceToTime(generalSaleStart);

        makeLeafVIP();
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
        await challengeLeafRulesSucceeds('All rules failed: General sales - not VIP tickets; VIP sales - early sales period');
      });

      context('in no-sales period', async () => {
        const failureReason = 'All rules failed: General sales - late sales period; VIP sales - early sales period';
        beforeEach(async () => {
          await timeTestHelper.advanceToTime(vipSaleEnd.add(testHelper.BN_ONE));
        });

        it('if non-VIP sale', async () => {
          merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
          await challengeLeafRulesSucceeds(failureReason);
        });

        it('if VIP sale', async () => {
          makeLeafVIP();
          merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
          await challengeLeafRulesSucceeds(failureReason);
        });
      });
    });

    context('fails when valid sale', async () => {

      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it('if the challenge window has passed', async () => {
        // would cause challenge to succeed - if it were made in time
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await timeTestHelper.advancePastChallengeWindow();
        await challengeLeafRulesFails('Challenge window expired');
      });

      it('if VIP in first sale period', async () => {
        makeLeafVIP();
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
      });

      it('if non-VIP in general sale', async () => {
        await timeTestHelper.advanceToTime(generalSaleStart);

        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
      });
    });
  });

  context('for a resale leaf', async () => {
    context('succeeds', async () => {
      it('when the number of resales exceeds the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(4, 0, TransactionType.Resell);
        await challengeLeafRulesSucceeds('All rules failed: Resale Rule - limited resales');
      });

      it('when the number of changes of ownership exceeds the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(3, 5, TransactionType.Resell);
        await challengeLeafRulesSucceeds('All rules failed: Resale Rule - limited change owners');
      });
    });

    context('fails', async () => {
      it('when the number of resales falls within the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(3, 0, TransactionType.Resell);
        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it('when the number of changes of ownership falls within the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(3, 4, TransactionType.Resell);
        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });
    });
  });

  context('for a transfer leaf', async () => {
    context('succeeds', async () => {
      it('when the number of transfers exceeds the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(0, 6, TransactionType.Transfer);
        await challengeLeafRulesSucceeds('All rules failed: Transfer Rule - limited transfers');
      });

      it('when the number of changes of ownership exceeds the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(3, 5, TransactionType.Transfer);
        await challengeLeafRulesSucceeds('All rules failed: Transfer Rule - limited change owners');
      });
    });

    context('fails', async () => {
      it('when the number of transfers falls within the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(0, 5, TransactionType.Transfer);
        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it('when the number of changes of ownership falls within the limit', async () => {
        await createEventWithRulesAndPublishLeafToTestRules(3, 4, TransactionType.Transfer);
        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });
    });
  });

  context('for whitelisting', async () => {
    var eventId;

    function createWhitelistRules() {
      // Set up two rules:
      //  - tickets owned by whitelisted addresses CANNOT be updated. They are protected.
      //  - only whitelisted addresses can be transferred to.
      const isInWhiteList = rulesHelper.createWhitelistCondition('is in whitelist', true);
      const isNotInWhiteList = rulesHelper.createWhitelistCondition('is not in whitelist', false);

      const protectedFromUpdateConditions = rulesHelper.createRuleConditions(isNotInWhiteList, EMPTY_BYTES);
      const protectedFromUpdateRule = rulesHelper.createRule('Only update not in whitelist', protectedFromUpdateConditions);
      const updateRules = rulesHelper.createRules(protectedFromUpdateRule, EMPTY_BYTES);
      const updateTransactionRules = rulesHelper.createTransactionRules(TransactionType.Update, updateRules);

      const onlyTransferWhitelistedConditions = rulesHelper.createRuleConditions(isInWhiteList, EMPTY_BYTES);
      const onlyTransferWhitelistedRule = rulesHelper.createRule('Only transfer to whitelisted addresses',
          onlyTransferWhitelistedConditions);
      const transferRules = rulesHelper.createRules(onlyTransferWhitelistedRule, EMPTY_BYTES);
      const transferTransactionRules = rulesHelper.createTransactionRules(TransactionType.Transfer, transferRules);

      const eventRules = rulesHelper.createEventRules(transferTransactionRules, EMPTY_BYTES);
      return rulesHelper.createEventRules(updateTransactionRules, eventRules);
    }

    async function setWhitelistedLeaf(_transactionType, _ticketOwner) {
      leaf = merkleTreeHelper.getBaseLeaf(_transactionType);
      leaf.immutableData.immutableRulesData = testHelper.encodeParams(['string', 'address[]'], ['', [accounts.whitelistedTicketOwner]]);
      leaf.immutableData.eventId = eventId.toString();
      leaf.mutableData.snarkData = await merkleTreeHelper.createDummySnarkData(accounts.validator, _ticketOwner);
      encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
    }

    beforeEach(async () => {
      eventId = await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator, createWhitelistRules());
    });

    context('succeeds', async () => {
      it('if attempted update to whitelisted ticket', async () => {
        await setWhitelistedLeaf(TransactionType.Update, accounts.whitelistedTicketOwner);
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await challengeLeafRulesSucceeds('All rules failed: Only update not in whitelist - is not in whitelist');
      });

      it('if attempted transfer to non-whitelisted ticket', async () => {
        await setWhitelistedLeaf(TransactionType.Transfer, accounts.ticketOwner);
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await challengeLeafRulesSucceeds('All rules failed: Only transfer to whitelisted addresses - is in whitelist');
      });
    });

    context('fails', async () => {
      afterEach(async () => {
        await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
            merkleTree.deposit);
      });

      it('update to non-whitelisted ticket', async () => {
        await setWhitelistedLeaf(TransactionType.Update, accounts.ticketOwner);
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
      });

      it('transfer to whitelisted address', async () => {
        await setWhitelistedLeaf(TransactionType.Transfer, accounts.whitelistedTicketOwner);
        merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);

        await challengeLeafRulesFails('Challenge failed - leaf passes all rules');
      });
    });
  });

  context('where no rules are applied', async () => {

    async function createEventFailRulesChallengeAndCleanUp(_rules, _transactionType) {
      const eventId = await eventsTestHelper.createEvent(accounts.eventOwner, accounts.validator, _rules);
      leaf = merkleTreeHelper.getBaseLeaf(_transactionType);
      leaf.immutableData.eventId = eventId.toString();
      encodedLeaf = merkleTreeHelper.encodeLeaf(leaf);
      merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree(encodedLeaf, accounts.validator);
      await challengeLeafRulesFails('Challenge failed - there are no rules for this transaction type');
      await merkleRootsTestHelper.advanceTimeDeregisterRootAndWithdrawDeposit(merkleTree.rootHash, accounts.validator,
          merkleTree.deposit);
    }

    it('fails with no rules set at the event level', async () => {
      await createEventFailRulesChallengeAndCleanUp(EMPTY_BYTES, TransactionType.Sell);
    });

    it('fails with no rules which apply to the transaction type', async () => {
      let eventRules = rulesHelper.createEventRules(createResaleTransactionRules(), EMPTY_BYTES);
      await createEventFailRulesChallengeAndCleanUp(eventRules, TransactionType.Update);
    });
  });
});