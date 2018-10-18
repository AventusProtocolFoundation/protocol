const IERC20 = artifacts.require("IERC20");
const LProposalForTesting = artifacts.require("LProposalForTesting.sol");
const testHelper = require("./helpers/testHelper");
const web3Utils = require('web3-utils');

contract('Proxy testing', async () => {
  testHelper.profilingHelper.addTimeReports('Proxy testing');

  const oneDay = 86400;  // seconds in one day.
  const oneWeek = 7 * oneDay;
  const minimumVotingPeriod = oneWeek;

  const account0 = testHelper.getAccount(0);

  let proposalsManager, aventusStorage;
  let newLibraryAddress, oldLibraryAddress;
  let proposalDeposit;

  let libraryKey;

  before(async function () {
    await testHelper.before();

    const versionMajorMinor = await testHelper.getVersionMajorMinor();
    libraryKey = web3Utils.soliditySha3("LProposalInstance" + "-" + versionMajorMinor);

    aventusStorage = testHelper.getStorage();
    proposalsManager = testHelper.getProposalsManager();
    newLibraryAddress = (await LProposalForTesting.deployed()).address;
    oldLibraryAddress = await aventusStorage.getAddress(libraryKey);
  });

  after(async () => await testHelper.checkFundsEmpty());

  async function createProposal(desc) {
    proposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
    await testHelper.addAVTToFund(proposalDeposit, account0, "deposit");

    await proposalsManager.createGovernanceProposal(desc);
    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogGovernanceProposalCreated);
    return eventArgs.proposalId.toNumber();
  }

  async function useNewLibrary() {
    await setLProposalInstance(newLibraryAddress);
  }

  async function useOldLibrary() {
    await setLProposalInstance(oldLibraryAddress);
  }

  async function setLProposalInstance(instanceAddr) {
    await aventusStorage.setAddress(libraryKey, instanceAddr);
  }

  async function endProposalAndWithdrawDeposit(_proposalId) {
    await testHelper.advanceTimeToEndOfProposal(_proposalId);
    await proposalsManager.endGovernanceProposal(_proposalId);
    await testHelper.withdrawAVTFromFund(proposalDeposit, account0, 'deposit');
  }

  it("can access the current version number", async () => {
    const currentVersion = testHelper.getVersion();
  });

  it("can call new version of a method with the same signature", async () => {
    // Calling a method with the original LProposal library results in normal behaviour.
    let proposalId = await createProposal("Shall we use the original library?");
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);

    // Now using the updated libraray...
    await useNewLibrary();
    // ...then calling the method again should give different behaviour.
    proposalId = await createProposal("What will the new library print?");
    assert.equal(proposalId, 2018);
    await testHelper.withdrawAVTFromFund(proposalDeposit, account0, 'deposit');

    // Put the old library back...
    await useOldLibrary();
    //.. and the original behaviour is restored.
    proposalId = await createProposal("Shall we go back to the old library?");
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);
  });

  it("cannot call new version of a method with different signature", async () => {
    let proposalId = await createProposal("The new library will crash");
    await testHelper.advanceTimeToEndOfProposal(proposalId);

    // Using the updated library should fail.
    await useNewLibrary();
    await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(proposalId));

    // Put the old library back...
    await useOldLibrary();
    // ...and the correct behaviour is restored.
    await proposalsManager.endGovernanceProposal(proposalId);
    await testHelper.withdrawAVTFromFund(proposalDeposit, account0, 'deposit');
  });
});
