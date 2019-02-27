const LProposalForTesting = artifacts.require('LProposalForTesting');
const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');

contract('Proxy testing', async () => {
  let accounts;
  let proposalsManager, aventusStorage;
  let newLibraryAddress, oldLibraryAddress;
  let proposalDeposit;
  let libraryKey;

  before(async function () {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);

    aventusStorage = testHelper.getAventusStorage();
    proposalsManager = testHelper.getProposalsManager();

    const versionMajorMinor = await testHelper.getVersionMajorMinor();
    libraryKey = testHelper.hash('LProposalsInstance' + '-' + versionMajorMinor);

    newLibraryAddress = (await LProposalForTesting.deployed()).address;
    oldLibraryAddress = await aventusStorage.getAddress(libraryKey);
    accounts = testHelper.getAccounts('accountZero');
  });

  after(async () => await avtTestHelper.checkBalancesAreZero());

  async function createProposal(_desc) {
    proposalDeposit = await proposalsManager.getGovernanceProposalDeposit();
    await avtTestHelper.addAVT(proposalDeposit, accounts.accountZero);
    await proposalsManager.createGovernanceProposal(_desc);
    const logArgs = await testHelper.getLogArgs(proposalsManager, 'LogGovernanceProposalCreated');
    return logArgs.proposalId.toNumber();
  }

  async function useNewLibrary() {
    await setLProposalsInstance(newLibraryAddress);
  }

  async function useOldLibrary() {
    await setLProposalsInstance(oldLibraryAddress);
  }

  async function setLProposalsInstance(_instanceAddr) {
    await aventusStorage.setAddress(libraryKey, _instanceAddr);
  }

  async function endProposalAndWithdrawDeposit(_proposalId) {
    await votingTestHelper.advanceTimeToEndOfProposal(_proposalId);
    await proposalsManager.endGovernanceProposal(_proposalId);
    await avtTestHelper.withdrawAVT(proposalDeposit, accounts.accountZero);
  }

  it('can access the current version number', async () => {
    const currentVersion = await testHelper.getVersion();
    assert.equal(3, currentVersion.split('.').length);
  });

  it('can call new version of a method with the same signature', async () => {
    // Calling a method with the original LProposals library results in normal behaviour.
    let proposalId = await createProposal('Shall we use the original library?');
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);

    // Now using the updated libraray...
    await useNewLibrary();
    // ...then calling the method again should give different behaviour.
    proposalId = await createProposal('What will the new library print?');
    assert.equal(proposalId, 2018);
    await avtTestHelper.withdrawAVT(proposalDeposit, accounts.accountZero);

    // Put the old library back...
    await useOldLibrary();
    //.. and the original behaviour is restored.
    proposalId = await createProposal('Shall we go back to the old library?');
    assert.notEqual(proposalId, 2018);
    await endProposalAndWithdrawDeposit(proposalId);
  });

  it('cannot call new version of a method with different signature', async () => {
    let proposalId = await createProposal('The new library will crash');
    await votingTestHelper.advanceTimeToEndOfProposal(proposalId);

    // Using the updated library should fail.
    await useNewLibrary();
    // Expect revert with no expected error as this will revert in the VM, not in our code.
    await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(proposalId), '');

    // Put the old library back...
    await useOldLibrary();
    // ...and the correct behaviour is restored.
    await proposalsManager.endGovernanceProposal(proposalId);
    await avtTestHelper.withdrawAVT(proposalDeposit, accounts.accountZero);
  });
});