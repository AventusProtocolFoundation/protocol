const AppsManager = artifacts.require("AppsManager.sol");
const testHelper = require("./helpers/testHelper");

contract('AppsManager', function () {
  let appsManager;

  before(async function() {
    await testHelper.before();

    appsManager = await AppsManager.deployed();
    aventusVote = testHelper.getAventusVote();
    avt = testHelper.getAVTContract();
  });

  after(async () => await testHelper.checkFundsEmpty());

  async function makeDepositForApp(accountNum) {
    let amount = await appsManager.getAppDeposit();
    let account = testHelper.getAccount(accountNum);
    if (accountNum != 0) {
        // Any other account will not have any AVT: give them what they need.
        await avt.transfer(account, amount);
    }
    await avt.approve(aventusVote.address, amount, {from: account});
    await aventusVote.deposit("deposit", amount, {from: account});
    return account;
  }

  async function depositAndRegisterApp(accountNum) {
    let account = await makeDepositForApp(accountNum);
    await appsManager.registerApp(account);
    return account;
  }

  async function deregisterAppAndWithdrawDeposit(account) {
    await appsManager.deregisterApp(account);
    await withdrawDeposit(account);
  }

  async function withdrawDeposit(account) {
    let deposit = await appsManager.getAppDeposit();
    await aventusVote.withdraw("deposit", deposit, {from: account});
  }

  context("Register and deregister apps", function() {
    it("can register and deregister app addresses", async function() {
      for (i = 0; i < 3; ++i) {
        let expectRegistered = i == 0; // Owner is ALWAYS registered; the rest should not be.
        assert.equal(expectRegistered, await appsManager.appIsRegistered(testHelper.getAccount(i)));
        let account = await depositAndRegisterApp(i);
        assert.equal(true, await appsManager.appIsRegistered(account));
        await deregisterAppAndWithdrawDeposit(account);
        assert.equal(expectRegistered, await appsManager.appIsRegistered(account));
      }
    });

    it("cannot register app addresses without a deposit", async function() {
      await testHelper.expectRevert(() => appsManager.registerApp(testHelper.getAccount(0)));
      await testHelper.expectRevert(() => appsManager.registerApp(testHelper.getAccount(1)));
      await testHelper.expectRevert(() => appsManager.registerApp(testHelper.getAccount(2)));
    });

    it("cannot register an already registered app", async function() {
      for (i = 0; i < 3; ++i) {
        let account = await depositAndRegisterApp(i);
        await makeDepositForApp(i);
        await testHelper.expectRevert(() => appsManager.registerApp(account));
        await withdrawDeposit(account);
        await deregisterAppAndWithdrawDeposit(account);
      }
    });

    it("cannot deregister an already deregistered app", async function() {
      await testHelper.expectRevert(() => appsManager.deregisterApp(testHelper.getAccount(0)));
      await testHelper.expectRevert(() => appsManager.deregisterApp(testHelper.getAccount(1)));
      await testHelper.expectRevert(() => appsManager.deregisterApp(testHelper.getAccount(2)));
    });
  });
});
