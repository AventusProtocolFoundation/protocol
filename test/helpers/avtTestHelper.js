let testHelper, avtManager, aventusStorage, avt, accounts;

const oneAVTTo18SigFig = (new web3.BigNumber(10)).pow(18);
const oneAVTInUSCents = 97; // Matches value in ParameterRegistry.

async function init(_testHelper) {
  testHelper = _testHelper;

  avtManager = testHelper.getAVTManager();
  aventusStorage = testHelper.getAventusStorage();
  avt = testHelper.getAVTIERC20();

  accounts = testHelper.getAccounts('avtOwner');
}

async function approve(_amount, _sender) {
  await avt.approve(aventusStorage.address, _amount, {from: _sender});
}

async function addAVTToFund(_amount, _sender, _fund) {
  if (_sender != accounts.avtOwner) {
    // Any other account will not have any AVT: give them what they need.
    await avt.transfer(_sender, _amount);
  }

  await approve(_amount, _sender);
  await avtManager.deposit(_fund, _amount, {from: _sender});
}

async function withdrawAVTFromFund(_depositAmount, _withdrawer, _fund) {
  await avtManager.withdraw(_fund, _depositAmount, {from: _withdrawer});
}

async function clearAVTFund(_account, _fund) {
  let deposit = await avtManager.getBalance(_fund, _account);
  await withdrawAVTFromFund(deposit, _account, _fund);
}

async function balanceOf(_avtOwner) {
  return avt.balanceOf(_avtOwner);
}

async function totalBalance() {
  return avt.balanceOf(aventusStorage.address);
}

async function checkFundsEmpty(_accounts, _alsoCheckStakes) {
  for (let accountName in _accounts) {
    let account = _accounts[accountName];
    checkFundIsEmpty('deposit', account, accountName);
    if (_alsoCheckStakes) checkFundIsEmpty('stake', account, accountName);
  }
  let totalAVTFunds = await totalBalance();
  assert.equal(totalAVTFunds.toNumber(), 0, 'Total balance not cleared');
}

async function checkFundIsEmpty(_fund, _account, _accountName) {
  const depositBalance = (await avtManager.getBalance(_fund, _account)).toNumber();
  assert.equal(depositBalance, 0, (_fund + ' account ' + _accountName + ' has AVT: ' + depositBalance));
}

function getAVTFromUSCents(_numUSCents) {
  return oneAVTTo18SigFig.mul(_numUSCents).dividedToIntegerBy(oneAVTInUSCents);
}

// Keep exports alphabetical.
module.exports = {
  addAVTToFund,
  approve,
  balanceOf,
  checkFundsEmpty,
  clearAVTFund,
  getAVTFromUSCents,
  init,
  oneAVTTo18SigFig,
  totalBalance,
  withdrawAVTFromFund,
};