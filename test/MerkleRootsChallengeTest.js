const testHelper = require("./helpers/testHelper");
const membersTestHelper = require("./helpers/membersTestHelper");
const votingTestHelper = require("./helpers/votingTestHelper");
const merkleProofTestHelper = require("./helpers/merkleProofTestHelper.js");
const web3Utils = require('web3-utils');

contract('Merkle roots challenges', async () => {
  testHelper.profilingHelper.addTimeReports('Merkle roots challenges');

  let merkleRootsManager, membersManager, proposalsManager;
  let depositForMerkleRoot;
  let challengeProposalId = 0;

  const stake = testHelper.oneAVT;
  const defaultRootHash = web3Utils.soliditySha3("I am Merkle Root");

  const scalingProvider = testHelper.getAccount(0);
  const challengeOwner = testHelper.getAccount(1);
  const challengeEnder = testHelper.getAccount(2);
  const voter1 =  testHelper.getAccount(3);

  before(async () => {
    await testHelper.before();
    await membersTestHelper.before(testHelper);
    await votingTestHelper.before(testHelper);
    await merkleProofTestHelper.before(testHelper);

    proposalsManager = testHelper.getProposalsManager();
    merkleRootsManager = merkleProofTestHelper.getMerkleRootsManager();

    await membersTestHelper.depositAndRegisterMember(scalingProvider, testHelper.scalingProviderMemberType, testHelper.evidenceURL, "Registering scalingProvider");
    depositForMerkleRoot = await merkleRootsManager.getNewMerkleRootDeposit();
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(scalingProvider, testHelper.scalingProviderMemberType);
    await testHelper.checkFundsEmpty();
  });

  async function registerMerkleRoot(_rootHash) {
    await testHelper.addAVTToFund(depositForMerkleRoot, scalingProvider, "deposit");
    await merkleRootsManager.registerMerkleRoot(scalingProvider, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash);
  }

  async function registerMerkleRootFails(_rootHash) {
    await testHelper.expectRevert(() => merkleRootsManager.registerMerkleRoot(scalingProvider, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash));
  }

  async function deregisterMerkleRoot(_rootHash) {
    await merkleRootsManager.deregisterMerkleRoot(_rootHash, {from: scalingProvider});
    await testHelper.withdrawAVTFromFund(depositForMerkleRoot, scalingProvider, "deposit");
  }

  async function deregisterMerkleRootFails(_rootHash) {
    await testHelper.expectRevert(() => merkleRootsManager.deregisterMerkleRoot(_rootHash, {from: scalingProvider}));
  }

  async function getExistingMerkleRootDeposit(_rootHash) {
    return await merkleRootsManager.getExistingMerkleRootDeposit(_rootHash);
  }

  async function challengeMerkleRootSucceeds(_rootHash) {
    let challengeProposalDeposit = await getExistingMerkleRootDeposit(_rootHash);
    await testHelper.addAVTToFund(challengeProposalDeposit, challengeOwner, "deposit");
    await merkleRootsManager.challengeMerkleRoot(_rootHash, {from: challengeOwner});

    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootChallenged);
    const oldChallengeProposalId = challengeProposalId;
    challengeProposalId = eventArgs.proposalId.toNumber();

    assert.equal(challengeProposalId, oldChallengeProposalId + 1);
    assert.equal(_rootHash, eventArgs.rootHash);

    return {"challengeProposalId":challengeProposalId, "challengeProposalDeposit":challengeProposalDeposit};
  }

  async function challengeMerkleRootFails(_rootHash, _deposit) {
    _deposit = _deposit || await getExistingMerkleRootDeposit(_rootHash);

    await testHelper.addAVTToFund(_deposit, challengeOwner, "deposit");
    await testHelper.expectRevert(() =>  merkleRootsManager.challengeMerkleRoot(_rootHash, {from: challengeOwner}));
    await testHelper.withdrawAVTFromFund(_deposit, challengeOwner, "deposit");
  }

  async function endChallengeSucceeds(_challengeProposalId, _votesFor, _votesAgainst, _rootHash) {
    await testHelper.advanceTimeToEndOfProposal(_challengeProposalId);
    await merkleRootsManager.endMerkleRootChallenge(_rootHash, {from: challengeEnder});

    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootChallengeEnded);
    assert.equal(_rootHash, eventArgs.rootHash);
    assert.equal(_challengeProposalId, eventArgs.proposalId.toNumber());
    assert.equal(_votesFor, eventArgs.votesFor.toNumber());
    assert.equal(_votesAgainst, eventArgs.votesAgainst.toNumber());
  }

  context("Challenge", async () => {
    beforeEach(async () => {
      await registerMerkleRoot(defaultRootHash);
    });

    afterEach(async () => {
      await deregisterMerkleRoot(defaultRootHash);
    });

    async function voteOnChallenge(_challengeProposalId, _opt) {
      await testHelper.addAVTToFund(stake, voter1, "stake");
      await votingTestHelper.advanceTimeCastAndRevealVotes(_challengeProposalId, [{voter: voter1, option: _opt}]);
    }

    async function withdrawWinningsForSuccessfulChallenge(_challengeProposalId, _deposit) {
      const winnings = _deposit.dividedToIntegerBy(10);
      await testHelper.withdrawAVTFromFund(winnings, challengeOwner, "deposit");
      await testHelper.withdrawAVTFromFund(winnings, challengeEnder, "deposit");
      // Winning voter(s) gets the rest.
      await proposalsManager.claimVoterWinnings(_challengeProposalId, {from: voter1});

      await testHelper.withdrawAVTFromFund(_deposit.minus(winnings).minus(winnings), voter1, "deposit");
      await testHelper.withdrawAVTFromFund(_deposit, challengeOwner, "deposit");
      await testHelper.withdrawAVTFromFund(stake, voter1, "stake");
    }

    it("can get the correct deposit for an existing challenge", async () => {
      let deposit = await getExistingMerkleRootDeposit(defaultRootHash);
      assert.notEqual(deposit.toNumber(), 0);
      assert.equal(deposit.toString(), depositForMerkleRoot.toString());
    });

    it("cannot challenge without sufficient deposit", async () => {
      const insufficientDeposit = (await getExistingMerkleRootDeposit(defaultRootHash)).minus(new web3.BigNumber(1));
      await challengeMerkleRootFails(defaultRootHash, insufficientDeposit);
    });

    it("cannot challenge a non-existent merkle root", async () => {
      const rootHash = web3Utils.soliditySha3("Apple tree");
      await challengeMerkleRootFails(rootHash, depositForMerkleRoot);
    });

    it("cannot get deposit for non-existent merkle root", async () => {
      let deposit = await getExistingMerkleRootDeposit(web3Utils.soliditySha3("banana"));
      assert.equal(deposit.toNumber(), 0);
    });

    context("Challenge outcomes", async () => {

      async function withdrawWinningsForUnsuccessfulChallenge(_deposit) {
        const winnings = _deposit.dividedToIntegerBy(10);
        await testHelper.withdrawAVTFromFund(_deposit.minus(winnings), challengeEnder, "deposit");
        await testHelper.withdrawAVTFromFund(winnings, scalingProvider, "deposit");
      }

      async function withdrawWinningsForUnsuccessfulChallengeWithVotes(_challengeProposalId, _deposit) {
        const winnings = _deposit.dividedToIntegerBy(10);
        await testHelper.withdrawAVTFromFund(winnings, scalingProvider, "deposit");
        await testHelper.withdrawAVTFromFund(winnings, challengeEnder, "deposit");
        // Winning voter(s) gets the rest.
        await proposalsManager.claimVoterWinnings(_challengeProposalId, {from: voter1});
        await testHelper.withdrawAVTFromFund(_deposit.minus(winnings).minus(winnings), voter1, "deposit");
        await testHelper.withdrawAVTFromFund(stake, voter1, "stake");
      }

      async function markMerkleRootAsFraudulent(_rootHash) {
        let result = await challengeMerkleRootSucceeds(_rootHash);
        await voteOnChallenge(result.challengeProposalId, 1);
        await endChallengeSucceeds(result.challengeProposalId, stake, 0, _rootHash);
        await withdrawWinningsForSuccessfulChallenge(result.challengeProposalId, result.challengeProposalDeposit);
      }

      it("pays the correct winnings for unsuccessful challenge - no votes", async () => {
        let result = await challengeMerkleRootSucceeds(defaultRootHash);
        await endChallengeSucceeds(result.challengeProposalId, 0, 0, defaultRootHash);
        // no one voted so the challenge failed
        await withdrawWinningsForUnsuccessfulChallenge(result.challengeProposalDeposit);
      });

      it("pays the correct winnings for unsuccessful challenge - with votes", async () => {
        let result = await challengeMerkleRootSucceeds(defaultRootHash);
        await voteOnChallenge(result.challengeProposalId, 2);
        await endChallengeSucceeds(result.challengeProposalId, 0, stake, defaultRootHash);
        await withdrawWinningsForUnsuccessfulChallengeWithVotes(result.challengeProposalId, result.challengeProposalDeposit);
      });

      it("pays the correct winnings for successful challenge - with votes", async () => {
        const rootHash = web3Utils.soliditySha3("Root 1");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);
      });

      it ("cannot deregister fraudulent merkle root", async () => {
        const rootHash = web3Utils.soliditySha3("Root 2");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);

        await deregisterMerkleRootFails(rootHash);
      });

      it ("can re-register fraudulent merkle root", async () => {
        const rootHash = web3Utils.soliditySha3("Root 3");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);

        await testHelper.addAVTToFund(depositForMerkleRoot, scalingProvider, "deposit");
        await registerMerkleRoot(rootHash);
        await deregisterMerkleRoot(rootHash);
        await testHelper.withdrawAVTFromFund(depositForMerkleRoot, scalingProvider, "deposit");
      });
    });
  });
});