const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');

const BN = testHelper.BN;

contract('AVTManager', async () => {
  let avtManager, avt, aventusStorage, accounts;

  const optionId = 1;

  const goodAVTAmount = new BN(1000000);
  const goodDepositFund = 'deposit';
  const goodStakeFund = 'stake';

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    aventusStorage = testHelper.getAventusStorage();
    avt = testHelper.getAVTIERC20();
    avtManager = testHelper.getAVTManager();

    accounts = testHelper.getAccounts('goodAVTOwner', 'otherAccount');
    await avt.transfer(accounts.otherAccount, goodAVTAmount);
  });

  async function checkBalance(_address, _fund, _expectedAmount) {
    const balance = await avtManager.getBalance(_fund, _address);
    assert.equal(balance.toNumber(), _expectedAmount);
  }

  async function createProposalVoteAndAdvanceToReveal(_votingAddress) {
    const proposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
    await votingTestHelper.advanceTimeAndCastVote(_votingAddress, proposalId, optionId);
    await votingTestHelper.advanceTimeToRevealingStart(proposalId);
    return proposalId;
  }

  context('deposit()', async () => {
    async function depositSucceeds(_fund) {
      await avtManager.deposit(_fund, goodAVTAmount, {from: accounts.goodAVTOwner});
      const logArgs = await testHelper.getLogArgs(avtManager, 'LogAVTDeposited');
      assert.equal(logArgs.sender, accounts.goodAVTOwner);
      assert.equal(logArgs.fund, _fund);
      assert.equal(logArgs.amount.toNumber(), goodAVTAmount);

      await checkBalance(accounts.goodAVTOwner, _fund, goodAVTAmount);
    }

    async function depositFails(_fund, _amount, _avtOwner, _expectedError) {
      return testHelper.expectRevert(() => avtManager.deposit(_fund, _amount, {from: _avtOwner}), _expectedError);
    }

    async function depositFailsDueToERC20Error(_fund, _amount, _avtOwner) {
      // Revert comes from inside the ERC20 contract - no error checking.
      return depositFails(_fund, _amount, _avtOwner, '');
    }

    beforeEach(async () => {
      await avt.approve(aventusStorage.address, goodAVTAmount, {from: accounts.goodAVTOwner});
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodStakeFund);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('deposit fund', async () => {
          await depositSucceeds(goodDepositFund);
        });

        it('stake fund', async () => {
          await depositSucceeds(goodStakeFund);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('fund', async () => {
          const badFund = 'badFund';
          await depositFails(badFund, goodAVTAmount, accounts.goodAVTOwner,
              'Deposit must be called for stake or deposit fund only');
        });

        it('amount (deposit higher than approved)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await depositFailsDueToERC20Error(goodDepositFund, badAmount, accounts.goodAVTOwner);
        });

        it('amount (stake higher than approved)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await depositFailsDueToERC20Error(goodStakeFund, badAmount, accounts.goodAVTOwner);
        });

        it('amount (zero)', async () => {
          const badAmount = 0;
          await depositFails(goodDepositFund, badAmount, accounts.goodAVTOwner, 'Added amount must be greater than zero');
        });
      });

      context('bad state', async () => {
        it('sender has not approved the deposit in their deposit fund', async () => {
          const badSender = accounts.otherAccount;
          await depositFailsDueToERC20Error(goodDepositFund, goodAVTAmount, badSender);
        });

        it('sender has not approved the deposit in their stake fund', async () => {
          const badSender = accounts.otherAccount;
          await depositFailsDueToERC20Error(goodStakeFund, goodAVTAmount, badSender);
        });

        it('deposit into an account with a blocked stake', async () => {
          const votingAddress = accounts.goodAVTOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await depositFails(goodStakeFund, goodAVTAmount, votingAddress, 'It is not possible to deposit into a blocked stake');
          await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(votingAddress, proposalId, optionId);
        });
      });
    });
  });

  context('withdraw()', async () => {
    beforeEach(async () => {
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodStakeFund);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodStakeFund);
    });

    async function withdrawSucceeds(_fund) {
      await avtManager.withdraw(_fund, goodAVTAmount, {from: accounts.goodAVTOwner});
      const logArgs = await testHelper.getLogArgs(avtManager, 'LogAVTWithdrawn');
      assert.equal(logArgs.sender, accounts.goodAVTOwner);
      assert.equal(logArgs.fund, _fund);
      assert.equal(logArgs.amount.toNumber(), goodAVTAmount);

      await checkBalance(accounts.goodAVTOwner, _fund, 0);
    }

    async function withdrawFails(_fund, _amount, _avtOwner, _expectedError) {
      await testHelper.expectRevert(() => avtManager.withdraw(_fund, _amount, {from: _avtOwner}), _expectedError);
    }

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('deposit fund', async () => {
          await withdrawSucceeds(goodDepositFund);
        });

        it('stake fund', async () => {
          await withdrawSucceeds(goodStakeFund);
        });
      });

      context('extra state for coverage', async () => {
        it('stake fund having voted on a proposal that is still in voting period', async () => {
          const proposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
          await votingTestHelper.advanceTimeAndCastVote(accounts.goodAVTOwner, proposalId, optionId);

          await withdrawSucceeds(goodStakeFund);

          await votingTestHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(accounts.goodAVTOwner, proposalId, optionId);
          await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(proposalId);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('fund', async () => {
          const badFund = 'badFund';
          await withdrawFails(badFund, goodAVTAmount, accounts.goodAVTOwner,
              'Withdraw must be called for stake or deposit fund only');
        });

        it('amount (withdraw more deposit than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await withdrawFails(goodDepositFund, badAmount, accounts.goodAVTOwner,
              'Withdrawn amount must not exceed the deposit');
        });

        it('amount (withdraw more stake than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await withdrawFails(goodStakeFund, badAmount, accounts.goodAVTOwner,
              'Amount taken must be less than current deposit');
        });
      });

      context('bad state', async () => {
        it('in revealing period of proposal with unrevealed vote', async () => {
          const votingAddress = accounts.goodAVTOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await withdrawFails(goodStakeFund, goodAVTAmount, votingAddress, 'A blocked stake cannot be withdrawn');
          await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(votingAddress, proposalId, optionId);
        });
      });
    });
  });

  context('transfer()', async () => {
    async function transferSucceeds(_fromFund, _toFund) {
      await avtManager.transfer(_fromFund, goodAVTAmount, accounts.otherAccount, _toFund, {from: accounts.goodAVTOwner});
      await checkBalance(accounts.goodAVTOwner, _fromFund, 0);
      await checkBalance(accounts.otherAccount, _toFund, goodAVTAmount);
      // There are no logs to check
    }

    async function transferFails(_fromAddress, _fromFund, _amount, _toFund, _expectedError) {
      // there is no bad _toAddress as anyone can receive AVT
      await testHelper.expectRevert(() => avtManager.transfer(_fromFund, _amount, accounts.otherAccount, _toFund,
          {from: _fromAddress}), _expectedError);
    }

    beforeEach(async () => {
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodStakeFund);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodStakeFund);
      await avtTestHelper.clearAVTFund(accounts.otherAccount, goodDepositFund);
      await avtTestHelper.clearAVTFund(accounts.otherAccount, goodStakeFund);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('deposit -> deposit transfer', async () => {
          await transferSucceeds(goodDepositFund, goodDepositFund);
        });

        it('stake -> stake transfer', async () => {
          await transferSucceeds(goodStakeFund, goodStakeFund);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('from deposit fund', async () => {
          const badFromFund = 'badFromFund';
          await transferFails(accounts.goodAVTOwner, badFromFund, goodAVTAmount, goodDepositFund,
              'Transfer must be from stake or deposit fund only');
        });

        it('to deposit fund', async () => {
          const badToFund = 'badToFund';
          await transferFails(accounts.goodAVTOwner, goodDepositFund, goodAVTAmount, badToFund,
              'Transfer must be to stake or deposit fund only');
        });

        it('from stake fund', async () => {
          const badFromFund = 'badFromFund';
          await transferFails(accounts.goodAVTOwner, badFromFund, goodAVTAmount, goodStakeFund,
              'Transfer must be from stake or deposit fund only');
        });

        it('to stake fund', async () => {
          const badToFund = 'badToFund';
          await transferFails(accounts.goodAVTOwner, goodStakeFund, goodAVTAmount, badToFund,
              'Transfer must be to stake or deposit fund only');
        });

        it('amount (transfer more deposit than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await transferFails(accounts.goodAVTOwner, goodDepositFund, badAmount, goodDepositFund,
              'Withdrawn amount must not exceed the deposit');
        });

        it('amount (transfer more stake than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await transferFails(accounts.goodAVTOwner, goodStakeFund, badAmount, goodStakeFund,
              'Amount taken must be less than current deposit');
        });

        it('amount (zero)', async () => {
          const badAmount = testHelper.BN_ZERO;
          await transferFails(accounts.goodAVTOwner, goodDepositFund, badAmount, goodDepositFund,
              'The amount of a transfer must be positive');
        });
      });

      context('bad state', async () => {
        it('transferrer does not have any AVT in their deposit fund', async () => {
          const badTransferrer = accounts.otherAccount;
          await transferFails(badTransferrer, goodDepositFund, goodAVTAmount, goodDepositFund,
              'Withdrawn amount must not exceed the deposit');
        });

        it('transferrer does not have any AVT in their stake fund', async () => {
          const badTransferrer = accounts.otherAccount;
          await transferFails(badTransferrer, goodStakeFund, goodAVTAmount, goodStakeFund,
              'Amount taken must be less than current deposit');
        });

        it('transfer from an account with a blocked stake', async () => {
          const votingAddress = accounts.goodAVTOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await transferFails(votingAddress, goodStakeFund, goodAVTAmount, goodStakeFund,
              'A blocked stake cannot be transferred');
          await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(votingAddress, proposalId, optionId);
        });

        it('transfer to an account with a blocked stake', async () => {
          const votingAddress = accounts.otherAccount;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await transferFails(accounts.goodAVTOwner, goodStakeFund, goodAVTAmount, goodStakeFund,
              'A blocked stake cannot receive transfers');
          await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(votingAddress, proposalId, optionId);
        });
      });
    });
  });

  context('getBalance()', async () => {
    async function getBalanceSucceeds(_avtOwner, _fund) {
      return await avtManager.getBalance(_fund, _avtOwner);
      // There are no logs to check
    }

    async function getBalanceFails(_avtOwner, _fund, _expectedError) {
      await testHelper.expectRevert(() => avtManager.getBalance(_fund, _avtOwner), _expectedError);
    }

    beforeEach(async () => {
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.addAVTToFund(goodAVTAmount, accounts.goodAVTOwner, goodStakeFund);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodDepositFund);
      await avtTestHelper.clearAVTFund(accounts.goodAVTOwner, goodStakeFund);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('deposit fund', async () => {
          const balance = await getBalanceSucceeds(accounts.goodAVTOwner, goodDepositFund);
          assert.equal(balance.toNumber(), goodAVTAmount);
        });

        it('stake fund', async () => {
          const balance = await getBalanceSucceeds(accounts.goodAVTOwner, goodStakeFund);
          assert.equal(balance.toNumber(), goodAVTAmount);
        });
      });

      context('extra state for coverage', async () => {
        it('account has got AVT in deposit fund', async () => {
          const balance = await getBalanceSucceeds(accounts.otherAccount, goodDepositFund);
          assert.equal(balance.toNumber(), 0);
        });

        it('account has got AVT in stake fund', async () => {
          const balance = await getBalanceSucceeds(accounts.otherAccount, goodStakeFund);
          assert.equal(balance.toNumber(), 0);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('fund', async () => {
          const badFund = 'badFund';
          await getBalanceFails(accounts.goodAVTOwner, badFund, 'Can only get balance of stake or deposit fund');
        });
      });
    });
  });
});