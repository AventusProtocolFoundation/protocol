const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const challengesTestHelper = require('./helpers/challengesTestHelper');

contract('MembersManager', async () => {
  let membersManager;

  const accounts = testHelper.getAccounts('member', 'challenger', 'otherMember');
  const goodEvidenceURL = testHelper.validEvidenceURL;
  const goodMemberDescription = 'Some member to be registered';
  const goodMemberType = membersTestHelper.memberTypes.primary;
  const badMemberType = membersTestHelper.memberTypes.bad;
  const badMemberAddress = 0;
  const primaryDepositInUSCents = new web3.BigNumber(100000);
  const primaryDepositInAVTDecimals = avtTestHelper.getAVTFromUSCents(primaryDepositInUSCents);


  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await challengesTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    membersManager = testHelper.getMembersManager();
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  async function makeDepositForNewPrimary(_account) {
    let deposit = primaryDepositInAVTDecimals;
    await avtTestHelper.addAVTToFund(deposit, _account, 'deposit');
    return deposit;
  }

  async function withdrawDepositForNewPrimary(_account) {
    let deposit = primaryDepositInAVTDecimals;
    await avtTestHelper.withdrawAVTFromFund(deposit, _account, 'deposit');
  }

  context('registerMember()', async () => {
    const goodMember = accounts.member;

    async function registerMemberSucceeds(_expectedDeposit) {
      await membersManager.registerMember(accounts.member, goodMemberType, goodEvidenceURL, goodMemberDescription);

      const logArgs = await testHelper.getLogArgs(membersManager.LogMemberRegistered);
      assert.equal(logArgs.memberAddress, accounts.member);
      assert.equal(logArgs.memberType, goodMemberType);
      assert.equal(logArgs.evidenceUrl, goodEvidenceURL);
      assert.equal(logArgs.desc, goodMemberDescription);
      assert.equal(logArgs.deposit.toNumber(), _expectedDeposit);
    }

    async function registerMemberFails(_memberAddress, _memberType, _evidenceURL, _description, _expectedError) {
      await testHelper.expectRevert(() => membersManager.registerMember(_memberAddress, _memberType, _evidenceURL,
          _description), _expectedError);
    }

    context('good state', async () => {
      let goodMemberDeposit;

      beforeEach(async () => {
        goodMemberDeposit = await makeDepositForNewPrimary(goodMember);
      });

      it('all good', async () => {
        await registerMemberSucceeds(goodMemberDeposit);
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
      });

      context('bad parameters', async () => {
        afterEach(async () => {
          await avtTestHelper.withdrawAVTFromFund(goodMemberDeposit, goodMember, 'deposit');
        });

        it('member type is invalid', async () => {
          await registerMemberFails(goodMember, badMemberType, goodEvidenceURL, goodMemberDescription,
              'Member type is not valid');
        });

        it('evidence URL is invalid', async () => {
          await registerMemberFails(goodMember, goodMemberType, '', goodMemberDescription,
              'Member requires a non-empty evidence URL');
        });

        it('description is invalid', async () => {
          await registerMemberFails(goodMember, goodMemberType, goodEvidenceURL, '', 'Member requires a non-empty description');
        });
      });
    });

    context('bad state', async () => {
      it('member has already been registered', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodMemberType);
        await registerMemberFails(goodMember, goodMemberType, goodEvidenceURL, goodMemberDescription,
            'Member must not be registered');
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
      });

      it('insufficient deposit', async () => {
        let badDeposit = primaryDepositInAVTDecimals / 2;
        await avtTestHelper.addAVTToFund(badDeposit, goodMember, 'deposit');
        await registerMemberFails(goodMember, goodMemberType, goodEvidenceURL, goodMemberDescription, 'Insufficient deposits');
        await avtTestHelper.withdrawAVTFromFund(badDeposit, goodMember, 'deposit');
      });
    });
  });

  context('deregisterMember()', async () => {
    const goodMember = accounts.member;

    async function deregisterMemberSucceeds() {
      await membersManager.deregisterMember(goodMember, goodMemberType);

      const logArgs = await testHelper.getLogArgs(membersManager.LogMemberDeregistered);
      assert.equal(logArgs.memberAddress, goodMember);
      assert.equal(logArgs.memberType, goodMemberType);
    }

    async function deregisterMemberFails(_memberAddress, _memberType, _expectedError) {
      await testHelper.expectRevert(() => membersManager.deregisterMember(_memberAddress, _memberType), _expectedError);
    }

    context('good state: goodMember is registered', async () => {
      beforeEach(async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodMemberType);
      });

      it('all good', async () => {
        await deregisterMemberSucceeds();
        await withdrawDepositForNewPrimary(goodMember, goodMemberType);
      });

      context('bad parameters', async () => {
        afterEach(async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
        });

        it('invalid member address', async () => {
          await deregisterMemberFails(badMemberAddress, goodMemberType, 'Member is not registered');
        });

        it('bad member type', async () => {
          await deregisterMemberFails(goodMember, badMemberType, 'Member type is not valid');
        });
      });
    });

    context('bad state', async () => {
      it('member has already been deregistered', async () => {
        await membersTestHelper.depositAndRegisterMember(goodMember, goodMemberType);
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
        await deregisterMemberFails(goodMember, goodMemberType, 'Member is not registered');
      });
    });
  });

  context('getNewMemberDeposit', async () => {
    async function getNewMemberDepositSucceeds(_expectedDeposit) {
      const newMemberDeposit = await membersManager.getNewMemberDeposit(goodMemberType);
      assert.equal(newMemberDeposit.toNumber(), _expectedDeposit);
    }

    async function getNewMemberDepositFails(_type, _expectedError) {
      await testHelper.expectRevert(() => membersManager.getNewMemberDeposit(_type), _expectedError);
    }

    it('good parameters', async () => {
      await getNewMemberDepositSucceeds(primaryDepositInAVTDecimals);
    });

    it('bad parameters', async () => {
      await getNewMemberDepositFails(badMemberType, 'Member type is not valid');
    });
    // There is not a bad state test for this method. The function to be tested only reads values from the ParameterRegistry.
  });

  context('getExistingMemberDeposit', async () => {
    const goodMember = accounts.member;
    async function getExistingMemberDepositSucceeds(_expectedDeposit) {
      const existingMemberDeposit = await membersManager.getExistingMemberDeposit(goodMember, goodMemberType);
      assert.equal(existingMemberDeposit.toNumber(), _expectedDeposit);
    }

    async function getExistingMemberDepositFails(_memberAddress, _memberType, _expectedError) {
      await testHelper.expectRevert(() => membersManager.getExistingMemberDeposit(_memberAddress, _memberType), _expectedError);
    }

    before(async () => {
      await membersTestHelper.depositAndRegisterMember(goodMember, goodMemberType);
    });

    after(async () => {
      await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
    });

    it('good parameters', async () => {
      await getExistingMemberDepositSucceeds(primaryDepositInAVTDecimals);
    });

    it('bad type', async () => {
      await getExistingMemberDepositFails(goodMember, badMemberType, 'Member type is not valid');
    });

    it('bad state - member is not registered', async () => {
      await getExistingMemberDepositFails(accounts.otherMember, goodMemberType, 'Member is not registered');
    });
  });
});
