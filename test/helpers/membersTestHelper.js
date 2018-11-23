let testHelper, avtTestHelper, membersManager, evidenceURL;

const memberDesc = 'Some description';

const memberTypes = {
  broker: 'Broker',
  primary: 'Primary',
  secondary: 'Secondary',
  tokenBondingCurve: 'TokenBondingCurve',
  scalingProvider: 'ScalingProvider',
  bad: 'invalid',
};

async function init(_testHelper, _avtTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;

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
  await membersManager.deregisterMember(_memberAddress, _memberType);
  await avtTestHelper.withdrawAVTFromFund(deposit, _memberAddress, 'deposit');
}

async function getExistingMemberDeposit(_memberAddress, _memberType) {
  return await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
}

// Keep exports alphabetical.
module.exports = {
  depositAndRegisterMember,
  deregisterMemberAndWithdrawDeposit,
  getExistingMemberDeposit,
  init,
  memberTypes,
};