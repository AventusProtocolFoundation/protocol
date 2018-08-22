const testHelper = require("./helpers/testHelper");

contract('ProposalsManager - Proposal set-up', async () => {
  const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
  const oneWeek = oneDay.times(7);
  const minimumVotingPeriod = oneWeek;
  const tenThousandYears = oneDay.times(10000 * 365);
  let proposalsManager, avtManager, avt;
  let proposalId = new web3.BigNumber(0);
  let deposit = new web3.BigNumber(0);

  before(async () => {
    await testHelper.before();

    proposalsManager = testHelper.getProposalsManager();
    avtManager = testHelper.getAVTManager();

    avt = testHelper.getAVTContract();
    deposit = await proposalsManager.getGovernanceProposalDeposit();
  });

  after(async () => await testHelper.checkFundsEmpty());

  function earliestLobbyStartTime() {
    return testHelper.now();
  }

  async function createProposal(desc, _owner) {
    let owner = _owner || testHelper.getAccount(0);
    if (owner == _owner) {
        // Any other account will not have any AVT: give them what they need.
        await avt.transfer(owner, deposit);
    }
    await avt.approve(testHelper.getStorage().address, deposit, {from: owner});
    await avtManager.deposit("deposit", deposit, {from: owner});

    await proposalsManager.createGovernanceProposal(desc, {from: owner});
    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogCreateProposal);
    const oldProposalId = proposalId;
    proposalId = eventArgs.proposalId;
    assert.equal(proposalId.toNumber(), oldProposalId.plus(1).toNumber(), "ids are not sequential");
    assert.equal(eventArgs.desc, desc, "wrong description");
  }

  async function cleanUpProposal() {
    await testHelper.advanceTimeToEndOfProposal(proposalId);
    await proposalsManager.endProposal(proposalId);
    await avtManager.withdraw("deposit", deposit);
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

  context("endProposal", async () => {
    it ("cannot withdraw funds until proposal has ended", async () => {
      await createProposal("We have to wait for our money.");
      await testHelper.expectRevert(() => avtManager.withdraw("deposit", deposit));
      await testHelper.expectRevert(() => avtManager.withdraw("deposit", deposit));
      await testHelper.advanceTimeToEndOfProposal(proposalId);
      await testHelper.expectRevert(() => avtManager.withdraw("deposit", deposit));
      await proposalsManager.endProposal(proposalId);
      await avtManager.withdraw("deposit", deposit);
    });
  });
});
