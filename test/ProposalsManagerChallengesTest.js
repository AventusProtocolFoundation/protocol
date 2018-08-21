const EventsManager = artifacts.require("EventsManager");
const testHelper = require("./helpers/testHelper");
const votingTestHelper = require("./helpers/votingTestHelper");

contract('ProposalsManager - Event challenges', async () => {
  const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
  const oneWeek = oneDay.times(7);
  let validEventId = 0;
  let validEventDeposit = new web3.BigNumber(0);
  let validChallengeDeposit = new web3.BigNumber(0);
  let validChallengeProposalId = 0;

  const eventOwner = testHelper.getAccount(0);
  const challengeOwner = testHelper.getAccount(1);
  const voter1 =  testHelper.getAccount(2);
  const voter2 =  testHelper.getAccount(3);
  const challengeEnder = testHelper.getAccount(4);  
  const stake = testHelper.oneAVT;
  const fixedPercentageToWinner = 10;
  const fixedPercentageToChallengeEnder = 10;

  before(async () => {
    await votingTestHelper.before();

    eventsManager = await EventsManager.deployed();
    proposalsManager = testHelper.getProposalsManager();
    avtManager = testHelper.getAVTManager();

    avt = testHelper.getAVTContract();
  });

  // Create an event: always owned by account 0.
  async function createValidEvent() {
    const eventDesc = "My event " + (validEventId + 1);
    const eventTime = testHelper.now().plus(oneWeek * 20);
    const ticketSaleStartTime = testHelper.now().plus(oneWeek * 6);
    const eventSupportURL = "http://www.eventbrite.com/events?eventid=27110";
    const capacity = 10000;
    const averageTicketPriceInUSCents = 675;
    const deposits = await eventsManager.getEventDeposit(capacity, averageTicketPriceInUSCents, ticketSaleStartTime, {from: eventOwner});
    validEventDeposit = deposits[1];

    await makeDeposit(validEventDeposit, eventOwner);

    await eventsManager.createEvent(eventDesc, eventTime, capacity, averageTicketPriceInUSCents, ticketSaleStartTime, eventSupportURL, {from: eventOwner});
    const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
    validEventId = eventArgs.eventId.toNumber();
  }

  async function endEventAndWithdrawDeposit() {
    await testHelper.advanceTimeToEventEnd(validEventId);
    await eventsManager.unlockEventDeposit(validEventId);
    await withdrawDeposit(validEventDeposit, eventOwner);
  }

  async function getExistingEventDeposit(_eventId) {
    return await proposalsManager.getExistingEventDeposit(_eventId);
  }

  async function createEventChallengeSucceeds() {
    validChallengeDeposit = await getExistingEventDeposit(validEventId);
    await makeDeposit(validChallengeDeposit, challengeOwner);
    await proposalsManager.createEventChallenge(validEventId, {from: challengeOwner});
    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogCreateEventChallenge);

    const oldChallengeProposalId = validChallengeProposalId;
    validChallengeProposalId = eventArgs.proposalId.toNumber();
    assert.equal(validChallengeProposalId, oldChallengeProposalId + 1);
  }

  async function createEventChallengeFails(_deposit, _eventId) {
    await makeDeposit(_deposit, challengeOwner);
    await testHelper.expectRevert(() => proposalsManager.createEventChallenge(_eventId, {from: challengeOwner}));
    await withdrawDeposit(_deposit, challengeOwner);
  }

  async function endChallengeEvent(votesFor, votesAgainst) {
    await testHelper.advanceTimeToEndOfProposal(validChallengeProposalId);
    await proposalsManager.endProposal(validChallengeProposalId, {from: challengeEnder});
    const eventArgs = await testHelper.getEventArgs(proposalsManager.LogEndProposal);
    assert.equal(validChallengeProposalId, eventArgs.proposalId.toNumber());
    assert.equal(votesFor, eventArgs.votesFor.toNumber());
    assert.equal(votesAgainst, eventArgs.votesAgainst.toNumber());
  }

  async function makeDeposit(_depositAmount, _depositer) {
    if (_depositer != testHelper.getAccount(0)) {
      // Any other account will not have any AVT: give them what they need.
      await avt.transfer(_depositer, _depositAmount);
    }
    await avt.approve(testHelper.getStorage().address, _depositAmount, {from: _depositer});
    await avtManager.deposit('deposit', _depositAmount, {from: _depositer});
  }

  async function withdrawDeposit(_withdrawlAmount, _withdrawer) {
    await avtManager.withdraw('deposit', _withdrawlAmount, {from: _withdrawer});
  }

  async function depositStake(_stakeAmount, _depositer) {
    if (_depositer != testHelper.getAccount(0)) {
      // Any other account will not have any AVT: give them what they need.
      await avt.transfer(_depositer, _stakeAmount);
    }
    await avt.approve(testHelper.getStorage().address, _stakeAmount, {from: _depositer});
    await avtManager.deposit('stake', _stakeAmount, {from: _depositer});
  }

  async function withdrawStake(_withdrawlAmount, _withdrawer) {
    await avtManager.withdraw('stake', _withdrawlAmount, {from: _withdrawer});
  }

  context("Challenge deposit", async () => {
    it("can get the correct event deposit", async () => {
      await createValidEvent();
      let deposit = await getExistingEventDeposit(validEventId);
      assert.notEqual(deposit.toNumber(), 0);
      assert.equal(deposit.toString(), validEventDeposit.toString());
      await endEventAndWithdrawDeposit();
    });

    it("cannot get the event deposit for non-existent event", async () => {
      let deposit = await getExistingEventDeposit(999999);
      assert.equal(deposit.toNumber(), 0);
    });
  });

  function fixedAmountToWinner() {
    // Winner currently gets 10%.
    return validChallengeDeposit.dividedToIntegerBy(10);
  }

  function fixedAmountToChallengeEnder() {
    // Challenge ender currently gets 10%
    return validChallengeDeposit.dividedToIntegerBy(10);
  }

  context("Create and end challenge - no votes", async () => {

    beforeEach(async () => {
      await createValidEvent();
    });

    afterEach(async () => {
      await endEventAndWithdrawDeposit();
    });

    after(async () => await testHelper.checkFundsEmpty());

    async function withdrawDepositsAfterChallengeEnds() {
      // No one voted. The event owner wins their fixed amount...
      await withdrawDeposit(fixedAmountToWinner(), eventOwner);
      // ...the challenge ender gets the rest.
      await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);
    }

    it("can create and end a challenge to a valid event", async () => {
      await createEventChallengeSucceeds();
      await endChallengeEvent(0, 0);

      await withdrawDepositsAfterChallengeEnds();
    });

    it("cannot create a challenge to a non-existing event", async () => {
      const correctDeposit = await getExistingEventDeposit(validEventId);
      const wrongEventId = 99999;
      await createEventChallengeFails(correctDeposit, wrongEventId);
    });

    it("cannot create a challenge to an event without sufficient deposit", async () => {
      const insufficientDeposit = (await getExistingEventDeposit(validEventId)).minus(new web3.BigNumber(1));
      await createEventChallengeFails(insufficientDeposit, validEventId);
    });

    it("cannot create more than one challenge to an event", async () => {
      await createEventChallengeSucceeds();
      await createEventChallengeFails(validChallengeDeposit, validEventId);
      await endChallengeEvent(0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });

    it("cannot end a non-existent challenge", async () => {
      await createEventChallengeSucceeds();
      await testHelper.expectRevert(() => proposalsManager.endProposal(99999999, {from: challengeEnder}));
      await endChallengeEvent(0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });

    it("cannot cancel an event when under challenge", async () => {
      await createEventChallengeSucceeds();
      await testHelper.expectRevert(() => eventsManager.cancelEvent(validEventId, {from: eventOwner}));
      await endChallengeEvent(0, 0);
      await withdrawDepositsAfterChallengeEnds();
    });

    it("cannot create a challenge to an event that has ended", async() => {
      const correctDeposit = await getExistingEventDeposit(validEventId);
      await testHelper.advanceTimeToEventEnd(validEventId);
      await createEventChallengeFails(correctDeposit, validEventId);
    });
  });

  context("End challenge - with votes", async () => {
    let winningsRemainder = 0;

    beforeEach(async () => {
      await createValidEvent();
      await testHelper.advanceTimeToEventTicketSaleStart(validEventId);
      await createEventChallengeSucceeds(challengeOwner);
      await depositStake(stake, voter1);
      await depositStake(stake, voter2);
    });

    afterEach(async () => {
      await withdrawStake(stake, voter1);
      await withdrawStake(stake, voter2);
    });

    after(async () => {
      if (winningsRemainder > 0) {
        console.log("TODO: Deal with remainder of ", winningsRemainder);
      } else {
        await testHelper.checkFundsEmpty();
      }
    });

    async function voteToMarkEventAsFraudulentAndWithdrawWinnings() {
      await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
      const signedMessage1 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter1);
      const signedMessage2 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter2);
      await testHelper.advanceTimeToRevealingStart(validChallengeProposalId);
      await votingTestHelper.revealVote(signedMessage1, validChallengeProposalId, 1, voter1);
      await votingTestHelper.revealVote(signedMessage2, validChallengeProposalId, 1, voter2);
      await endChallengeEvent(stake * 2, 0);
      // Challenge won, the winner is the challenge owner.
      await withdrawDeposit(fixedAmountToWinner(), challengeOwner);
      // The challenge ender gets their bit.
      await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
      // Winning voters get the rest.
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter1});
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter2});
      const totalVoterWinnings = validEventDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder());
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter1);
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter2);
      // Challenge is over, withdraw the deposit.
      await withdrawDeposit(validChallengeDeposit, challengeOwner);
      winningsRemainder += totalVoterWinnings.mod(2).toNumber();
    }

    it("pays the correct winnings in the case of agreement winning", async () => {
      await voteToMarkEventAsFraudulentAndWithdrawWinnings();
    });

    it("pays the correct winnings in the case of disagreement winning", async () => {
      await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
      const signedMessage = await votingTestHelper.castVote(validChallengeProposalId, 2, voter1);
      await testHelper.advanceTimeToRevealingStart(validChallengeProposalId);
      await votingTestHelper.revealVote(signedMessage, validChallengeProposalId, 2, voter1);

      await endChallengeEvent(0, stake);
      // Challenge lost, the winner is the event owner.
      await withdrawDeposit(fixedAmountToWinner(), eventOwner);
      // The challenge ender gets their bit.

      await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
      // Winning voter gets the rest.
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter1});
      await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter1);
      await endEventAndWithdrawDeposit();
    });

    it("pays the correct winnings in the case of disagreement winning via a 'score draw'", async () => {
      await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
      const signedMessage1 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter1);
      const signedMessage2 = await votingTestHelper.castVote(validChallengeProposalId, 2, voter2);
      await testHelper.advanceTimeToRevealingStart(validChallengeProposalId);
      await votingTestHelper.revealVote(signedMessage1, validChallengeProposalId, 1, voter1);
      await votingTestHelper.revealVote(signedMessage2, validChallengeProposalId, 2, voter2);

      await endChallengeEvent(stake, stake);
      // Challenge lost, the winner is the event owner.
      await withdrawDeposit(fixedAmountToWinner(), eventOwner);
      // The challenge ender gets their bit.
      await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
      // Winning voter gets the rest.
      await proposalsManager.claimVoterWinnings(validChallengeProposalId, {from: voter2});
      await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter2);

      await endEventAndWithdrawDeposit();
    });

    it("pays the correct winnings in the case of disagreement winning via a 'no-score draw'", async () => {
      await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
      const signedMessage1 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter1);
      const signedMessage2 = await votingTestHelper.castVote(validChallengeProposalId, 2, voter2);
      // No-one reveals their votes before the deadline.

      await endChallengeEvent(0, 0);

      await votingTestHelper.revealVote(signedMessage1, validChallengeProposalId, 1, voter1);
      await votingTestHelper.revealVote(signedMessage2, validChallengeProposalId, 2, voter2);

      // Challenge lost, the winner is the event owner.
      await withdrawDeposit(fixedAmountToWinner(), eventOwner);
      // The challenge ender gets the rest.
      await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);

      await endEventAndWithdrawDeposit();
    });

    it("can only sell and refund tickets if event has not been deemed fraudulent", async () => {
      const ticketBuyer = voter2; // Doesn't really matter who buys the ticket.
      await eventsManager.sellTicket(validEventId, "row 3, seat 1", ticketBuyer, {from: eventOwner});
      const ticketId1 = (await testHelper.getEventArgs(eventsManager.LogTicketSale)).ticketId.toNumber();
      await eventsManager.sellTicket(validEventId, "row 3, seat 2", ticketBuyer, {from: eventOwner});
      const ticketId2 = (await testHelper.getEventArgs(eventsManager.LogTicketSale)).ticketId.toNumber();
      await eventsManager.refundTicket(validEventId, ticketId1, {from: eventOwner});

      await voteToMarkEventAsFraudulentAndWithdrawWinnings();

      // Event is now marked as fraudulent - we can no longer sell or refund tickets.
      await testHelper.expectRevert(() => eventsManager.refundTicket(validEventId, ticketId2, {from: eventOwner}));
      await testHelper.expectRevert(() => eventsManager.sellTicket(validEventId, "row 3, seat 3", ticketBuyer, {from: eventOwner}));
    });

    it("can not cancel an event if it has been deemed fraudulent", async () => {
      await voteToMarkEventAsFraudulentAndWithdrawWinnings();

      // Event is now marked as fraudulent - we can not cancel it.
      await testHelper.expectRevert(() => eventsManager.cancelEvent(validEventId, {from: eventOwner}));
    });
  });
});
