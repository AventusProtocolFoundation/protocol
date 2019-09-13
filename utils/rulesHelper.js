// NOTE; This must increment from zero and the order must match ConditionType in LMerkleLeafRules & LEventsRules.
const ConditionType = {
  TransactionTimeIsBetween: 0,
  NumPermittedResells: 1,
  NumPermittedTransfers: 2,
  NumPermittedChangesOfOwnership: 3,
  TicketGroupMatches: 4,
  TicketOwnerIsInWhitelist: 5,
  INVALID: 6,
  WAY_BEYOND_ANY_REASONABLE_VALIDITY: 7
}

function createTransactionTimeCondition(_conditionName, _lowerBound, _upperBound) {
  const constraints = web3.eth.abi.encodeParameters(['uint', 'uint'], [safeToNumber(_lowerBound), safeToNumber(_upperBound)]);
  return web3.eth.abi.encodeParameters(['string', 'uint', 'bytes'],
      [_conditionName, ConditionType.TransactionTimeIsBetween, constraints]);
}

function createLimitCondition(_conditionName, _conditionType, _limit) {
  const constraints = web3.eth.abi.encodeParameters(['uint'], [_limit]);
  return web3.eth.abi.encodeParameters(['string', 'uint', 'bytes'], [_conditionName, _conditionType, constraints]);
}

function createTicketGroupCondition(_name, _ticketGroup, _isEqualTo) {
  const constraints = web3.eth.abi.encodeParameters(['string', 'bool'], [_ticketGroup, _isEqualTo]);
  return web3.eth.abi.encodeParameters(['string', 'uint', 'bytes'], [_name, ConditionType.TicketGroupMatches, constraints]);
}

function createWhitelistCondition(_name, _isInWhitelist) {
  const constraints = web3.eth.abi.encodeParameters(['bool'], [_isInWhitelist]);
  return web3.eth.abi.encodeParameters(['string', 'uint', 'bytes'],
      [_name, ConditionType.TicketOwnerIsInWhitelist, constraints]);
}

function createRuleConditions(_condition, _otherConditions) {
  return web3.eth.abi.encodeParameters(['bytes', 'bytes'], [_condition, _otherConditions]);
}

function createRule(_ruleName, _conditions) {
  return web3.eth.abi.encodeParameters(['string', 'bytes'], [_ruleName, _conditions]);
}

function createRules(_rule, _otherRules) {
  return web3.eth.abi.encodeParameters(['bytes', 'bytes'], [_rule, _otherRules]);
}

function createTransactionRules(_transactionType, _rules) {
  return web3.eth.abi.encodeParameters(['uint', 'bytes'], [_transactionType, _rules]);
}

function createEventRules(_transactionRules, _otherTransactionsRules) {
  return web3.eth.abi.encodeParameters(['bytes', 'bytes'], [_transactionRules, _otherTransactionsRules]);
}

function safeToNumber(_number) {
  return typeof _number === 'number' ? _number : _number.toNumber();
}

// Keep exports alphabetical.
module.exports = {
  ConditionType,
  createTransactionTimeCondition,
  createEventRules,
  createLimitCondition,
  createRule,
  createRuleConditions,
  createRules,
  createTicketGroupCondition,
  createTransactionRules,
  createWhitelistCondition
};