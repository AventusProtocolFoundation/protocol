const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingHelper = require('../utils/signingHelper');
const proposalsTestHelper = require('./helpers/proposalsTestHelper');

const BN = testHelper.BN;

contract('Governance proposals voting', async () => {
  let proposalsManager;
  let goodGovernanceProposalId;
  const goodVoteOption = 2;
  let accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await proposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('governanceProposalOwner', 'goodVoterAddress', 'badVoterAddress');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  beforeEach(async () => {
    goodGovernanceProposalId =
        await proposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);
  });

  afterEach(async () => {
    await proposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(accounts.governanceProposalOwner,
        goodGovernanceProposalId);
  });

  context('castVote()', async () => {
    const goodCastVoteSecret = testHelper.randomBytes32();

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodGovernanceProposalId, goodCastVoteSecret, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCast');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
    }

    async function castVoteFails(_governanceProposalId, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_governanceProposalId, goodCastVoteSecret,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeToVotingStart(goodGovernanceProposalId);
    });

    context('succeeds with', async () => {
      it('good parameters', async() => {
        await castVoteSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('governanceProposalId', async() => {
          const badGovernanceProposalId = 9999;
          await castVoteFails(badGovernanceProposalId, 'Proposal has the wrong status');
        });
      });
    });

    context('bad state', async () => {
      it('vote has already been cast', async() => {
        await votingTestHelper.castVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
        await castVoteFails(goodGovernanceProposalId, 'Already voted');
      });
    });
  });

  context('revealVote()', async () => {
    let goodRevealVoteSignedMessage;

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
      await votingTestHelper.advanceTimeToRevealingStart(goodGovernanceProposalId);
      goodRevealVoteSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodGovernanceProposalId, goodVoteOption);
    });

    async function revealVoteSucceeds() {
      await proposalsManager.revealVote(goodRevealVoteSignedMessage, goodGovernanceProposalId, goodVoteOption,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteRevealed');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.optId, goodVoteOption);
    }

    async function revealVoteFails(_signedMessage, _proposalId, _optionId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.revealVote(_signedMessage, _proposalId, _optionId,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async() => {
        await revealVoteSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async() => {
        it('revealVoteSignedMessage', async() => {
          const badGovernanceProposalId = 8888;
          const badSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
              badGovernanceProposalId, goodVoteOption);
          await revealVoteFails(badSignedMessage, goodGovernanceProposalId, goodVoteOption, 'Voter must be the sender');
        });

        it('governanceProposalId', async() => {
          const badGovernanceProposalId = 9999;
          await revealVoteFails(goodRevealVoteSignedMessage, badGovernanceProposalId, goodVoteOption,
              'Must be in revealing phase or later');
        });

        it('optionId', async() => {
          const badOptionId = 99;
          await revealVoteFails(goodRevealVoteSignedMessage, goodGovernanceProposalId, badOptionId, 'Invalid option');
        });
      });

      context('bad state', async() => {
        it('vote has already been revealed', async() => {
          await votingTestHelper.revealVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
          await revealVoteFails(goodRevealVoteSignedMessage, goodGovernanceProposalId, goodVoteOption,
              'Stored vote must be the same as the revealed one');
        });
      });
    });
  });

  context('cancelVote()', async () => {
    async function cancelVoteSucceeds() {
      await proposalsManager.cancelVote(goodGovernanceProposalId, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCancelled');
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber(), 'wrong governance proposal Id');
      assert.equal(logArgs.sender, accounts.goodVoterAddress, 'wrong sender');
    }

    async function cancelVoteFails(_governanceProposalId, _voter, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.cancelVote(_governanceProposalId, {from: _voter}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
    });

    context('succeeds with', async () => {
      it('good parameters', async() => {
        await cancelVoteSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('governanceProposalId', async() => {
          const badGovernanceProposalId = 9999;
          await cancelVoteFails(badGovernanceProposalId, accounts.goodVoterAddress,
              'Proposal must be in the voting period or after revealing finished');
        });
      });

      context('bad state', async () => {
        it('without voting first', async() => {
          await cancelVoteFails(goodGovernanceProposalId, accounts.badVoterAddress, 'Sender must have a non revealed vote');
        });

        it('in the revealing period', async() => {
          await votingTestHelper.advanceTimeToRevealingStart(goodGovernanceProposalId);
          await cancelVoteFails(goodGovernanceProposalId, accounts.goodVoterAddress,
              'Proposal must be in the voting period or after revealing finished');
        });

        it('cancelled vote', async() => {
          await proposalsManager.cancelVote(goodGovernanceProposalId, {from: accounts.goodVoterAddress});
          await cancelVoteFails(goodGovernanceProposalId, accounts.goodVoterAddress,
              'Sender must have a non revealed vote');
        });
      });
    });
  });

  context('getGovernanceProposalDeposit()', async () => {
    context('succeeds with', async() => {
      it('good parameters', async() => {
        const expectedDeposit = avtTestHelper.toAttoAVT(new BN(100)); // value from parameter registry;
        const actualDeposit = await proposalsManager.getGovernanceProposalDeposit();
        testHelper.assertBNEquals(actualDeposit, expectedDeposit);
      });
    });
    // Note: there are no bad parameters and no bad state tests
  });
});