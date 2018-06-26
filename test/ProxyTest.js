const AventusVote = artifacts.require("AventusVote.sol");
const AventusStorage = artifacts.require("AventusStorage.sol");
const IERC20 = artifacts.require("IERC20");
const LProposalForTesting = artifacts.require("LProposalForTesting.sol");
const testHelper = require("./helpers/testHelper");

contract('Proxy testing', function () {
  const oneDay = 86400;  // seconds in one day.
  const oneWeek = 7 * oneDay;
  const minimumVotingPeriod = oneWeek;

  let aventusVote, aventusStorage, avt;
  let newLibraryAddress, oldLibraryAddress;
  let proposalDeposit;

  before(async function () {
    await testHelper.before();

    aventusStorage = testHelper.getStorage();
    aventusVote = testHelper.getAventusVote();
    newLibraryAddress = (await LProposalForTesting.deployed()).address;
    oldLibraryAddress = await aventusStorage.getAddress(web3.sha3("LProposalInstance"));

    avt = testHelper.getAVTContract();
  });

  after(async () => await testHelper.checkFundsEmpty());

  async function createProposal(desc) {
    proposalDeposit = await aventusVote.getGovernanceProposalDeposit();
    await avt.approve(aventusVote.address, proposalDeposit);
    await aventusVote.deposit("deposit", proposalDeposit);

    await aventusVote.createGovernanceProposal(desc);
    const eventArgs = await testHelper.getEventArgs(aventusVote.LogCreateProposal);
    return eventArgs.proposalId.toNumber();
  }

  async function useNewLibrary() {
    await setLProposalInstance(newLibraryAddress);
  }

  async function useOldLibrary() {
    await setLProposalInstance(oldLibraryAddress);
  }

  async function setLProposalInstance(instanceAddr) {
    await aventusStorage.setAddress(web3.sha3("LProposalInstance"), instanceAddr);
  }

  async function endProposalAndWithdrawDeposit(_proposalId) {
    await testHelper.advanceTimeToEndOfProposal(_proposalId);
    await aventusVote.endProposal(_proposalId);
    await aventusVote.withdraw("deposit", proposalDeposit);
  }

  it("can call new version of a method with the same signature", async function() {
    // Calling a method with the original LProposal library results in normal behaviour.
    let proposalId = await createProposal("Shall we use the original library?");
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);

    // Now using the updated libraray...
    await useNewLibrary();
    // ...then calling the method again should give different behaviour.
    proposalId = await createProposal("What will the new library print?");
    assert.equal(proposalId, 2018);
    await aventusVote.withdraw("deposit", proposalDeposit);

    // Put the old library back...
    await useOldLibrary();
    //.. and the original behaviour is restored.
    proposalId = await createProposal("Shall we go back to the old library?");
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);
  });

  it("cannot call new version of a method with different signature", async function() {
    let proposalId = await createProposal("The new library will crash");
    await testHelper.advanceTimeToEndOfProposal(proposalId);

    // Using the updated library should fail.
    await useNewLibrary();
    await testHelper.expectRevert(() => aventusVote.endProposal(proposalId));

    // Put the old library back...
    await useOldLibrary();
    // ...and the correct behaviour is restored.
    await aventusVote.endProposal(proposalId);
    await aventusVote.withdraw("deposit", proposalDeposit);
  });
});