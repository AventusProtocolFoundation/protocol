const testHelper = require('./helpers/testHelper');
const governanceProposalsTestHelper = require('./helpers/proposalsTestHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const signingHelper = require('../utils/signingHelper');
const votingTestHelper = require('./helpers/votingTestHelper');

contract('Misc testing', async () => {

  it('incorrect version for ecrecover', async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await votingTestHelper.init(testHelper, timeTestHelper);
    await governanceProposalsTestHelper.init(testHelper, avtTestHelper, votingTestHelper);
    const accounts = testHelper.getAccounts('governanceProposalOwner', 'voter');

    const proposalId = await governanceProposalsTestHelper.depositAndCreateGovernanceProposal(accounts.governanceProposalOwner);

    await votingTestHelper.advanceTimeToVotingStart(proposalId);
    const optionId = 1;
    const voter = accounts.voter;
    await votingTestHelper.castVote(voter, proposalId, optionId);

    await votingTestHelper.advanceTimeToRevealingStart(proposalId);
    const signedMessage = await signingHelper.getRevealVoteSignedMessage(voter, proposalId, optionId);
    const badSignedMessage = signedMessage.substr(0, signedMessage.length - 2) + '55';
    const proposalsManager = testHelper.getProposalsManager();
    testHelper.expectRevert(() => proposalsManager.revealVote(badSignedMessage, proposalId, optionId, {from: voter}),
        'Incorrect signature version');
    await proposalsManager.revealVote(signedMessage, proposalId, optionId, {from: voter});
  });
});