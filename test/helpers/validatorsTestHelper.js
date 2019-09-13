let testHelper, avtTestHelper, timeTestHelper, validatorsManager, evidenceURL;

const validatorDesc = 'Some description';

async function init(_testHelper, _avtTestHelper, _timeTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  timeTestHelper = _timeTestHelper;

  validatorsManager = testHelper.getValidatorsManager();

  evidenceURL = testHelper.validEvidenceURL;
}

async function depositAndRegisterValidator(_validatorAddress) {
  const deposit = await validatorsManager.getNewValidatorDeposit();
  await avtTestHelper.addAVT(deposit, _validatorAddress);
  await validatorsManager.registerValidator(_validatorAddress, evidenceURL, validatorDesc);
  return deposit;
}

async function deregisterValidatorAndWithdrawDeposit(_validatorAddress) {
  const deposit = await validatorsManager.getExistingValidatorDeposit(_validatorAddress);
  await validatorsManager.deregisterValidator(_validatorAddress);
  await avtTestHelper.withdrawAVT(deposit, _validatorAddress);
}

async function getExistingValidatorDeposit(_validatorAddress) {
  return validatorsManager.getExistingValidatorDeposit(_validatorAddress);
}

async function getDeregistrationTime(_validatorAddress) {
  return validatorsManager.getDeregistrationTime(_validatorAddress);
}

async function advanceToDeregistrationTime(_validatorAddress) {
  return timeTestHelper.advanceToTime(await getDeregistrationTime(_validatorAddress));
}

// Keep exports alphabetical.
module.exports = {
  advanceToDeregistrationTime,
  depositAndRegisterValidator,
  deregisterValidatorAndWithdrawDeposit,
  getDeregistrationTime,
  getExistingValidatorDeposit,
  init
};