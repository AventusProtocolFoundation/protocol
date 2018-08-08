const AventitiesManager = artifacts.require("AventitiesManager.sol");
const testHelper = require("./helpers/testHelper");
const web3Utils = require('web3-utils');

contract('AventitiesManager', async () => {
  let aventitiesManager;
  let aventities = {};

  before(async () => {
    await testHelper.before();

    aventitiesManager = await AventitiesManager.deployed();
    avtManager = testHelper.getAVTManager();
    avt = testHelper.getAVTContract();
  });

  after(async () => await testHelper.checkFundsEmpty());

  async function makeDepositForAventity(accountNum, _type) {
    let amount = await aventitiesManager.getAventityMemberDeposit(_type);
    let account = testHelper.getAccount(accountNum);
    if (accountNum != 0) {
        // Any other account will not have any AVT: give them what they need.
        await avt.transfer(account, amount);
    }
    await avt.approve(avtManager.address, amount, {from: account});
    await avtManager.deposit("deposit", amount, {from: account});
    return account;
  }

  async function depositAndRegisterAventityMember(accountNum, _type) {
    let account = await makeDepositForAventity(accountNum, _type);
    await aventitiesManager.registerAventityMember(account, _type, testHelper.evidenceURL, "Registering an aventity");
    // check that this action was properly logged
    const eventArgs = await testHelper.getEventArgs(aventitiesManager.LogAventityMemberRegistered);
    assert.equal(eventArgs.aventityAddress, account, "wrong aventity address");
    let aventityId = eventArgs.aventityId.toNumber();
    aventities[account+_type] = aventityId;
    return account;
  }

  async function deregisterAventityAndWithdrawDeposit(account, _type) {
    await aventitiesManager.deregisterAventity(aventities[account+_type]);
    // check that this action was properly logged
    const eventArgs = await testHelper.getEventArgs(aventitiesManager.LogAventityMemberDeregistered);
    assert.equal(eventArgs.aventityAddress, account, "wrong address");

    await withdrawDeposit(account, _type);
  }

  async function withdrawDeposit(account, _type) {
    let deposit = await aventitiesManager.getAventityMemberDeposit(_type);
    await avtManager.withdraw("deposit", deposit, {from: account});
  }

  async function transferFunds(fund, fromAccount, toAccount, amount) {
    await avtManager.transfer(fund, amount, toAccount, fund, {from: fromAccount});
  }

  context("Register and deregister addresses", async () => {

    async function updateFixedDepositInStorage(_amount, _type) {
      await testHelper.getStorage().setUInt(web3Utils.soliditySha3("Aventity", _type, "fixedDepositAmount"), _amount);
    }

    it("can register and deregister broker addresses", async () => {
      for (i = 0; i < 3; ++i) {
        let expectRegistered = i == 0; // Owner is ALWAYS registered; the rest should not be.
        assert.equal(expectRegistered, await aventitiesManager.aventityIsRegistered(testHelper.getAccount(i), testHelper.brokerAventityType));
        let account = await depositAndRegisterAventityMember(i, testHelper.brokerAventityType);
        assert.equal(true, await aventitiesManager.aventityIsRegistered(account, testHelper.brokerAventityType));
        await deregisterAventityAndWithdrawDeposit(account, testHelper.brokerAventityType);
        assert.equal(expectRegistered, await aventitiesManager.aventityIsRegistered(account, testHelper.brokerAventityType));
      }
    });

    it("cannot register an invalid type", async () => {
      const validType = testHelper.brokerAventityType;
      const invalidType = testHelper.invalidAventityType;
      // use valid type for deposit
      const account = await makeDepositForAventity(1, validType);
      // use invalid type for registration
      await testHelper.expectRevert(() => aventitiesManager.registerAventityMember(account, invalidType, testHelper.evidenceURL, "Registering an aventity"));
      await withdrawDeposit(account, validType);
    });

    it("cannot register broker addresses without a deposit", async () => {
      await testHelper.expectRevert(() => aventitiesManager.registerAventityMember(testHelper.getAccount(0), testHelper.brokerAventityType, testHelper.evidenceURL, "Attempting to register aventity without deposit"));
      await testHelper.expectRevert(() => aventitiesManager.registerAventityMember(testHelper.getAccount(1), testHelper.brokerAventityType, testHelper.evidenceURL, "Attempting to register aventity without deposit"));
      await testHelper.expectRevert(() => aventitiesManager.registerAventityMember(testHelper.getAccount(2), testHelper.brokerAventityType, testHelper.evidenceURL, "Attempting to register aventity without deposit"));
    });

    it("can transfer funds from one account to another", async () => {
      const account0 = testHelper.getAccount(0);
      const account1 = testHelper.getAccount(1);
      const fundAmount = 20000000;
      const halfFundAmount = fundAmount/2;
      const funds = ["deposit", "stake"];

      for (const fund of funds) {
        // add the fundAmount to account 0
        await avt.approve(avtManager.address, fundAmount);
        await avtManager.deposit(fund, fundAmount);

        // check balances
        assert.equal(fundAmount, await avtManager.getBalance(fund, account0));
        assert.equal(0, await avtManager.getBalance(fund, account1));

        // transfer half the fundAmount from account0 to account 1 and check both accounts now have equal funds
        await transferFunds(fund, account0, account1, halfFundAmount);
        assert.equal(halfFundAmount, await avtManager.getBalance(fund, account0));
        assert.equal(halfFundAmount, await avtManager.getBalance(fund, account1));

        //clean up
        await transferFunds(fund, account1, account0, halfFundAmount);
        await avtManager.withdraw(fund, fundAmount);
      };
    });

    it("cannot register an already registered aventity", async () => {
      for (i = 0; i < 3; ++i) {
        let account = await depositAndRegisterAventityMember(i, testHelper.brokerAventityType);
        await makeDepositForAventity(i, testHelper.brokerAventityType);
        await testHelper.expectRevert(() => aventitiesManager.registerAventityMember(account, testHelper.brokerAventityType, testHelper.evidenceURL, "Attempting to register an existing aventity"));
        await withdrawDeposit(account, testHelper.brokerAventityType);
        await deregisterAventityAndWithdrawDeposit(account, testHelper.brokerAventityType);
      }
    });

    it("cannot deregister an already deregistered aventity", async () => {
      await testHelper.expectRevert(() => aventitiesManager.deregisterAventity(aventities[testHelper.getAccount(0)+testHelper.brokerAventityType]));
    });

    it("can register and deregister the same aventity with different types", async () => {
      //Using account 0 will not work because that is the owner account
      let account = await depositAndRegisterAventityMember(1, testHelper.brokerAventityType);
      let account2 = await depositAndRegisterAventityMember(1, testHelper.primaryDelegateAventityType);
      assert.equal(account, account2);

      assert.equal(true, await aventitiesManager.aventityIsRegistered(account, testHelper.brokerAventityType));
      assert.equal(true, await aventitiesManager.aventityIsRegistered(account, testHelper.primaryDelegateAventityType));
      assert.equal(false, await aventitiesManager.aventityIsRegistered(account, testHelper.secondaryDelegateAventityType));

      await deregisterAventityAndWithdrawDeposit(account, testHelper.brokerAventityType);
      assert.equal(false, await aventitiesManager.aventityIsRegistered(account, testHelper.brokerAventityType));
      assert.equal(true, await aventitiesManager.aventityIsRegistered(account, testHelper.primaryDelegateAventityType));
      await deregisterAventityAndWithdrawDeposit(account, testHelper.primaryDelegateAventityType);
      assert.equal(false, await aventitiesManager.aventityIsRegistered(account, testHelper.primaryDelegateAventityType));
    });

    it("can have different deposits for different types", async () => {
      const brokerNewDepositAmount = 146540;
      const primaryDelegateNewDepositAmount = 113480;

      const oldBrokerDepositAmount = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("Aventity", testHelper.brokerAventityType, "fixedDepositAmount"));
      const oldPrimaryDelegateDepositAmount = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("Aventity", testHelper.primaryDelegateAventityType, "fixedDepositAmount"));
      const oneAvtInUsCents = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("OneAVTInUSCents"));

      await updateFixedDepositInStorage(brokerNewDepositAmount, testHelper.brokerAventityType);
      await updateFixedDepositInStorage(primaryDelegateNewDepositAmount, testHelper.primaryDelegateAventityType);

      let brokerDepositAmount = await aventitiesManager.getAventityMemberDeposit(testHelper.brokerAventityType);
      let primaryDelegateDepositAmount = await aventitiesManager.getAventityMemberDeposit(testHelper.primaryDelegateAventityType);

      assert.equal(testHelper.convertToAVTDecimal(oneAvtInUsCents, brokerNewDepositAmount), brokerDepositAmount.toNumber());
      assert.equal(testHelper.convertToAVTDecimal(oneAvtInUsCents, primaryDelegateNewDepositAmount), primaryDelegateDepositAmount.toNumber());

      await updateFixedDepositInStorage(oldBrokerDepositAmount, testHelper.brokerAventityType);
      await updateFixedDepositInStorage(oldPrimaryDelegateDepositAmount, testHelper.primaryDelegateAventityType);
    });
  });
});
