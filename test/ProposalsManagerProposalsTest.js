const testHelper = require("./helpers/testHelper");
const votingTestHelper = require("./helpers/votingTestHelper");

contract('ProposalsManager - Proposal set-up', async () => {
  testHelper.profilingHelper.addTimeReports('ProposalsManager - Proposal set-up');

  const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
  const oneWeek = oneDay.times(7);
  const minimumVotingPeriod = oneWeek;
  const tenThousandYears = oneDay.times(10000 * 365);
  let proposalsManager;
  let proposalId = new web3.BigNumber(0);
  let deposit = new web3.BigNumber(0);

  before(async () => {
    await testHelper.before();
    await votingTestHelper.before(testHelper);

    proposalsManager = testHelper.getProposalsManager();

    deposit = await proposalsManager.getGovernanceProposalDeposit();
  });

  after(async () => await testHelper.checkFundsEmpty());

  function earliestLobbyStartTime() {
    return testHelper.now();
  }

  async function createProposal(desc, _owner) {
    let owner = _owner || testHelper.getAccount(0);

    await testHelper.addAVTToFund(deposit, owner, "deposit");

    await proposalsManager.createGovernanceProposal(desc, {from: owner});
    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogGovernanceProposalCreated);
    const oldProposalId = proposalId;
    proposalId = eventArgs.proposalId;
    assert.equal(proposalId.toNumber(), oldProposalId.plus(1).toNumber(), "ids are not sequential");
    assert.equal(eventArgs.desc, desc, "wrong description");
  }

  async function withdrawDeposit() {
    await testHelper.withdrawAVTFromFund(deposit, testHelper.getAccount(0), 'deposit');
  }

  async function cleanUpProposal() {
    await testHelper.advanceTimeToEndOfProposal(proposalId);
    await proposalsManager.endGovernanceProposal(proposalId);
    await withdrawDeposit();
  }

  context("createProposal", async () => {
    it("can create a valid proposal", async () => {
      await createProposal("We should go bowling for a team outing.");
      await cleanUpProposal();
    });

    it("can create a proposal with the same description as an existing one", async () => {
      await createProposal("We should go bowling for a team outing.");
      await cleanUpProposal();
    });

    it("cannot create a proposal if we haven't paid a deposit", async () => {
      await testHelper.expectRevert(() => proposalsManager.createGovernanceProposal("This should fail"));
    });
  });

  context("end governance proposal", async () => {
    it ("cannot withdraw funds until proposal has ended", async () => {
      await createProposal("We have to wait for our money.");
      await testHelper.expectRevert(() => withdrawDeposit());
      await testHelper.expectRevert(() => withdrawDeposit());
      await testHelper.advanceTimeToEndOfProposal(proposalId);
      await testHelper.expectRevert(() => withdrawDeposit());
      await proposalsManager.endGovernanceProposal(proposalId);
      await withdrawDeposit();
    });

    it("can end proposal in revealing period, if all votes have been revealed", async() => {
      await createProposal("We have to wait for our money.");
      const voter1 = testHelper.getAccount(0);
      const voter2 = testHelper.getAccount(1);
      const voter3 = testHelper.getAccount(2);

      await testHelper.advanceTimeToVotingStart(proposalId);
      const signedMessage1 = await votingTestHelper.castVote(proposalId, 1, voter1);
      const signedMessage2 = await votingTestHelper.castVote(proposalId, 1, voter2);
      const signedMessage3 = await votingTestHelper.castVote(proposalId, 2, voter3);

      await testHelper.advanceTimeToRevealingStart(proposalId);

      await votingTestHelper.revealVote(signedMessage1, proposalId, 1, voter1);
      await votingTestHelper.revealVote(signedMessage2, proposalId, 1, voter2);

      // cannot end proposal while there are unrevealed votes
      await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(proposalId));

      await votingTestHelper.revealVote(signedMessage3, proposalId, 2, voter3);

      await proposalsManager.endGovernanceProposal(proposalId);
      await withdrawDeposit();
    });
  });
});
