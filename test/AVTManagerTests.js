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

    accounts = testHelper.getAccounts('goodAVTDepositOwner', 'goodAVTStakeOwner', 'governanceProposalOwner', 'otherAccount');
    await avt.transfer(accounts.goodAVTStakeOwner, goodAVTAmount);
    await avt.transfer(accounts.otherAccount, goodAVTAmount);
  });

  async function checkBalance(_address, _expectedAmount) {
    const balance = await avtManager.getBalance(_address);
    assert.equal(balance.toNumber(), _expectedAmount);
  }

  async function createProposalVoteAndAdvanceToReveal(_votingAddress) {
    const proposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
    await votingTestHelper.advanceTimeAndCastVote(_votingAddress, proposalId, optionId);
    await votingTestHelper.advanceTimeToRevealingStart(proposalId);
    return proposalId;
  }

  async function endProposalVoteAndWithdrawDeposit(_votingAddress, _proposalId) {
    await governanceProposalsTestHelper.revealVoteEndProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
        _votingAddress, _proposalId, optionId);
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
      await avt.approve(aventusStorage.address, goodAVTAmount, {from: accounts.goodAVTStakeOwner});
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTAccount(accounts.goodAVTDepositOwner);
      await avtTestHelper.clearAVTAccount(accounts.goodAVTStakeOwner);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('for a deposit', async () => {
          await depositSucceeds(accounts.goodAVTDepositOwner);
        });

        it('for a stake', async () => {
          await depositSucceeds(accounts.goodAVTStakeOwner);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('amount (deposit higher than approved)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await depositFailsDueToERC20Error(badAmount, accounts.goodAVTDepositOwner);
        });

        it('amount (stake higher than approved)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await depositFailsDueToERC20Error(badAmount, accounts.goodAVTStakeOwner);
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

        it('deposit into an account that is blocked', async () => {
          const votingAddress = accounts.goodAVTDepositOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await depositFails(goodAVTAmount, votingAddress, 'Cannot deposit until all votes are revealed');
          await endProposalVoteAndWithdrawDeposit(votingAddress, proposalId);
        });
      });
    });
  });

  context('withdraw()', async () => {
    beforeEach(async () => {
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTStakeOwner);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTAccount(accounts.goodAVTDepositOwner);
      await avtTestHelper.clearAVTAccount(accounts.goodAVTStakeOwner);
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

        it('for a stake', async () => {
          await withdrawSucceeds(accounts.goodAVTStakeOwner);
        });
      });

      context('extra state for coverage', async () => {
        it('stake owner having voted on a proposal that is still in voting period', async () => {
          const proposalId =
              await governanceProposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
          await votingTestHelper.advanceTimeAndCastVote(accounts.goodAVTStakeOwner, proposalId, optionId);

          await withdrawSucceeds(accounts.goodAVTStakeOwner);

          await votingTestHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(accounts.goodAVTStakeOwner, proposalId, optionId);
          await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
              proposalId);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('amount (withdraw more deposit than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await withdrawFails(badAmount, accounts.goodAVTDepositOwner, 'Amount taken must be less than current balance');
        });
      });

      context('bad state', async () => {
        it('in revealing period of proposal with unrevealed vote', async () => {
          const votingAddress = accounts.goodAVTStakeOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await withdrawFails(goodAVTAmount, votingAddress, 'Cannot withdraw until all votes are revealed');
          await endProposalVoteAndWithdrawDeposit(votingAddress, proposalId);
        });
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

    beforeEach(async () => {
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTStakeOwner);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTAccount(accounts.goodAVTDepositOwner);
      await avtTestHelper.clearAVTAccount(accounts.goodAVTStakeOwner);
      await avtTestHelper.clearAVTAccount(accounts.otherAccount);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('deposit transfer', async () => {
          await transferSucceeds(accounts.goodAVTDepositOwner);
        });

        it('stake transfer', async () => {
          await transferSucceeds(accounts.goodAVTStakeOwner);
        });
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('amount (transfer more deposit than current balance)', async () => {
          const badAmount = goodAVTAmount.add(testHelper.BN_ONE);
          await transferFails(accounts.goodAVTDepositOwner, badAmount,
              'Amount taken must be less than current balance');
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

        it('transfer from an account that is blocked', async () => {
          const votingAddress = accounts.goodAVTStakeOwner;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await transferFails(votingAddress, goodAVTAmount, 'Cannot transfer until all votes are revealed');
          await endProposalVoteAndWithdrawDeposit(votingAddress, proposalId);
        });

        it('transfer to an account that is blocked', async () => {
          const votingAddress = accounts.otherAccount;
          const proposalId = await createProposalVoteAndAdvanceToReveal(votingAddress);
          await transferFails(accounts.goodAVTDepositOwner, goodAVTAmount,
              'Cannot recieve transfers until all votes are revealed');
          await endProposalVoteAndWithdrawDeposit(votingAddress, proposalId);
        });
      });
    });
  });

  context('getBalance()', async () => {
    async function getBalanceSucceeds(_avtOwner) {
      return await avtManager.getBalance(_avtOwner);
      // There are no logs to check
    }

    async function getBalanceFails(_avtOwner, _expectedError) {
      await testHelper.expectRevert(() => avtManager.getBalance(_avtOwner), _expectedError);
    }

    beforeEach(async () => {
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTDepositOwner);
      await avtTestHelper.addAVT(goodAVTAmount, accounts.goodAVTStakeOwner);
    });

    afterEach(async () => {
      await avtTestHelper.clearAVTAccount(accounts.goodAVTDepositOwner);
      await avtTestHelper.clearAVTAccount(accounts.goodAVTStakeOwner);
    });

    context('succeeds with', async () => {
      context('good parameters', async () => {
        it('for a deposit', async () => {
          const balance = await getBalanceSucceeds(accounts.goodAVTDepositOwner);
          assert.equal(balance.toNumber(), goodAVTAmount);
        });

        it('for a stake', async () => {
          const balance = await getBalanceSucceeds(accounts.goodAVTStakeOwner);
          assert.equal(balance.toNumber(), goodAVTAmount);
        });
      });

      context('extra state for coverage', async () => {
        it('account has got AVT in it', async () => {
          const balance = await getBalanceSucceeds(accounts.otherAccount);
          assert.equal(balance.toNumber(), 0);
        });
      });
    });
  });
});