let testHelper, avtTestHelper, timeTestHelper, membersManager, evidenceURL;

const memberDesc = 'Some description';

const memberTypes = {
  tokenBondingCurve: 'TokenBondingCurve',
  validator: 'Validator',
  bad: 'invalid'
};

const coolingOffPeriods = {
  validator: 90,
  maximum: 90
}

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;

  membersManager = testHelper.getMembersManager();

  evidenceURL = testHelper.validEvidenceURL;
}

async function depositAndRegisterMember(_memberAddress, _memberType) {
  const deposit = await membersManager.getNewMemberDeposit(_memberType);
  await avtTestHelper.addAVTToFund(deposit, _memberAddress, 'deposit');
  await membersManager.registerMember(_memberAddress, _memberType, evidenceURL, memberDesc);
  return deposit;
}

async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
  const deposit = await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
  await timeTestHelper.advanceByNumDays(coolingOffPeriods.maximum);
  await membersManager.deregisterMember(_memberAddress, _memberType);
  await avtTestHelper.withdrawAVTFromFund(deposit, _memberAddress, 'deposit');
}

async function getExistingMemberDeposit(_memberAddress, _memberType) {
  return await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
}

// Keep exports alphabetical.
module.exports = {
  coolingOffPeriods,
  depositAndRegisterMember,
  deregisterMemberAndWithdrawDeposit,
  getExistingMemberDeposit,
  init,
  memberTypes
};