const testHelper = require("./helpers/testHelper");
const votingTestHelper = require("./helpers/votingTestHelper");
const membersTestHelper = require("./helpers/membersTestHelper");

contract('Member challenges', async () => {
  testHelper.profilingHelper.addTimeReports('Member challenges');

  let validMemberDeposit = new web3.BigNumber(0);
  let validChallengeDeposit = new web3.BigNumber(0);
  let validChallengeProposalId = 0;

  const challengeOwner = testHelper.getAccount(1);
  const voter1 =  testHelper.getAccount(2);
  const voter2 =  testHelper.getAccount(3);
  const challengeEnder = testHelper.getAccount(4);

  const memberAddress = testHelper.getAccount(5);
  const fraudulentMemberAddress = testHelper.getAccount(6);
  const challengeFreeMemberAddress = testHelper.getAccount(7);

  const memberTypes = [
      testHelper.brokerMemberType,
      testHelper.primaryMemberType,
      testHelper.secondaryMemberType,
      testHelper.tokenBondingCurveMemberType,
      testHelper.scalingProviderMemberType
  ];

  const stake = testHelper.oneAVT;

  before(async () => {
    await testHelper.before();
    await votingTestHelper.before(testHelper);
    await membersTestHelper.before(testHelper);

    proposalsManager = testHelper.getProposalsManager();
    membersManager = membersTestHelper.getMembersManager();
  });

  async function registerMember(_memberAddress, _memberType) {
    validMemberDeposit = await membersManager.getNewMemberDeposit(_memberType);
    await makeDeposit(validMemberDeposit, _memberAddress);
    await membersManager.registerMember(_memberAddress, _memberType, testHelper.evidenceURL, "Registering member");
  }

  async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
    await membersManager.deregisterMember(_memberAddress, _memberType);
    let deposit = await membersManager.getNewMemberDeposit(_memberType);
    await withdrawDeposit(deposit, _memberAddress);
  }

  async function getExistingMemberDeposit(_memberAddress, _memberType) {
    return await membersManager.getExistingMemberDeposit(_memberAddress, _memberType);
  }

  async function challengeMemberSucceeds(_memberAddress, _memberType) {
    validChallengeDeposit = await getExistingMemberDeposit(_memberAddress, _memberType);
    await makeDeposit(validChallengeDeposit, challengeOwner);
    await membersManager.challengeMember(_memberAddress, _memberType, {from: challengeOwner});
    const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberChallenged);

    const oldChallengeProposalId = validChallengeProposalId;
    validChallengeProposalId = eventArgs.proposalId.toNumber();
    assert.equal(validChallengeProposalId, oldChallengeProposalId + 1);
  }

  async function challengeMemberFails(_deposit, _memberAddress, _memberType) {
    await makeDeposit(_deposit, challengeOwner);
    await testHelper.expectRevert(() => membersManager.challengeMember(_memberAddress, _memberType, {from: challengeOwner}));
    await withdrawDeposit(_deposit, challengeOwner);
  }

  async function endChallengeMember(_memberAddress, _memberType, _expectedVotesFor, _expectedVotesAgainst) {
    await testHelper.advanceTimeToEndOfProposal(validChallengeProposalId);
    await membersManager.endMemberChallenge(_memberAddress, _memberType, {from: challengeEnder});
    const eventArgs = await testHelper.getEventArgs(membersManager.LogMemberChallengeEnded);
    assert.equal(validChallengeProposalId, eventArgs.proposalId.toNumber());
    assert.equal(_expectedVotesFor, eventArgs.votesFor.toNumber());
    assert.equal(_expectedVotesAgainst, eventArgs.votesAgainst.toNumber());
  }

  async function withdrawDepositsAfterChallengeEnds() {
    // No one voted. The member wins their fixed amount...
    await withdrawDeposit(fixedAmountToWinner(), memberAddress);
    // ...the challenge ender gets the rest.
    await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);
  }

  async function makeDeposit(_depositAmount, _depositer) {
    await testHelper.addAVTToFund(_depositAmount, _depositer, 'deposit');
  }

  async function withdrawDeposit(_withdrawlAmount, _withdrawer) {
    await testHelper.withdrawAVTFromFund(_withdrawlAmount, _withdrawer, 'deposit');
  }

  async function depositStake(_stakeAmount, _depositer) {
    await testHelper.addAVTToFund(_stakeAmount, _depositer, "stake");
  }

  async function withdrawStake(_withdrawlAmount, _withdrawer) {
    await testHelper.withdrawAVTFromFund(_withdrawlAmount, _withdrawer, 'stake');
  }

  function fixedAmountToWinner() {
    // Winner currently gets 10%.
    return validChallengeDeposit.dividedToIntegerBy(10);
  }

  function fixedAmountToChallengeEnder() {
    // Challenge ender currently gets 10%
    return validChallengeDeposit.dividedToIntegerBy(10);
  }

  for (let j = 0; j < memberTypes.length; ++j) {
    const memberType = memberTypes[j];

    context(`Create and end ${memberType} challenge - no votes`, async () => {
      beforeEach(async () => {
        await registerMember(memberAddress, memberType);
      });

      afterEach(async () => {
        await deregisterMemberAndWithdrawDeposit(memberAddress, memberType);
      });

      after(async () => await testHelper.checkFundsEmpty());

      it("can create and end a challenge to a valid member", async () => {
        await challengeMemberSucceeds(memberAddress, memberType);
        await endChallengeMember(memberAddress, memberType, 0, 0);
        await withdrawDepositsAfterChallengeEnds();
      });

      it("cannot create a challenge to a member without sufficient deposit", async () => {
        const insufficientDeposit = (await getExistingMemberDeposit(memberAddress, memberType)).minus(new web3.BigNumber(1));
        await challengeMemberFails(insufficientDeposit, memberAddress, memberType);
      });

      it("cannot create a challenge to deregistered member", async () => {
        await deregisterMemberAndWithdrawDeposit(memberAddress, memberType);
        validChallengeDeposit = await membersManager.getNewMemberDeposit(memberType);
        await makeDeposit(validChallengeDeposit, challengeOwner);
        await testHelper.expectRevert(() => membersManager.challengeMember(memberAddress, memberType, {from: challengeOwner}));
        await withdrawDeposit(validChallengeDeposit, challengeOwner);
        // registering again so the AfterEach block doesn't break for this test
        await registerMember(memberAddress, memberType);
      });

      it("can get the correct member deposit", async () => {
        let deposit = await getExistingMemberDeposit(memberAddress, memberType);
        assert.notEqual(deposit.toNumber(), 0);
        assert.equal(deposit.toString(), validMemberDeposit.toString());
      });
    });

    context(`Create and end ${memberType} challenge - with votes`, async () => {
      beforeEach(async () => {
        await registerMember(memberAddress, memberType);
        await challengeMemberSucceeds(memberAddress, memberType);
        await depositStake(stake, voter1);
        await depositStake(stake, voter2);
      });

      afterEach(async () => {
        await withdrawStake(stake, voter1);
        await withdrawStake(stake, voter2);
      });

      after(async () => {
        await testHelper.checkFundsEmpty();
      });

      it("pays the correct winnings in the case of disagreement winning", async () => {
        await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId, [{voter: voter1, option: 2}]);

        await endChallengeMember(memberAddress, memberType, 0, stake);
        // Challenge lost, the winner is the member.
        await withdrawDeposit(fixedAmountToWinner(), memberAddress);
        // The challenge ender gets their bit.

        await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
        // Winning voter gets the rest.
        await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter1});
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter1);
        await deregisterMemberAndWithdrawDeposit(memberAddress, memberType);
      });

      it("pays the correct winnings in the case of disagreement winning via a 'score draw'", async () => {
        await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId,
            [{voter: voter1, option: 1}, {voter: voter2, option: 2}]);

        await endChallengeMember(memberAddress, memberType, stake, stake);
        // Challenge lost, the winner is the member.
        await withdrawDeposit(fixedAmountToWinner(), memberAddress);
        // The challenge ender gets their bit.
        await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
        // Winning voter gets the rest.
        await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter2});
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter2);

        await deregisterMemberAndWithdrawDeposit(memberAddress, memberType);
      });

      it("pays the correct winnings in the case of disagreement winning via a 'no-score draw'", async () => {
        await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
        const signedMessage1 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter1);
        const signedMessage2 = await votingTestHelper.castVote(validChallengeProposalId, 2, voter2);
        // No-one reveals their votes before the deadline.

        await endChallengeMember(memberAddress, memberType, 0, 0);

        await votingTestHelper.revealVote(signedMessage1, validChallengeProposalId, 1, voter1);
        await votingTestHelper.revealVote(signedMessage2, validChallengeProposalId, 2, voter2);

        // Challenge lost, the winner is the member.
        await withdrawDeposit(fixedAmountToWinner(), memberAddress);
        // The challenge ender gets the rest.
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);

        await deregisterMemberAndWithdrawDeposit(memberAddress, memberType);
      });

      // TODO: Implement test: "can only sell and return tickets if member has not been deemed fraudulent" (issue #552)
    });
  }

  context(`Create and end challenge - fraudulent`, async () => {
    let winningsRemainder = 0;

    // TODO: Move to MembersHelper and reduce to only one voter.
    async function voteToMarkMemberAsFraudulentAndWithdrawWinnings(_memberAddress, _memberType) {
      await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId,
          [{voter: voter1, option: 1}, {voter: voter2, option: 1}]);
      await endChallengeMember(_memberAddress, _memberType, stake * 2, 0);
      // Challenge won, the winner is the challenge owner.
      await withdrawDeposit(fixedAmountToWinner(), challengeOwner);
      // The challenge ender gets their bit.
      await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
      // Winning voters get the rest.
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter1});
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter2});
      const totalVoterWinnings = validMemberDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder());
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter1);
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter2);
      // Challenge is over, withdraw the deposit.
      await withdrawDeposit(validChallengeDeposit, challengeOwner);
      winningsRemainder += totalVoterWinnings.mod(2).toNumber();
    }

    before(async () => {
      await registerMember(fraudulentMemberAddress, testHelper.brokerMemberType);
      await challengeMemberSucceeds(fraudulentMemberAddress, testHelper.brokerMemberType);
      await depositStake(stake, voter1);
      await depositStake(stake, voter2);
      await voteToMarkMemberAsFraudulentAndWithdrawWinnings(fraudulentMemberAddress, testHelper.brokerMemberType);
    });

    after(async () => {
      await withdrawStake(stake, voter1);
      await withdrawStake(stake, voter2);

      if (winningsRemainder > 0) {
        console.log("TODO: Deal with remainder of ", winningsRemainder);
      } else {
        await testHelper.checkFundsEmpty();
      }
    });

    it("cannot deregister member if fraudulent", async () => {
      // Member is now marked as fraudulent - we can not deregister it.
      await testHelper.expectRevert(() => membersManager.deregisterMember(fraudulentMemberAddress, testHelper.brokerMemberType));
    });

    it("cannot challenge member if fraudulent", async () => {
      await makeDeposit(validChallengeDeposit, challengeOwner);
      // Member is now marked as fraudulent - we can not challenge it.
      await testHelper.expectRevert(() => membersManager.challengeMember(fraudulentMemberAddress, testHelper.brokerMemberType, {from: challengeOwner}));
      await withdrawDeposit(validChallengeDeposit, challengeOwner);
    });

  });

  context("Create and end challenge - general", async () => {
    beforeEach(async () => {
      await registerMember(memberAddress, testHelper.brokerMemberType);
    });

    afterEach(async () => {
      await deregisterMemberAndWithdrawDeposit(memberAddress, testHelper.brokerMemberType);
    });

    after(async () => await testHelper.checkFundsEmpty());

    it("cannot get the member deposit for non-existent members", async () => {
      let deposit = await getExistingMemberDeposit(challengeOwner, "banana");
      assert.equal(deposit.toNumber(), 0);
    });

    it("cannot challenge a non-existent member", async () => {
      const correctDeposit = await getExistingMemberDeposit(memberAddress, testHelper.brokerMemberType);
      await challengeMemberFails(correctDeposit, memberAddress, "penguin");
    });

    it("cannot create more than one challenge for a member", async () => {
      await challengeMemberSucceeds(memberAddress, testHelper.brokerMemberType);
      await challengeMemberFails(validChallengeDeposit, memberAddress, testHelper.brokerMemberType);
      await endChallengeMember(memberAddress, testHelper.brokerMemberType, 0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });

    it("cannot end a non-existent challenge", async () => {
      await challengeMemberSucceeds(memberAddress, testHelper.brokerMemberType);
      await testHelper.expectRevert(() => membersManager.endMemberChallenge(challengeFreeMemberAddress, testHelper.brokerMemberType, {from: challengeEnder}));
      await endChallengeMember(memberAddress, testHelper.brokerMemberType, 0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });

    it ("cannot deregister a member when under challenge", async () => {
      await challengeMemberSucceeds(memberAddress, testHelper.brokerMemberType);
      await testHelper.expectRevert(() => membersManager.deregisterMember(memberAddress, testHelper.brokerMemberType));
      await endChallengeMember(memberAddress, testHelper.brokerMemberType, 0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });
  });

});
