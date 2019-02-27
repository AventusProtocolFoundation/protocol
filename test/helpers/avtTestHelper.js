const BN = web3.utils.BN;

let testHelper, avtManager, aventusStorage, avt, accounts;

const oneAVTTo18SigFig = (new BN(10)).pow(new BN(18));

async function init(_testHelper) {
  testHelper = _testHelper;
  avtManager = testHelper.getAVTManager();
  aventusStorage = testHelper.getAventusStorage();
  avt = testHelper.getAVTIERC20();
  // special case referencing accounts directly within a helper as account 0 is the only account initialised with any AVT
  accounts = testHelper.getAccounts('avtAccount');
}

async function approve(_amount, _sender) {
  await avt.approve(aventusStorage.address, _amount, {from: _sender});
}

async function addAVT(_amount, _sender) {
  if (_sender != accounts.avtAccount) {
    // Any other account will not have any AVT: give them what they need.
    await avt.transfer(_sender, _amount);
  }

  await approve(_amount, _sender);
  await avtManager.deposit(_amount, {from: _sender});
}

async function withdrawAVT(_depositAmount, _withdrawer) {
  await avtManager.withdraw(_depositAmount, {from: _withdrawer});
}

async function clearAVTAccount(_account) {
  let deposit = await avtManager.getBalance(_account);
  await withdrawAVT(deposit, _account);
}

async function balanceOf(_avtOwner) {
  return avt.balanceOf(_avtOwner);
}

async function totalBalance() {
  return avt.balanceOf(aventusStorage.address);
}

async function checkBalancesAreZero(_accounts) {
  for (let accountName in _accounts) {
    let account = _accounts[accountName];
    checkBalanceIsZero(account, accountName);
  }
  let totalAVTBalance = await totalBalance();
  testHelper.assertBNZero(totalAVTBalance, 'Total balance not cleared');
}

async function checkBalanceIsZero(_account, _accountName) {
  const depositBalance = await avtManager.getBalance(_account);
  testHelper.assertBNZero(depositBalance, (_accountName + ' has AVT: ' + depositBalance));
}

function toNat(_amountInAVT) {
  return _amountInAVT.mul(oneAVTTo18SigFig);
}

// Keep exports alphabetical.
module.exports = {
  addAVT,
  approve,
  balanceOf,
  checkBalancesAreZero,
  clearAVTAccount,
  init,
  oneAVTTo18SigFig,
  toNat,
  totalBalance,
  withdrawAVT,
};