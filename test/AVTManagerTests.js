const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

const BN = testHelper.BN;

contract('AVTManager', async () => {
  let avtManager, avt, aventusStorage, accounts;
  const optionId = 1;
  const goodAVTAmount = new BN(1000000);

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);

    aventusStorage = testHelper.getAventusStorage();
    avt = testHelper.getAVTIERC20();
    avtManager = testHelper.getAVTManager();

    accounts = testHelper.getAccounts('goodAVTDepositOwner', 'governanceProposalOwner', 'otherAccount', 'avtHolder1',
        'avtHolder2', 'avtHolder3', 'avtHolder4', 'avtHolder5', 'avtHolder6');
  });

  async function checkBalance(_address, _expectedAmount) {
    const balance = await avtManager.getBalance(_address);
    assert.equal(balance.toNumber(), _expectedAmount);
  }

  context('deposit()', async () => {
    async function depositSucceeds(_account) {
      await avtManager.deposit(goodAVTAmount, {from: _account});
      const logArgs = await testHelper.getLogArgs(avtManager, 'LogAVTDeposited');
      assert.equal(logArgs.sender, _account);
      assert.equal(logArgs.amount.toNumber(), goodAVTAmount);

      await checkBalance(_account, goodAVTAmount);
    }

    async function depositFails(_amount, _avtOwner, _expectedError) {
      return testHelper.expectRevert(() => avtManager.deposit(_amount, {from: _avtOwner}), _expectedError);
    }

    async function depositFailsDueToERC20Error(_amount, _avtOwner) {
      // Revert comes from inside the ERC20 contract - no error checking.
      return depositFails(_amount, _avtOwner, '');
    }

    beforeEach(async () => {
      await avt.approve(aventusStorage.address, goodAVTAmount, {from: accounts.goodAVTDepositOwner});
    });

    context('succeeds', async () => {
      it('for a deposit', async () => {
        await depositSucceeds(accounts.goodAVTDepositOwner);
        await avtTestHelper.withdrawAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('amount (deposit higher than approved)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await depositFailsDueToERC20Error(badAmount, accounts.goodAVTDepositOwner);
        });

        it('amount (zero)', async () => {
          const badAmount = 0;
          await depositFails(badAmount, accounts.goodAVTDepositOwner, 'Added amount must be greater than zero');
        });
      });

      context('bad state', async () => {
        it('sender has not approved the deposit', async () => {
          const badSender = accounts.otherAccount;
          await depositFailsDueToERC20Error(goodAVTAmount, badSender);
        });
      });
    });
  });

  context('withdraw()', async () => {
    beforeEach(async () => {
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
    });

    async function withdrawSucceeds(_account) {
      await avtManager.withdraw(goodAVTAmount, {from: _account});
      const logArgs = await testHelper.getLogArgs(avtManager, 'LogAVTWithdrawn');
      assert.equal(logArgs.sender, _account);
      assert.equal(logArgs.amount.toNumber(), goodAVTAmount);

      await checkBalance(_account, 0);
    }

    async function withdrawFails(_amount, _avtOwner, _expectedError) {
      await testHelper.expectRevert(() => avtManager.withdraw(_amount, {from: _avtOwner}), _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('for a deposit', async () => {
          await withdrawSucceeds(accounts.goodAVTDepositOwner);
        });
      });
    });

    context('fails with bad parameters', async () => {
      it('amount (withdraw more deposit than current balance)', async () => {
        const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
        await withdrawFails(badAmount, accounts.goodAVTDepositOwner, 'Amount taken must be less than current balance');
        await avtTestHelper.withdrawAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      });
    });
  });

  context('transfer()', async () => {
    async function transferSucceeds(_fromAccount) {
      await avtManager.transfer(goodAVTAmount, accounts.otherAccount, {from: _fromAccount});
      await checkBalance(_fromAccount, 0);
      await checkBalance(accounts.otherAccount, goodAVTAmount);
      // There are no logs to check
    }

    async function transferFails(_fromAddress, _amount, _expectedError) {
      // there is no bad _toAddress as anyone can receive AVT
      await testHelper.expectRevert(() => avtManager.transfer(_amount, accounts.otherAccount, {from: _fromAddress}),
          _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
        await transferSucceeds(accounts.goodAVTDepositOwner);
        await avtTestHelper.withdrawAVT(goodAVTAmount, accounts.otherAccount);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('amount (transfer more deposit than current balance)', async () => {
          await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await transferFails(accounts.goodAVTDepositOwner, badAmount, 'Amount taken must be less than current balance');
          await avtTestHelper.withdrawAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
        });

        it('amount (zero)', async () => {
          const badAmount = testHelper.BN_ZERO;
          await transferFails(accounts.goodAVTDepositOwner, badAmount, 'The amount of a transfer must be positive');
        });
      });

      context('bad state', async () => {
        it('transferrer does not have any AVT in their account', async () => {
          const badTransferrer = accounts.otherAccount;
          await transferFails(badTransferrer, goodAVTAmount, 'Amount taken must be less than current balance');
        });
      });
    });
  });

  context('getBalance()', async () => {
    async function getBalanceSucceeds(_avtOwner) {
      return await avtManager.getBalance(_avtOwner);
      // There are no logs to check
    }

    context('succeeds', async () => {
      it('with good parameters', async () => {
        await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
        const balance = await getBalanceSucceeds(accounts.goodAVTDepositOwner);
        assert.equal(balance.toNumber(), goodAVTAmount);
        await avtTestHelper.withdrawAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      });

      context('extra state for coverage', async () => {
        it('account has 0 AVT in it', async () => {
          const balance = await getBalanceSucceeds(accounts.otherAccount);
          assert.equal(balance.toNumber(), 0);
        });
      });
    });
  });

  context('getHistoricBalance()', async () => {

    // creates transaction history for AVT account then checks all its historic balances against the local store it builds
    async function createAndCheckAVTHistory(_numDeposits, _numWithdrawls, _avtHolder) {
      let transactionHistoryStore = {}; // key value store of {transaction timestamp : balance}
      let currentAVTBalance = await avtManager.getBalance(_avtHolder); // fresh accounts should be zero balance anyway
      let currentTime;

      // transfer some AVT into the holder's account and have them approve enough to cover all upcoming deposits
      const fullDeposit = goodAVTAmount * _numDeposits;
      await avt.transfer(_avtHolder, fullDeposit);
      await avt.approve(aventusStorage.address, fullDeposit, {from: _avtHolder});

      // create a transaction history of deposits for the AVT holder...
      for (i = 0; i < _numDeposits; i++) {
        await avtManager.deposit(goodAVTAmount, {from: _avtHolder});
        currentAVTBalance = currentAVTBalance.add(goodAVTAmount);
        currentTime = timeTestHelper.now();
        transactionHistoryStore[currentTime] = currentAVTBalance;
        await timeTestHelper.advanceByNumDays(1);
      }

      // ...and some withdrawls
      for (i = 0; i < _numWithdrawls; i++) {
        await avtManager.withdraw(goodAVTAmount, {from: _avtHolder});
        currentAVTBalance = currentAVTBalance.sub(goodAVTAmount);
        currentTime = timeTestHelper.now();
        transactionHistoryStore[currentTime] = currentAVTBalance;
        await timeTestHelper.advanceByNumDays(1);
      }

      const localStore = Object.entries(transactionHistoryStore);
      // 2D array where each element is kv pair: [0] = transaction timestamp, [1] = AVT balance

      for (offset = -1; offset <= 1; offset++) {
        for (i = 0; i < localStore.length; i++) {
          // use offsets to create target timestamps 1 second before, exactly on, and 1 second after stored value timestamps
          const targetTimestamp = parseInt(localStore[i][0]) + offset;
          const actualBalance = await avtManager.getHistoricBalance(_avtHolder, targetTimestamp);
          let expectedBalance;

          // balance 1 second before should be zero prior to any transactions otherwise the previous stored value
          if (offset < 0) expectedBalance = (i == 0) ? testHelper.BN_ZERO : localStore[i-1][1];
          else expectedBalance = localStore[i][1]; // balance on or 1 second after a transaction should be that stored value
          testHelper.assertBNEquals(actualBalance, expectedBalance);
        };
      }

      // clean up
      await avtTestHelper.withdrawAVT(currentAVTBalance, _avtHolder);
    }

    // use a clean account with no balance history for each test
    it('with no AVT transaction history', async () => {
      const targetTimestamp = timeTestHelper.now();
      const balance = await avtManager.getHistoricBalance(accounts.avtHolder1, targetTimestamp);
      testHelper.assertBNEquals(balance, testHelper.BN_ZERO);
    });

    it('with 1 AVT deposit, 0 AVT withdrawls', async () => {
      await createAndCheckAVTHistory(1, 0, accounts.avtHolder2);
    });

    it('with 1 AVT deposit, 1 AVT withdrawl', async () => {
      await createAndCheckAVTHistory(1, 1, accounts.avtHolder3);
    });

    it('with 2 AVT deposits, 2 AVT withdrawls', async () => {
      await createAndCheckAVTHistory(2, 2, accounts.avtHolder4);
    });

    it('with 5 AVT deposits, 2 AVT withdrawls', async () => {
      await createAndCheckAVTHistory(5, 2, accounts.avtHolder5);
    });

    it('with more than one transaction in the same block timestamp', async () => {
      // transfer and approve all the AVT required for the upcoming deposits
      const fullDeposit = goodAVTAmount * 2;
      await avt.transfer(accounts.avtHolder6, fullDeposit);
      await avt.approve(aventusStorage.address, fullDeposit, {from: accounts.avtHolder6});

      // get balance and time at start of multiple transaction block
      const startBalance = await avtManager.getBalance(accounts.avtHolder6);
      const transactionTime = timeTestHelper.now();

      // do a net deposit of 1 goodAVTAmount
      await avtManager.deposit(goodAVTAmount * 2, {from: accounts.avtHolder6});
      await avtManager.withdraw(goodAVTAmount, {from: accounts.avtHolder6});

      // difference between startBalance and endBalance should reflect targeted net deposits only
      const endBalance = await avtManager.getHistoricBalance(accounts.avtHolder6, transactionTime);
      const expectedEndBalance = startBalance.add(goodAVTAmount);
      testHelper.assertBNEquals(endBalance, expectedEndBalance);

      // clean up
      await avtTestHelper.withdrawAVT(endBalance, accounts.avtHolder6);
    });
  });
});