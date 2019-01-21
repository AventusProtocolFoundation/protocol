const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const challengesTestHelper = require('./helpers/challengesTestHelper');

const BN = testHelper.BN;

contract('MembersManager', async () => {
  let membersManager, accounts, goodMember;

  const goodEvidenceURL = testHelper.validEvidenceURL;
  const goodMemberDescription = 'Some member to be registered';
  const goodMemberType = membersTestHelper.memberTypes.validator;
  const badMemberType = membersTestHelper.memberTypes.bad;
  const badMemberAddress = testHelper.zeroAddress;
  const memberDepositInAVTDecimals = avtTestHelper.toNat(new BN(5000));


  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await challengesTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    membersManager = testHelper.getMembersManager();
    accounts = testHelper.getAccounts('member', 'challenger', 'otherMember');
    goodMember = accounts.member;
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  async function makeDepositForNewMember(_account) {
    let deposit = memberDepositInAVTDecimals;
    await avtTestHelper.addAVTToFund(deposit, _account, 'deposit');
    return deposit;
  }

  async function withdrawDepositForNewMember(_account) {
    let deposit = memberDepositInAVTDecimals;
    await avtTestHelper.withdrawAVTFromFund(deposit, _account, 'deposit');
  }

  context('registerMember()', async () => {
    let goodMemberDeposit;

    async function registerMemberSucceeds(_expectedDeposit) {
      await membersManager.registerMember(accounts.member, goodMemberType, goodEvidenceURL, goodMemberDescription);

      const logArgs = await testHelper.getLogArgs(membersManager, 'LogMemberRegistered');
      assert.equal(logArgs.memberAddress, accounts.member);
      assert.equal(logArgs.memberType, goodMemberType);
      assert.equal(logArgs.evidenceUrl, goodEvidenceURL);
      assert.equal(logArgs.desc, goodMemberDescription);
      testHelper.assertBNEquals(logArgs.deposit, _expectedDeposit);
    }

    async function registerMemberFails(_memberAddress, _memberType, _evidenceURL, _description, _expectedError) {
      await testHelper.expectRevert(() => membersManager.registerMember(_memberAddress, _memberType, _evidenceURL,
          _description), _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        goodMemberDeposit = await makeDepositForNewMember(goodMember);
        await registerMemberSucceeds(goodMemberDeposit);
        await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        beforeEach(async () => {
          goodMemberDeposit = await makeDepositForNewMember(goodMember);
        });

        afterEach(async () => {
          await avtTestHelper.withdrawAVTFromFund(goodMemberDeposit, goodMember, 'deposit');
        });

        it('memberType', async () => {
          await registerMemberFails(goodMember, badMemberType, goodEvidenceURL, goodMemberDescription,
              'Member type is not valid');
        });

        it('evidenceURL', async () => {
          await registerMemberFails(goodMember, goodMemberType, '', goodMemberDescription,
              'Member requires a non-empty evidence URL');
        });

        it('desc', async () => {
          await registerMemberFails(goodMember, goodMemberType, goodEvidenceURL, '', 'Member requires a non-empty description');
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
          let badDeposit = memberDepositInAVTDecimals.div(new BN(2));
          await avtTestHelper.addAVTToFund(badDeposit, goodMember, 'deposit');
          await registerMemberFails(goodMember, goodMemberType, goodEvidenceURL, goodMemberDescription, 'Insufficient deposits');
          await avtTestHelper.withdrawAVTFromFund(badDeposit, goodMember, 'deposit');
        });
      });
    });
  });

  context('deregisterMember()', async () => {
    async function deregisterMemberSucceeds() {
      await membersManager.deregisterMember(goodMember, goodMemberType);

      const logArgs = await testHelper.getLogArgs(membersManager, 'LogMemberDeregistered');
      assert.equal(logArgs.memberAddress, goodMember);
      assert.equal(logArgs.memberType, goodMemberType);
    }

    async function deregisterMemberFails(_memberAddress, _memberType, _expectedError) {
      await testHelper.expectRevert(() => membersManager.deregisterMember(_memberAddress, _memberType), _expectedError);
    }

    beforeEach(async () => {
      await membersTestHelper.depositAndRegisterMember(goodMember, goodMemberType);
    });

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await deregisterMemberSucceeds();
        await withdrawDepositForNewMember(goodMember, goodMemberType);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        afterEach(async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
        });

        it('memberAddress', async () => {
          await deregisterMemberFails(badMemberAddress, goodMemberType, 'Member is not registered');
        });

        it('memberType', async () => {
          await deregisterMemberFails(goodMember, badMemberType, 'Member is not registered');
        });
      });

      context('bad state', async () => {
        it('member has already been deregistered', async () => {
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
          await deregisterMemberFails(goodMember, goodMemberType, 'Member is not registered');
        });

        it('member has interacted and tries to deregister before the end of the cooling off period', async () => {
          const merkleRootsManager = testHelper.getMerkleRootsManager();
          const merkleRootHash = testHelper.randomBytes32();
          await merkleRootsManager.registerMerkleRoot(merkleRootHash, {from: goodMember});
          await deregisterMemberFails(goodMember, goodMemberType, 'Member is still in cooling off period');

          // Tear down
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(goodMember, goodMemberType);
        });
      });
    });
  });

  context('getNewMemberDeposit()', async () => {
    async function getNewMemberDepositSucceeds(_expectedDeposit) {
      const newMemberDeposit = await membersManager.getNewMemberDeposit(goodMemberType);
      testHelper.assertBNEquals(newMemberDeposit, _expectedDeposit);
    }

    async function getNewMemberDepositFails(_type, _expectedError) {
      await testHelper.expectRevert(() => membersManager.getNewMemberDeposit(_type), _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await getNewMemberDepositSucceeds(memberDepositInAVTDecimals);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('memberType', async () => {
          await getNewMemberDepositFails(badMemberType, 'Member type is not valid');
        });
      });
      // There is not a bad state test for this method. The function to be tested only reads values from the ParameterRegistry.
    });
  });

  context('getExistingMemberDeposit()', async () => {
    async function getExistingMemberDepositSucceeds(_expectedDeposit) {
      const existingMemberDeposit = await membersManager.getExistingMemberDeposit(goodMember, goodMemberType);
      testHelper.assertBNEquals(existingMemberDeposit, _expectedDeposit);
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

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await getExistingMemberDepositSucceeds(memberDepositInAVTDecimals);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('memberType', async () => {
          await getExistingMemberDepositFails(goodMember, badMemberType, 'Member is not registered');
        });
      });

      context('bad state', async () => {
        it('member is not registered', async () => {
          await getExistingMemberDepositFails(accounts.otherMember, goodMemberType, 'Member is not registered');
        });
      });
    });
  });
});