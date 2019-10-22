const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingHelper = require('../utils/signingHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper.js');
const rulesHelper = require('../utils/rulesHelper');

const BN = testHelper.BN;
const EMPTY_BYTES = '0x';
const TransactionType = merkleTreeHelper.TransactionType;
const ConditionType = rulesHelper.ConditionType;

contract('EventsManager - events', async () => {
  let eventsManager, accounts, uniqueEventNum;

  const badEventId = 9999;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, avtTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    eventsManager = testHelper.getEventsManager();
    accounts = testHelper.getAccounts('eventOwner', 'notEventOwner', 'validator');
    await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
    uniqueEventNum = 0;
  });

  after(async () => {
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function generateGoodCreateEventParams() {
    const eventDesc = 'My event';
    const eventRef = testHelper.hash(uniqueEventNum++);
    const eventOwner = accounts.eventOwner;
    const rules = '0x';
    const sender = accounts.validator;
    const eventOwnerProof = await signingHelper.getCreateEventEventOwnerProof(eventOwner, eventDesc, rules);
    return {
      eventDesc, eventRef, eventOwner, eventOwnerProof, eventOwner, rules, sender
    };
  }

  function generateEventId(_eventRef, _eventOwner) {
    return testHelper.hash(_eventRef, _eventOwner);
  }

  async function createEvent(_createEventParams) {
    await eventsManager.createEvent(
        _createEventParams.eventDesc,
        _createEventParams.eventRef,
        _createEventParams.eventOwnerProof,
        _createEventParams.eventOwner,
        _createEventParams.rules,
        {from: _createEventParams.sender}
    );
    const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
    return logArgs.eventId;
  }

  context('createEvent()', async () => {
    let goodCreateEventParams, goodEventId;

    beforeEach(async () => {
      // Set up the goodness for all tests.
      goodCreateEventParams = await generateGoodCreateEventParams();
    });

    async function createEventSucceeds() {
      if (goodCreateEventParams.eventOwnerProof === undefined) {
        goodCreateEventParams.eventOwnerProof = await signingHelper.getCreateEventEventOwnerProof(
            goodCreateEventParams.eventOwner, goodCreateEventParams.eventDesc, goodCreateEventParams.rules);
      }
      await eventsManager.createEvent(
          goodCreateEventParams.eventDesc,
          goodCreateEventParams.eventRef,
          goodCreateEventParams.eventOwnerProof,
          goodCreateEventParams.eventOwner,
          goodCreateEventParams.rules,
          {from: goodCreateEventParams.sender}
      );
      const logArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
      assert.equal(logArgs.eventDesc, goodCreateEventParams.eventDesc);
      const logArgsEventId = '0x' + logArgs.eventId.toString(16).padStart(64, '0');
      assert.equal(logArgsEventId, generateEventId(goodCreateEventParams.eventRef, goodCreateEventParams.eventOwner));
      assert.equal(logArgs.eventOwner, goodCreateEventParams.eventOwner);
      return goodEventId = logArgs.eventId;
    }

    async function createEventFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.createEvent(_params.eventDesc, _params.eventRef,_params.eventOwnerProof,
          _params.eventOwner, _params.rules, {from: _params.sender}), _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('via event owner', async () => {
          goodCreateEventParams.sender = accounts.eventOwner;
          goodCreateEventParams.eventOwnerProof = undefined; // Regenerate the proof with this sender.
          await createEventSucceeds();
        });

        it('via validator', async () => {
          await createEventSucceeds();
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        let badParams;

        beforeEach(async () => {
          badParams = goodCreateEventParams;
          badParams.eventOwnerProof = undefined;  // Default to creating the proof.
        });

        async function createEventFailsWithBadParams(_errorString) {
          if (badParams.eventOwnerProof === undefined) {
            badParams.eventOwnerProof = await signingHelper.getCreateEventEventOwnerProof(badParams.eventOwner,
                badParams.eventDesc, badParams.rules);
          }
          return createEventFails(badParams, _errorString);
        }

        it('event description', async () => {
          badParams.eventDesc = '';
          await createEventFailsWithBadParams('Event requires a non-empty description');
        });

        it('duplicate event ref', async () => {
          await createEventSucceeds();
          badParams.eventRef = goodCreateEventParams.eventRef;
          await createEventFailsWithBadParams('Event already exists');
        });

        it('event owner proof', async () => {
          badParams.eventOwnerProof = testHelper.randomBytes32();
          await createEventFailsWithBadParams('Creation proof must be valid and signed by event owner');
        });

        it('sender', async () => {
          badParams.sender = accounts.notEventOwner;
          await createEventFailsWithBadParams('Sender must be a registered validator');
        });
      });
    });
  });

  context('Rule checks', async () => {
    context('checkRuleCondition', async () => {

      async function checkRuleConditionSucceeds(_condition) {
        await eventsManager.checkRuleCondition(_condition);
      }

      async function checkRuleConditionFails(_condition) {
        await testHelper.expectRevert(() => eventsManager.checkRuleCondition(_condition), '');
      }

      context('succeeds', async () => {
        it('with a valid ticket group condition', async () => {
          let condition = rulesHelper.createTicketGroupCondition('condition', 'ticketGroupName', true);
          await checkRuleConditionSucceeds(condition);
        });

        it('with a valid whitelist condition', async () => {
          let condition = rulesHelper.createWhitelistCondition('condition', true);
          await checkRuleConditionSucceeds(condition);
        });

        it('with a valid transaction times condition', async () => {
          let startTime = timeTestHelper.now();
          let endTime = startTime.add(timeTestHelper.oneWeek);
          let condition = rulesHelper.createTransactionTimeCondition('condition', startTime, endTime);
          await checkRuleConditionSucceeds(condition);
        });

        it('with a valid resells condition', async () => {
          let condition = rulesHelper.createLimitCondition('condition', ConditionType.NumPermittedResells, 1);
          await checkRuleConditionSucceeds(condition);
        });

        it('with a valid transfers condition', async () => {
          let condition = rulesHelper.createLimitCondition('condition', ConditionType.NumPermittedTransfers, 1);
          await checkRuleConditionSucceeds(condition);
        });

        it('with a valid changes of ownership condition', async () => {
          let condition = rulesHelper.createLimitCondition('condition', ConditionType.NumPermittedChangesOfOwnership, 1);
          await checkRuleConditionSucceeds(condition);
        });
      });

      context('fails', async () => {
        it('with an invalid condition type', async () => {
          let condition = rulesHelper.createLimitCondition('condition', ConditionType.WAY_BEYOND_ANY_REASONABLE_VALIDITY, 1);
          await checkRuleConditionFails(condition);
        });

        it('with an invalid condition', async () => {
          await checkRuleConditionFails(testHelper.randomBytes32());
        });
      });
    });

    context('checkRule', async () => {
      async function checkRuleSucceeds(_rule) {
        await eventsManager.checkRule(_rule);
      }

      async function checkRuleFails(_rule) {
        await testHelper.expectRevert(() => eventsManager.checkRule(_rule), '');
      }

      context('succeeds', async () => {
        it('with a valid single condition rule', async () => {
          let startTime = timeTestHelper.now();
          let endTime = startTime.add(timeTestHelper.oneWeek);
          let condition = rulesHelper.createTransactionTimeCondition('condition', startTime, endTime);
          let conditions = rulesHelper.createRuleConditions(condition, EMPTY_BYTES);
          let rule = rulesHelper.createRule('ruleName', conditions);
          await checkRuleSucceeds(rule);
        });

        it('with a valid multi condition rule', async () => {
          let condition1 = rulesHelper.createLimitCondition('condition1', ConditionType.NumPermittedResells, 3);
          let condition2 = rulesHelper.createTicketGroupCondition('condition2', 'ticketGroupName', true);
          let condition3 = rulesHelper.createWhitelistCondition('condition3', true);
          let conditions = rulesHelper.createRuleConditions(condition1, EMPTY_BYTES);
          conditions = rulesHelper.createRuleConditions(condition2, conditions);
          conditions = rulesHelper.createRuleConditions(condition3, conditions);
          let rule = rulesHelper.createRule('ruleName', conditions);
          await checkRuleSucceeds(rule);
        });
      });

      context('fails', async () => {
        it('with an invalid condition in the rule', async () => {
          let condition1 = rulesHelper.createLimitCondition('condition1', ConditionType.NumPermittedResells, 3);
          let badCondition = testHelper.randomBytes32();
          let condition3 = rulesHelper.createWhitelistCondition('condition3', true);
          let conditions = rulesHelper.createRuleConditions(condition1, EMPTY_BYTES);
          conditions = rulesHelper.createRuleConditions(badCondition, conditions);
          conditions = rulesHelper.createRuleConditions(condition3, conditions);
          let rule = rulesHelper.createRule('ruleName', conditions);
          await checkRuleFails(rule);
        });

        it('with an invalid rule', async () => {
          let rule = testHelper.randomBytes32();
          await checkRuleFails(rule);
        });
      });
    });

    context('checkTransactionRules', async () => {
      async function checkTransactionRulesSucceeds(_transactionType, _rules) {
        let transactionRules = rulesHelper.createTransactionRules(_transactionType, _rules);
        await eventsManager.checkTransactionRules(transactionRules);
      }

      async function checkTransactionRulesFails(_transactionType, _rules) {
        let transactionRules = rulesHelper.createTransactionRules(_transactionType, _rules);
        await testHelper.expectRevert(() => eventsManager.checkTransactionRules(transactionRules), '');
      }

      function generateRule() {
        let condition = rulesHelper.createLimitCondition('condition1', ConditionType.NumPermittedResells, 3);
        let conditions = rulesHelper.createRuleConditions(condition, EMPTY_BYTES);
        condition = rulesHelper.createTicketGroupCondition('condition2', 'ticketGroupName', true);
        conditions = rulesHelper.createRuleConditions(condition, conditions);
        condition = rulesHelper.createWhitelistCondition('condition3', true);
        conditions = rulesHelper.createRuleConditions(condition, conditions);
        return rulesHelper.createRule('ruleName', conditions);
      }

      function generateSingleRule() {
        let rule = generateRule();
        return rulesHelper.createRules(rule, EMPTY_BYTES);
      }

      function generateMultipleRules() {
        let rule1 = generateRule();
        let rule2 = generateRule();
        let rule3 = generateRule();
        let rules = rulesHelper.createRules(rule1, EMPTY_BYTES);
        rules = rulesHelper.createRules(rule2, rules);
        return rulesHelper.createRules(rule3, rules);
      }

      context('succeeds', async () => {
        it('with a valid single rule for a transaction type', async () => {
          let rule = generateSingleRule();
          await checkTransactionRulesSucceeds(TransactionType.Sell, rule);
        });

        it('with a valid set of rules for a sell transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Sell, rules);
        });

        it('with a valid set of rules for a resell transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Resell, rules);
        });

        it('with a valid set of rules for a transfer transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Transfer, rules);
        });

        it('with a valid set of rules for a cancel transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Cancel, rules);
        });

        it('with a valid set of rules for a redeem transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Redeem, rules);
        });

        it('with a valid set of rules for an update transaction', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesSucceeds(TransactionType.Update, rules);
        });
      });

      context('fails', async () => {
        it('with an invalid transaction type', async () => {
          let rules = generateMultipleRules();
          await checkTransactionRulesFails(100, rules);
        });

        it('with invalid data', async () => {
          let rules = testHelper.randomBytes32();
          await checkTransactionRulesFails(TransactionType.Sell, rules);
        });
      });
    });

    context('checkEventRules', async () => {
      async function checkEventRulesSucceeds(_eventRules) {
        await eventsManager.checkEventRules(_eventRules);
      }

      async function checkEventRulesFails(_eventRules) {
        await testHelper.expectRevert(() => eventsManager.checkEventRules(_eventRules), '');
      }

      function generateRule() {
        let condition = rulesHelper.createLimitCondition('condition1', ConditionType.NumPermittedResells, 3);
        let conditions = rulesHelper.createRuleConditions(condition, EMPTY_BYTES);
        condition = rulesHelper.createTicketGroupCondition('condition2', 'ticketGroupName', true);
        conditions = rulesHelper.createRuleConditions(condition, conditions);
        return rulesHelper.createRule('ruleName', conditions);
      }

      function generateMultipleRules() {
        let rule1 = generateRule();
        let rule2 = generateRule();
        let rule3 = generateRule();
        let rules = rulesHelper.createRules(rule1, EMPTY_BYTES);
        rules = rulesHelper.createRules(rule2, rules);
        return rulesHelper.createRules(rule3, rules);
      }

      function generateTransactionRules(_transactionType) {
        let rules = generateMultipleRules();
        return rulesHelper.createTransactionRules(_transactionType, rules);
      }

      context('succeeds', async () => {
        it('with a valid single set of transaction rules', async () => {
          let transactionRules = generateTransactionRules(TransactionType.Sell);
          let eventRules = rulesHelper.createEventRules(transactionRules, EMPTY_BYTES);
          await checkEventRulesSucceeds(eventRules);
        });

        it('with valid multiple sets of transaction rules', async () => {
          let transactionRules1 = generateTransactionRules(TransactionType.Sell);
          let transactionRules2 = generateTransactionRules(TransactionType.Resell);
          let transactionRules3 = generateTransactionRules(TransactionType.Update);
          let eventRules = rulesHelper.createEventRules(transactionRules1, EMPTY_BYTES);
          eventRules = rulesHelper.createEventRules(transactionRules2, eventRules);
          eventRules = rulesHelper.createEventRules(transactionRules3, eventRules);
          await checkEventRulesSucceeds(eventRules);
        });
      });

      context('fails', async () => {
        it('with invalid data', async () => {
          await checkEventRulesFails(testHelper.randomBytes32());
        });
      });
    });
  });
});