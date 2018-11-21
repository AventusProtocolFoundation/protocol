const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');

contract('Governance proposals', async () => {
  let proposalsManager;
  let governanceProposalDeposit = new web3.BigNumber(0);
  let goodGovernanceProposalDescription = 'I think we should change something';

  const accounts = testHelper.getAccounts('governanceProposalOwner');

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    proposalsManager = testHelper.getProposalsManager();

    governanceProposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts, false);
  });

  context('createGovernanceProposal()', async () => {

    async function createGovernanceProposalSucceeds() {
      await proposalsManager.createGovernanceProposal(goodGovernanceProposalDescription,
          {from: accounts.governanceProposalOwner});
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogGovernanceProposalCreated);
      assert.equal(logArgs.desc, goodGovernanceProposalDescription);
      assert.equal(logArgs.sender, accounts.governanceProposalOwner);
      assert.equal(logArgs.deposit.toNumber(), governanceProposalDeposit.toNumber());
      return logArgs.proposalId;
    }

    async function createGovernanceProposalFails(_expectedError) {
      await testHelper.expectRevert(() => proposalsManager.createGovernanceProposal(goodGovernanceProposalDescription,
          {from: accounts.governanceProposalOwner}), _expectedError);
    }

    context('good state', async () => {
      beforeEach(async () => {
        await avtTestHelper.addAVTToFund(governanceProposalDeposit, accounts.governanceProposalOwner, 'deposit');
      });

      it('all good', async () => {
        const governanceProposalId = await createGovernanceProposalSucceeds();
        await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(governanceProposalId);
      });
    });

    it('bad state: not enough deposit', async () => {
      await createGovernanceProposalFails('Insufficient deposits');
    });
  });

  context('endGovernanceProposal()', async () => {
    let goodGovernanceProposalId;

    async function endGovernanceProposalSucceeds(_governanceProposalId) {
      await proposalsManager.endGovernanceProposal(_governanceProposalId);
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogGovernanceProposalEnded);
      assert.equal(logArgs.proposalId.toNumber(), _governanceProposalId.toNumber());
      assert.equal(logArgs.votesFor.toNumber(), 0);
      assert.equal(logArgs.votesAgainst.toNumber(), 0);
    }

    async function endGovernanceProposalFails(_governanceProposalId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(_governanceProposalId), _expectedError);
    }

    beforeEach(async () => {
      goodGovernanceProposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
    });

    it('succeeds if proposal is after the revealing end period and has not ended', async() => {
      await votingTestHelper.advanceTimeToEndOfProposal(goodGovernanceProposalId);
      await endGovernanceProposalSucceeds(goodGovernanceProposalId);
      await avtTestHelper.withdrawAVTFromFund(governanceProposalDeposit, accounts.governanceProposalOwner, 'deposit');
    });

    it('fails if proposal id does not exist', async() => {
      const badGovernanceProposalId = 9999;
      await endGovernanceProposalFails(badGovernanceProposalId, 'Proposal is not a governance proposal');
      await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
    });

    context('fails if state is', async () => {
      it('in the lobbying period', async() => {
        await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
        await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
      });

      it('in the voting period', async() => {
        await votingTestHelper.advanceTimeToVotingStart(goodGovernanceProposalId);
        await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
        await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
      });

      it('ended', async() => {
        await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
        await endGovernanceProposalFails(goodGovernanceProposalId, 'Proposal has the wrong status');
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