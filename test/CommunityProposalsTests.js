const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingHelper = require('../utils/signingHelper');
const proposalsTestHelper = require('./helpers/proposalsTestHelper');

const BN = testHelper.BN;

contract('Community proposals voting', async () => {
  let proposalsManager;
  let goodCommunityProposalId;
  const goodVoteOption = 2;
  let accounts;

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await proposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
    accounts = testHelper.getAccounts('communityProposalOwner', 'goodVoterAddress', 'badVoterAddress');
  });

  after(async () => {
    await avtTestHelper.checkBalancesAreZero(accounts);
  });

  beforeEach(async () => {
    goodCommunityProposalId = await proposalsTestHelper.depositAndCreateCommunityProposal(accounts.communityProposalOwner);
  });

  afterEach(async () => {
    await proposalsTestHelper.advanceTimeEndCommunityProposalAndWithdrawDeposit(accounts.communityProposalOwner,
        goodCommunityProposalId);
  });

  context('castVote()', async () => {
    const goodCastVoteSecret = testHelper.randomBytes32();

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodCommunityProposalId, goodCastVoteSecret, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCast');
      assert.equal(logArgs.proposalId.toNumber(), goodCommunityProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
    }

    async function castVoteFails(_communityProposalId, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_communityProposalId, goodCastVoteSecret,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeToVotingStart(goodCommunityProposalId);
    });

    context('succeeds with', async () => {
      it('good parameters', async() => {
        await castVoteSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('communityProposalId', async() => {
          const badCommunityProposalId = 9999;
          await castVoteFails(badCommunityProposalId, 'Proposal has the wrong status');
        });
      });
    });

    context('bad state', async () => {
      it('vote has already been cast', async() => {
        await votingTestHelper.castVote(accounts.goodVoterAddress, goodCommunityProposalId, goodVoteOption);
        await castVoteFails(goodCommunityProposalId, 'Already voted');
      });
    });
  });

  context('revealVote()', async () => {
    let goodRevealVoteSignedMessage;

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodCommunityProposalId, goodVoteOption);
      await votingTestHelper.advanceTimeToRevealingStart(goodCommunityProposalId);
      goodRevealVoteSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodCommunityProposalId, goodVoteOption);
    });

    async function revealVoteSucceeds() {
      await proposalsManager.revealVote(goodRevealVoteSignedMessage, goodCommunityProposalId, goodVoteOption,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteRevealed');
      assert.equal(logArgs.proposalId.toNumber(), goodCommunityProposalId.toNumber());
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
          const badCommunityProposalId = 8888;
          const badSignedMessage = await signingHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
              badCommunityProposalId, goodVoteOption);
          await revealVoteFails(badSignedMessage, goodCommunityProposalId, goodVoteOption, 'Voter must be the sender');
        });

        it('communityProposalId', async() => {
          const badCommunityProposalId = 9999;
          await revealVoteFails(goodRevealVoteSignedMessage, badCommunityProposalId, goodVoteOption,
              'Must be in revealing phase or later');
        });

        it('optionId', async() => {
          const badOptionId = 99;
          await revealVoteFails(goodRevealVoteSignedMessage, goodCommunityProposalId, badOptionId, 'Invalid option');
        });
      });

      context('bad state', async() => {
        it('vote has already been revealed', async() => {
          await votingTestHelper.revealVote(accounts.goodVoterAddress, goodCommunityProposalId, goodVoteOption);
          await revealVoteFails(goodRevealVoteSignedMessage, goodCommunityProposalId, goodVoteOption,
              'Stored vote must be the same as the revealed one');
        });
      });
    });
  });

  context('cancelVote()', async () => {
    async function cancelVoteSucceeds() {
      await proposalsManager.cancelVote(goodCommunityProposalId, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogVoteCancelled');
      assert.equal(logArgs.proposalId.toNumber(), goodCommunityProposalId.toNumber(), 'wrong community proposal Id');
      assert.equal(logArgs.sender, accounts.goodVoterAddress, 'wrong sender');
    }

    async function cancelVoteFails(_communityProposalId, _voter, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.cancelVote(_communityProposalId, {from: _voter}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodCommunityProposalId, goodVoteOption);
    });

    context('succeeds with', async () => {
      it('good parameters', async() => {
        await cancelVoteSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('communityProposalId', async() => {
          const badCommunityProposalId = 9999;
          await cancelVoteFails(badCommunityProposalId, accounts.goodVoterAddress,
              'Proposal must be in the voting period or after revealing finished');
        });
      });

      context('bad state', async () => {
        it('without voting first', async() => {
          await cancelVoteFails(goodCommunityProposalId, accounts.badVoterAddress, 'Sender must have a non revealed vote');
        });

        it('in the revealing period', async() => {
          await votingTestHelper.advanceTimeToRevealingStart(goodCommunityProposalId);
          await cancelVoteFails(goodCommunityProposalId, accounts.goodVoterAddress,
              'Proposal must be in the voting period or after revealing finished');
        });

        it('cancelled vote', async() => {
          await proposalsManager.cancelVote(goodCommunityProposalId, {from: accounts.goodVoterAddress});
          await cancelVoteFails(goodCommunityProposalId, accounts.goodVoterAddress,
              'Sender must have a non revealed vote');
        });
      });
    });
  });

  context('getCommunityProposalDeposit()', async () => {
    context('succeeds with', async() => {
      it('good parameters', async() => {
        const expectedDeposit = avtTestHelper.toNat(new BN(100)); // value from parameter registry;
        const actualDeposit = await proposalsManager.getCommunityProposalDeposit();
        testHelper.assertBNEquals(actualDeposit, expectedDeposit);
      });
    });
    // Note: there are no bad parameters and no bad state tests
  });
});