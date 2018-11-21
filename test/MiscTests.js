const testHelper = require('./helpers/testHelper');
const governanceProposalsTestHelper = require('./helpers/governanceProposalsTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const votingTestHelper = require('./helpers/votingTestHelper');

contract('Misc testing', async () => {
  const accounts = testHelper.getAccounts('governanceProposalOwner', 'voter');

  it('incorrect version for ecrecover', async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper, signingTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);

    const proposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal();

    await votingTestHelper.advanceTimeToVotingStart(proposalId);
    const optionId = 1;
    const voter = accounts.voter;
    await votingTestHelper.castVote(voter, proposalId, optionId);

    await votingTestHelper.advanceTimeToRevealingStart(proposalId);
    const signedMessage = signingTestHelper.getRevealVoteSignedMessage(voter, proposalId, optionId);
    const badSignedMessage = signedMessage.substr(0, signedMessage.length - 2) + '55';
    const proposalsManager = testHelper.getProposalsManager();
    testHelper.expectRevert(() => proposalsManager.revealVote(badSignedMessage, proposalId, optionId, {from: voter}),
        'Incorrect signature version');
    await proposalsManager.revealVote(signedMessage, proposalId, optionId, {from: voter});
  });
});