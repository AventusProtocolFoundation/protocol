const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');

contract('Governance proposals', async () => {
  let proposalsManager;
  let governanceProposalDeposit = testHelper.BN_ZERO;
  let goodGovernanceProposalDescription = 'I think we should change something';

  let accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('governanceProposalOwner');
    governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function endGovernanceProposalAndWithdrawDeposit(_proposalId) {
    await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
        _proposalId);
  }

  context('createGovernanceProposal()', async () => {

    async function createGovernanceProposalSucceeds() {
      await proposalsManager.createGovernanceProposal(goodGovernanceProposalDescription,
          {from: accounts.governanceProposalOwner});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalCreated');
      assert.equal(logArgs.desc, goodGovernanceProposalDescription);
      assert.equal(logArgs.sender, accounts.governanceProposalOwner);
      testHelper.assertBNEquals(logArgs.deposit, governanceProposalDeposit);
      return logArgs.proposalId;
    }

    async function createGovernanceProposalFails(_expectedError) {
      await testHelper.expectRevert(() => proposalsManager.createGovernanceProposal(goodGovernanceProposalDescription,
          {from: accounts.governanceProposalOwner}), _expectedError);
    }

    context('succeeds with', async () => {
      beforeEach(async () => {
        await avtTestHelper.addAVT(governanceProposalDeposit, accounts.governanceProposalOwner);
      });

      it('good state', async () => {
        const governanceProposalId = await createGovernanceProposalSucceeds();
        await endGovernanceProposalAndWithdrawDeposit(governanceProposalId);
      });
    });

    context('fails with', async () => {
      context('bad state', async () => {
        it('not enough deposit', async () => {
          await createGovernanceProposalFails('Insufficient balance to cover deposits');
        });
      });
    });
  });

  context('endGovernanceProposal()', async () => {
    let goodGovernanceProposalId;

    async function endGovernanceProposalSucceeds(_governanceProposalId) {
      await proposalsManager.endGovernanceProposal(_governanceProposalId);
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalEnded');
      assert.equal(logArgs.proposalId.toNumber(), _governanceProposalId.toNumber());
      assert.equal(logArgs.votesFor.toNumber(), 0);
      assert.equal(logArgs.votesAgainst.toNumber(), 0);
    }

    async function endGovernanceProposalFails(_governanceProposalId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(_governanceProposalId), _expectedError);
    }

    beforeEach(async () => {
      goodGovernanceProposalId =
          await governanceProposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
    });

    context('succeeds with', async () => {
      it('good parameters (in end proposal period)', async() => {
        await votingTestHelper.advanceTimeToEndOfProposal(goodGovernanceProposalId);
        await endGovernanceProposalSucceeds(goodGovernanceProposalId);
        await avtTestHelper.withdrawAVT(governanceProposalDeposit, accounts.governanceProposalOwner);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('governanceProposalId', async() => {
          const badGovernanceProposalId = 9999;
          await endGovernanceProposalFails(badGovernanceProposalId, 'Proposal is not a governance proposal');
          await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
        });
      });

      context('bad state', async () => {
        it('in the lobbying period', async() => {
          await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
          await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
        });

        it('in the voting period', async() => {
          await votingTestHelper.advanceTimeToVotingStart(goodGovernanceProposalId);
          await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
          await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
        });

        it('has already ended', async() => {
          await endGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
          await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
        });
      });
    });
  });

  context('getAventusTime()', async () => {
    // There are no bad parameter and bad state tests for this.
    it('succeeds', async () => {
      const aventusTime = await proposalsManager.getAventusTime();
      assert.equal(aventusTime.toNumber(), timeTestHelper.now().toNumber());
    });
  });
});