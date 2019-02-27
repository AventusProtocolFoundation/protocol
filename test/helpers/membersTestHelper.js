let testHelper, avtTestHelper, timeTestHelper, membersManager, evidenceURL, aventusStorage;

const memberDesc = 'Some description';

const memberTypes = {
  tokenBondingCurve: 'TokenBondingCurve',
  validator: 'Validator',
  bad: 'invalid'
};

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;

  membersManager = testHelper.getMembersManager();
  aventusStorage = testHelper.getAventusStorage();

  evidenceURL = testHelper.validEvidenceURL;
}

async function depositAndRegisterMember(_memberAddress, _memberType) {
  const deposit = await membersManager.getNewMemberDeposit(_memberType);
  await avtTestHelper.addAVT(deposit, _memberAddress);
  await membersManager.registerMember(_memberAddress, _memberType, evidenceURL, memberDesc);
  return deposit;
}

async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
  const deposit = await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
  await advanceToDeregistrationTime(_memberAddress, _memberType);
  await membersManager.deregisterMember(_memberAddress, _memberType);
  await avtTestHelper.withdrawAVT(deposit, _memberAddress);
}

async function getExistingMemberDeposit(_memberAddress, _memberType) {
  return await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
}

async function advanceToDeregistrationTime(_memberAddress, _memberType) {
  const earliestDeregistrationKey = testHelper.hash('Member', _memberAddress, 'type', _memberType,
      'earliestDeregistrationTime');
  const earliestDeregistrationTime = await aventusStorage.getUInt(earliestDeregistrationKey);
  if (earliestDeregistrationTime > 0) {
    await timeTestHelper.advanceToTime(earliestDeregistrationTime);
  }
}

// Keep exports alphabetical.
module.exports = {
  depositAndRegisterMember,
  deregisterMemberAndWithdrawDeposit,
  getExistingMemberDeposit,
  init,
  memberTypes
};