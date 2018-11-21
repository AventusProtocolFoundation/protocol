const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');

contract('Governance proposals voting', async () => {
  let proposalsManager;
  let goodGovernanceProposalId;
  const goodVoteOption = 2;
  const accounts = testHelper.getAccounts('goodVoterAddress', 'badVoterAddress');

  before(async () => {
    await testHelper.init();
    await timeTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    proposalsManager = testHelper.getProposalsManager();
  });

  after(async () => {
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  beforeEach(async () => {
    goodGovernanceProposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();
  });

  afterEach(async () => {
    await governanceProposalsTestHelper.advanceTimeEndGovernanceProposalAndWithdrawDeposit(goodGovernanceProposalId);
  });

  context('castVote()', async () => {
    const goodCastVoteSecret = 0;
    let goodPrevTime;

    async function castVoteSucceeds() {
      await proposalsManager.castVote(goodGovernanceProposalId, goodCastVoteSecret, goodPrevTime,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogVoteCast);
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.sender, accounts.goodVoterAddress);
      assert.equal(logArgs.secret, goodCastVoteSecret);
      assert.equal(logArgs.prevTime.toNumber(), goodPrevTime.toNumber());
    }

    async function castVoteFails(_governanceProposalId, _prevTime, _expectedError) {
      // Parameter 'goodCastVoteSecret' is not validated by the protocol when casting a vote.
      // Anyone can cast a vote so there is no bad voter.
      await testHelper.expectRevert(() => proposalsManager.castVote(_governanceProposalId, goodCastVoteSecret, _prevTime,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeToVotingStart(goodGovernanceProposalId);
      goodPrevTime = await proposalsManager.getPrevTimeParamForCastVote(goodGovernanceProposalId,
          {from: accounts.goodVoterAddress});
    });

    it('succeeds if governance proposal is in voting period', async() => {
      await castVoteSucceeds();
    });

    context('fails with bad parameter', async () => {
      it('governance proposal Id', async() => {
        const badGovernanceProposalId = 9999;
        await castVoteFails(badGovernanceProposalId, goodPrevTime, 'Proposal has the wrong status');
      });

      it('previous vote time', async() => {
        const badPrevTime = goodPrevTime.plus(10);
        await castVoteFails(goodGovernanceProposalId, badPrevTime, 'Invalid previous time');
      });
    });

    it('fails if state is already voted', async() => {
      await votingTestHelper.castVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
      await castVoteFails(goodGovernanceProposalId, goodPrevTime, 'Already voted');
    });
  });

  context('revealVote()', async () => {
    let goodRevealVoteSignedMessage;

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
      await votingTestHelper.advanceTimeToRevealingStart(goodGovernanceProposalId);
      goodRevealVoteSignedMessage = signingTestHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
          goodGovernanceProposalId, goodVoteOption);
    });

    async function revealVoteSucceeds() {
      await proposalsManager.revealVote(goodRevealVoteSignedMessage, goodGovernanceProposalId, goodVoteOption,
          {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogVoteRevealed);
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber());
      assert.equal(logArgs.optId, goodVoteOption);
    }

    async function revealVoteFails(_signedMessage, _proposalId, _optionId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.revealVote(_signedMessage, _proposalId, _optionId,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    it('succeeds if already voted and proposal is in revealing period', async() => {
      await revealVoteSucceeds();
    });

    context('fails with bad parameter', async () => {
      it('reveal vote signed message', async() => {
        const badGovernanceProposalId = 8888;
        const badSignedMessage = await signingTestHelper.getRevealVoteSignedMessage(accounts.goodVoterAddress,
            badGovernanceProposalId, goodVoteOption);
        await revealVoteFails(badSignedMessage, goodGovernanceProposalId, goodVoteOption, 'Voter must be the sender');
      });

      it('governance proposal Id', async() => {
        const badGovernanceProposalId = 9999;
        await revealVoteFails(goodRevealVoteSignedMessage, badGovernanceProposalId, goodVoteOption,
            'Must be in revealing phase or later');
      });

      it('option Id', async() => {
        const badOptionId = 99;
        await revealVoteFails(goodRevealVoteSignedMessage, goodGovernanceProposalId, badOptionId, 'Invalid option');
      });
    });

    it('fails if state is already revealed', async() => {
      await votingTestHelper.revealVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
      await revealVoteFails(goodRevealVoteSignedMessage, goodGovernanceProposalId, goodVoteOption,
          'Stored vote must be the same as the revealed one');
    });
  });

  context('cancelVote()', async () => {
    async function cancelVoteSucceeds() {
      await proposalsManager.cancelVote(goodGovernanceProposalId, {from: accounts.goodVoterAddress});
      const logArgs = await testHelper.getLogArgs(proposalsManager.LogVoteCancelled);
      assert.equal(logArgs.proposalId.toNumber(), goodGovernanceProposalId.toNumber(), 'wrong governance proposal Id');
      assert.equal(logArgs.sender, accounts.goodVoterAddress, 'wrong sender');
    }

    async function cancelVoteFails(_governanceProposalId, _voter, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.cancelVote(_governanceProposalId, {from: _voter}), _expectedError);
    }

    beforeEach(async () => {
      await votingTestHelper.advanceTimeAndCastVote(accounts.goodVoterAddress, goodGovernanceProposalId, goodVoteOption);
    });

    it('succeeds if already voted and before revealing period start', async() => {
      await cancelVoteSucceeds();
    });

    it('fails with bad governance proposal Id parameter', async() => {
      const badGovernanceProposalId = 9999;
      await cancelVoteFails(badGovernanceProposalId, accounts.goodVoterAddress,
          'Proposal must be in the voting period or after revealing finished');
    });

    context('fails with bad state', async () => {

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

  context('getPrevTimeParamForCastVote()', async () => {
    async function getPrevTimeParamForCastVoteSucceeds() {
      await proposalsManager.getPrevTimeParamForCastVote(goodGovernanceProposalId, {from: accounts.goodVoterAddress});
    }

    async function getPrevTimeParamForCastVoteFails(_governanceProposalId, _expectedError) {
      await testHelper.expectRevert(() => proposalsManager.getPrevTimeParamForCastVote(_governanceProposalId,
          {from: accounts.goodVoterAddress}), _expectedError);
    }

    it('succeeds for an existing proposal', async() => {
      await getPrevTimeParamForCastVoteSucceeds();
    });

    it('fails with bad governance proposal id parameter', async() => {
      const badGovernanceProposalId = 7777;
      await getPrevTimeParamForCastVoteFails(badGovernanceProposalId, 'Proposal does not exist');
    });
    // Note: there are no bad state tests
  });

  context('getGovernanceProposalDeposit()', async () => {
    it('succeeds', async() => {
      const expectedDepositInUSCents = avtTestHelper.getAVTFromUSCents(10000); // value from parameter registry;
      const depositInUSCents = await proposalsManager.getGovernanceProposalDeposit();
      assert.equal(depositInUSCents.toNumber(), expectedDepositInUSCents);
    });
    // Note: there are no bad parameters and no bad state tests
  });
});