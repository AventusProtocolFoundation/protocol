const testHelper = require("./helpers/testHelper");

contract('AventusVote - Proposal set-up', function () {
  const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
  const oneWeek = oneDay.times(7);
  const minimumVotingPeriod = oneWeek;
  const tenThousandYears = oneDay.times(10000 * 365);
  let aventusVote, avt;
  let proposalId = new web3.BigNumber(0);
  let deposit = new web3.BigNumber(0);

  before(async function() {
    await testHelper.before();

    aventusVote = testHelper.getAventusVote();
    avt = testHelper.getAVTContract();
    deposit = await aventusVote.getGovernanceProposalDeposit();
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
    await avt.approve(aventusVote.address, deposit, {from: owner});
    await aventusVote.deposit("deposit", deposit, {from: owner});

    await aventusVote.createGovernanceProposal(desc, {from: owner});
    const eventArgs = await testHelper.getEventArgs(aventusVote.LogCreateProposal);
    const oldProposalId = proposalId;
    proposalId = eventArgs.proposalId;
    assert.equal(proposalId.toNumber(), oldProposalId.plus(1).toNumber(), "ids are not sequential");
    assert.equal(eventArgs.desc, desc, "wrong description");
  }

  async function cleanUpProposal() {
    await testHelper.advanceTimeToEndOfProposal(proposalId);
    await aventusVote.endProposal(proposalId);
    await aventusVote.withdraw("deposit", deposit);
  }

  context("createProposal", async () => {
    it("can create a valid proposal", async function() {
      await createProposal("We should go bowling for a team outing.");
      await cleanUpProposal();
    });

    it("can create a proposal with the same description as an existing one", async function() {
      await createProposal("We should go bowling for a team outing.");
      await cleanUpProposal();
    });

    it("cannot create a proposal if we haven't paid a deposit", async function() {
      await testHelper.expectRevert(() => aventusVote.createGovernanceProposal("This should fail"));
    });
  });

  context("endProposal", async () => {
    it ("cannot withdraw funds until proposal has ended", async function() {
      await createProposal("We have to wait for our money.");
      await testHelper.expectRevert(() => aventusVote.withdraw("deposit", deposit));
      await testHelper.expectRevert(() => aventusVote.withdraw("deposit", deposit));
      await testHelper.advanceTimeToEndOfProposal(proposalId);
      await testHelper.expectRevert(() => aventusVote.withdraw("deposit", deposit));
      await aventusVote.endProposal(proposalId);
      await aventusVote.withdraw("deposit", deposit);
    });
  });
});