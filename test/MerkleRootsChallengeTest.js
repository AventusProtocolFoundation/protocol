const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const MembersManager = artifacts.require("MembersManager");
const testHelper = require("./helpers/testHelper");
const membersTestHelper = require("./helpers/membersTestHelper");
const votingTestHelper = require("./helpers/votingTestHelper");
const web3Utils = require('web3-utils');

contract('Merkle roots challenges', async () => {
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
    merkleRootManager = await MerkleRootsManager.deployed();

    await testHelper.before();
    await membersTestHelper.before(testHelper);
    await votingTestHelper.before(testHelper);

    proposalsManager = testHelper.getProposalsManager();

    await membersTestHelper.depositAndRegisterMember(scalingProvider, testHelper.scalingProviderMemberType, testHelper.evidenceURL, "Registering scalingProvider");
    depositForMerkleRoot = await merkleRootManager.getNewMerkleRootDeposit();
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(scalingProvider, testHelper.scalingProviderMemberType);
    await testHelper.checkFundsEmpty();
  });

  async function registerMerkleRoot(_rootHash) {
    await testHelper.addAVTToFund(depositForMerkleRoot, scalingProvider, "deposit");
    await merkleRootManager.registerMerkleRoot(scalingProvider, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash);
  }

  async function registerMerkleRootFails(_rootHash) {
    await testHelper.expectRevert(() => merkleRootManager.registerMerkleRoot(scalingProvider, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash));
  }

  async function deregisterMerkleRoot(_rootHash) {
    await merkleRootManager.deregisterMerkleRoot(_rootHash, {from: scalingProvider});
    await testHelper.withdrawAVTFromFund(depositForMerkleRoot, scalingProvider, "deposit");
  }

  async function deregisterMerkleRootFails(_rootHash) {
    await testHelper.expectRevert(() => merkleRootManager.deregisterMerkleRoot(_rootHash, {from: scalingProvider}));
  }

  async function getExistingMerkleRootDeposit(_rootHash) {
    return await merkleRootManager.getExistingMerkleRootDeposit(_rootHash);
  }

  async function challengeMerkleRootSucceeds(_rootHash) {
    let challengeProposalDeposit = await getExistingMerkleRootDeposit(_rootHash);
    await testHelper.addAVTToFund(challengeProposalDeposit, challengeOwner, "deposit");
    await merkleRootManager.challengeMerkleRoot(_rootHash, {from: challengeOwner});

    const eventArgs = await testHelper.getEventArgs(merkleRootManager.LogMerkleRootChallenged);
    const oldChallengeProposalId = challengeProposalId;
    challengeProposalId = eventArgs.proposalId.toNumber();

    assert.equal(challengeProposalId, oldChallengeProposalId + 1);
    assert.equal(_rootHash, eventArgs.rootHash);

    return {"challengeProposalId":challengeProposalId, "challengeProposalDeposit":challengeProposalDeposit};
  }

  async function challengeMerkleRootFails(_rootHash, _deposit) {
    _deposit = _deposit || await getExistingMerkleRootDeposit(_rootHash);

    await testHelper.addAVTToFund(_deposit, challengeOwner, "deposit");
    await testHelper.expectRevert(() =>  merkleRootManager.challengeMerkleRoot(_rootHash, {from: challengeOwner}));
    await testHelper.withdrawAVTFromFund(_deposit, challengeOwner, "deposit");
  }

  async function endChallengeSucceeds(_challengeProposalId, _votesFor, _votesAgainst) {
    await testHelper.advanceTimeToEndOfProposal(_challengeProposalId);
    await proposalsManager.endProposal(_challengeProposalId, {from: challengeEnder});

    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogEndProposal);
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
      await testHelper.advanceTimeToVotingStart(_challengeProposalId);
      await testHelper.addAVTToFund(stake, voter1, "stake");
      const signedMessage = await votingTestHelper.castVote(_challengeProposalId, _opt, voter1);
      await testHelper.advanceTimeToRevealingStart(_challengeProposalId);
      await votingTestHelper.revealVote(signedMessage, _challengeProposalId, _opt, voter1);
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
        await endChallengeSucceeds(result.challengeProposalId, stake, 0);
        await withdrawWinningsForSuccessfulChallenge(result.challengeProposalId, result.challengeProposalDeposit);
      }

      it("pays the correct winnings for unsuccessful challenge - no votes", async () => {
        let result = await challengeMerkleRootSucceeds(defaultRootHash);
        await endChallengeSucceeds(result.challengeProposalId, 0, 0);
        // no one voted so the challenge failed
        await withdrawWinningsForUnsuccessfulChallenge(result.challengeProposalDeposit);
      });

      it("pays the correct winnings for unsuccessful challenge - with votes", async () => {
        let result = await challengeMerkleRootSucceeds(defaultRootHash);
        await voteOnChallenge(result.challengeProposalId, 2);
        await endChallengeSucceeds(result.challengeProposalId, 0, stake);
        await withdrawWinningsForUnsuccessfulChallengeWithVotes(result.challengeProposalId, result.challengeProposalDeposit);
      });

      it("pays the correct winnings for successful challenge - with votes", async () => {
        const rootHash = web3Utils.soliditySha3("Root 1");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);

        assert.equal(false, await merkleRootManager.merkleRootIsActive(rootHash), "Merkle root must not be active after a successful challenge");
      });

      it ("cannot deregister fraudulent merkle root", async () => {
        const rootHash = web3Utils.soliditySha3("Root 2");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);

        await deregisterMerkleRootFails(rootHash);
      });

      it ("cannot re-register fraudulent merkle root", async () => {
        const rootHash = web3Utils.soliditySha3("Root 3");
        await registerMerkleRoot(rootHash);
        await markMerkleRootAsFraudulent(rootHash);

        await testHelper.addAVTToFund(depositForMerkleRoot, scalingProvider, "deposit");
        await registerMerkleRootFails(rootHash);
        await testHelper.withdrawAVTFromFund(depositForMerkleRoot, scalingProvider, "deposit");
      });

    });
  });
});