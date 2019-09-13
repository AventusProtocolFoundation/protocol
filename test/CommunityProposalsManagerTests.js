const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const proposalsTestHelper = require('./helpers/proposalsTestHelper');

contract('Community proposals', async () => {
  let proposalsManager;
  let communityProposalDeposit = testHelper.BN_ZERO;
  let goodCommunityProposalDescription = 'I think we should change something';

  let accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await proposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('communityProposalOwner');
    communityProposalDeposit = await proposalsManager.getCommunityProposalDeposit();
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  async function endCommunityProposalAndWithdrawDeposit(_proposalId) {
    await proposalsTestHelper.advanceTimeEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner,
        _proposalId);
  }

  context('createCommunityProposal()', async () => {

    async function createCommunityProposalSucceeds() {
      await proposalsManager.createCommunityProposal(goodCommunityProposalDescription,
          {from: accounts.communityProposalOwner});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogCommunityProposalCreated');
      assert.equal(logArgs.desc, goodCommunityProposalDescription);
      assert.equal(logArgs.sender, accounts.communityProposalOwner);
      testHelper.assertBNEquals(logArgs.deposit, communityProposalDeposit);
      return logArgs.proposalId;
    }

    async function createCommunityProposalFails(_expectedError) {
      await testHelper.expectRevert(() => proposalsManager.createCommunityProposal(goodCommunityProposalDescription,
          {from: accounts.communityProposalOwner}), _expectedError);
    }

    context('succeeds with', async () => {
      beforeEach(async () => {
        await avtTestHelper.addAVT(communityProposalDeposit, accounts.communityProposalOwner);
      });

      it('good state', async () => {
        const communityProposalId = await createCommunityProposalSucceeds();
        await endCommunityProposalAndWithdrawDeposit(communityProposalId);
      });
    });

    context('fails with', async () => {
      context('bad state', async () => {
        it('not enough deposit', async () => {
          await createCommunityProposalFails('Insufficient balance to cover deposits');
        });
      });
    });
  });

  context('endCommunityProposal()', async () => {
    let goodCommunityProposalId;

    async function endCommunityProposalSucceeds(_communityProposalId) {
      await proposalsManager.endCommunityProposal(_communityProposalId);
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogCommunityProposalEnded');
      assert.equal(logArgs.proposalId.toNumber(), _communityProposalId.toNumber());
      assert.equal(logArgs.votesFor.toNumber(), 0);
      assert.equal(logArgs.votesAgainst.toNumber(), 0);
    }

    async function endCommunityProposalFails(_communityProposalId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.endCommunityProposal(_communityProposalId), _expectedError);
    }

    beforeEach(async () => {
      goodCommunityProposalId = await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);
    });

    context('succeeds with', async () => {
      it('good parameters (in end proposal period)', async() => {
        await votingTestHelper.advanceTimeToEndOfProposal(goodCommunityProposalId);
        await endCommunityProposalSucceeds(goodCommunityProposalId);
        await avtTestHelper.withdrawAVT(communityProposalDeposit, accounts.communityProposalOwner);
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('communityProposalId', async() => {
          const badCommunityProposalId = 9999;
          await endCommunityProposalFails(badCommunityProposalId, 'Proposal is not a community proposal');
          await endCommunityProposalAndWithdrawDeposit(goodCommunityProposalId);
        });
      });

      context('bad state', async () => {
        it('in the lobbying period', async() => {
          await endCommunityProposalFails(goodCommunityProposalId, 'Proposal has the wrong status');
          await endCommunityProposalAndWithdrawDeposit(goodCommunityProposalId);
        });

        it('in the voting period', async() => {
          await votingTestHelper.advanceTimeToVotingStart(goodCommunityProposalId);
          await endCommunityProposalFails(goodCommunityProposalId, 'Proposal has the wrong status');
          await endCommunityProposalAndWithdrawDeposit(goodCommunityProposalId);
        });

        it('has already ended', async() => {
          await endCommunityProposalAndWithdrawDeposit(goodCommunityProposalId);
          await endCommunityProposalFails(goodCommunityProposalId, 'Proposal has the wrong status');
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