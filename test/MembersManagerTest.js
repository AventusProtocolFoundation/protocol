const MembersManager = artifacts.require("MembersManager");
const testHelper = require("./helpers/testHelper");
const web3Utils = require('web3-utils');

contract('MembersManager', async () => {
  let membersManager;

  before(async () => {
    await testHelper.before();

    membersManager = await MembersManager.deployed();
    avtManager = testHelper.getAVTManager();
  });

  after(async () => await testHelper.checkFundsEmpty());

  async function makeDepositForMember(accountNum, _memberType) {
    let amount = await membersManager.getNewMemberDeposit(_memberType);
    let account = testHelper.getAccount(accountNum);

    await testHelper.addAVTToFund(amount, account, "deposit");
    return account;
  }

  async function depositAndRegisterMember(accountNum, _memberType) {
    let account = await makeDepositForMember(accountNum, _memberType);
    await membersManager.registerMember(account, _memberType, testHelper.evidenceURL, "Registering member");
    // check that this action was properly logged
    const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberRegistered);
    assert.equal(eventArgs.memberAddress, account, "wrong address");
    assert.equal(eventArgs.memberType, _memberType, "wrong type");
    return account;
  }

  async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
    await membersManager.deregisterMember(_memberAddress, _memberType);
    const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberDeregistered);
    assert.equal(eventArgs.memberAddress, _memberAddress, "wrong address");
    assert.equal(eventArgs.memberType, _memberType, "wrong type");
    await withdrawDeposit(_memberAddress, _memberType);
  }

  async function withdrawDeposit(account, _memberType) {
    let deposit = await membersManager.getNewMemberDeposit(_memberType);
    await testHelper.withdrawAVTFromFund(deposit, account, 'deposit');
  }

  async function transferFunds(fund, fromAccount, toAccount, amount) {
    await avtManager.transfer(fund, amount, toAccount, fund, {from: fromAccount});
  }

  context("Register and deregister addresses", async () => {

    async function updateFixedDepositInStorage(_amount, _memberType) {
      await testHelper.getStorage().setUInt(web3Utils.soliditySha3("Members", _memberType, "fixedDepositAmount"), _amount);
    }

    it("can register and deregister broker addresses", async () => {
      for (i = 0; i < 3; ++i) {
        assert.equal(false, await membersManager.memberIsActive(testHelper.getAccount(i), testHelper.brokerMemberType));
        let account = await depositAndRegisterMember(i, testHelper.brokerMemberType);
        assert.equal(true, await membersManager.memberIsActive(account, testHelper.brokerMemberType));
        await deregisterMemberAndWithdrawDeposit(account, testHelper.brokerMemberType);
        assert.equal(false, await membersManager.memberIsActive(account, testHelper.brokerMemberType));
      }
    });

    it("cannot register an invalid type", async () => {
      const validType = testHelper.brokerMemberType;
      const invalidType = testHelper.invalidMemberType;
      // use valid type for deposit
      const account = await makeDepositForMember(1, validType);
      // use invalid type for registration
      await testHelper.expectRevert(() => membersManager.registerMember(account, invalidType, testHelper.evidenceURL, "Registering member"));
      await withdrawDeposit(account, validType);
    });

    it("cannot register broker addresses without a deposit", async () => {
      await testHelper.expectRevert(() => membersManager.registerMember(testHelper.getAccount(0), testHelper.brokerMemberType, testHelper.evidenceURL, "Attempting to register broker 0 without deposit"));
      await testHelper.expectRevert(() => membersManager.registerMember(testHelper.getAccount(1), testHelper.brokerMemberType, testHelper.evidenceURL, "Attempting to register broker 1 without deposit"));
      await testHelper.expectRevert(() => membersManager.registerMember(testHelper.getAccount(2), testHelper.brokerMemberType, testHelper.evidenceURL, "Attempting to register broker 2 without deposit"));
    });

    it("can transfer funds from one account to another", async () => {
      const account0 = testHelper.getAccount(0);
      const account1 = testHelper.getAccount(1);
      const fundAmount = 20000000;
      const halfFundAmount = fundAmount/2;
      const funds = ["deposit", "stake"];

      for (const fund of funds) {
        // add the fundAmount to account 0
        await testHelper.addAVTToFund(fundAmount, testHelper.getAccount(0), fund);

        // check balances
        assert.equal(fundAmount, await avtManager.getBalance(fund, account0));
        assert.equal(0, await avtManager.getBalance(fund, account1));

        // transfer half the fundAmount from account0 to account 1 and check both accounts now have equal funds
        await transferFunds(fund, account0, account1, halfFundAmount);
        assert.equal(halfFundAmount, await avtManager.getBalance(fund, account0));
        assert.equal(halfFundAmount, await avtManager.getBalance(fund, account1));

        //clean up
        await transferFunds(fund, account1, account0, halfFundAmount);
        testHelper.withdrawAVTFromFund(fundAmount, account0, fund);
      };
    });

    it("cannot register an already registered member", async () => {
      for (i = 0; i < 3; ++i) {
        let account = await depositAndRegisterMember(i, testHelper.brokerMemberType);
        await makeDepositForMember(i, testHelper.brokerMemberType);
        await testHelper.expectRevert(() => membersManager.registerMember(account, testHelper.brokerMemberType, testHelper.evidenceURL, "Attempting to register an existing member"));
        await withdrawDeposit(account, testHelper.brokerMemberType);
        await deregisterMemberAndWithdrawDeposit(account, testHelper.brokerMemberType);
      }
    });

    it("cannot deregister an already deregistered member", async () => {
      await testHelper.expectRevert(() => membersManager.deregisterMember(testHelper.getAccount(0), testHelper.brokerMemberType));
    });

    it("can register and deregister the same member with different types", async () => {
      //Using account 0 will not work because that is the owner account
      let account = await depositAndRegisterMember(1, testHelper.brokerMemberType);
      let account2 = await depositAndRegisterMember(1, testHelper.primaryDelegateMemberType);
      assert.equal(account, account2);

      assert.equal(true, await membersManager.memberIsActive(account, testHelper.brokerMemberType));
      assert.equal(true, await membersManager.memberIsActive(account, testHelper.primaryDelegateMemberType));
      assert.equal(false, await membersManager.memberIsActive(account, testHelper.secondaryDelegateMemberType));

      await deregisterMemberAndWithdrawDeposit(account, testHelper.brokerMemberType);
      assert.equal(false, await membersManager.memberIsActive(account, testHelper.brokerMemberType));
      assert.equal(true, await membersManager.memberIsActive(account, testHelper.primaryDelegateMemberType));
      await deregisterMemberAndWithdrawDeposit(account, testHelper.primaryDelegateMemberType);
      assert.equal(false, await membersManager.memberIsActive(account, testHelper.primaryDelegateMemberType));
    });

    it("can have different deposits for different types", async () => {
      const brokerNewDepositAmount = 146540;
      const primaryDelegateNewDepositAmount = 113480;

      const oldBrokerDepositAmount = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("Members", testHelper.brokerMemberType, "fixedDepositAmount"));
      const oldPrimaryDelegateDepositAmount = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("Members", testHelper.primaryDelegateMemberType, "fixedDepositAmount"));
      const oneAvtInUSCents = await testHelper.getStorage().getUInt(web3Utils.soliditySha3("OneAVTInUSCents"));

      await updateFixedDepositInStorage(brokerNewDepositAmount, testHelper.brokerMemberType);
      await updateFixedDepositInStorage(primaryDelegateNewDepositAmount, testHelper.primaryDelegateMemberType);

      let brokerDepositAmount = await membersManager.getNewMemberDeposit(testHelper.brokerMemberType);
      let primaryDelegateDepositAmount = await membersManager.getNewMemberDeposit(testHelper.primaryDelegateMemberType);

      assert.equal(testHelper.convertToAVTDecimal(oneAvtInUSCents, brokerNewDepositAmount), brokerDepositAmount.toNumber());
      assert.equal(testHelper.convertToAVTDecimal(oneAvtInUSCents, primaryDelegateNewDepositAmount), primaryDelegateDepositAmount.toNumber());

      await updateFixedDepositInStorage(oldBrokerDepositAmount, testHelper.brokerMemberType);
      await updateFixedDepositInStorage(oldPrimaryDelegateDepositAmount, testHelper.primaryDelegateMemberType);
    });
  });
});
