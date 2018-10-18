const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const votingTestHelper = require("./helpers/votingTestHelper");
const web3Utils = require('web3-utils');

contract('Event challenges', async () => {
  testHelper.profilingHelper.addTimeReports('Event challenges');

  const emptyDoorData = "0x";
  // TODO: Rename all these to "good" instead of "valid".

  let validChallengeDeposit = new web3.BigNumber(0);
  let validChallengeProposalId = 0;
  let validOwnerProof;
  let ticketCount = 0;

  const eventOwner = testHelper.getAccount(0);
  const challengeOwner = testHelper.getAccount(1);
  const voter1 =  testHelper.getAccount(2);
  const voter2 =  testHelper.getAccount(3);
  const challengeEnder = testHelper.getAccount(4);
  const isViaBroker = false;
  const noBrokerAddress = '0x';
  const stake = testHelper.oneAVT;

  let eventsManager;

  before(async () => {
    await testHelper.before();
    await votingTestHelper.before(testHelper);
    await eventsTestHelper.before(testHelper, noBrokerAddress, eventOwner);

    eventsManager = eventsTestHelper.getEventsManager();
  });

  async function createValidEvent() {
    let eventData;
    eventData = await eventsTestHelper.makeEventDepositAndCreateValidEvent(isViaBroker);
    validOwnerProof = await eventsTestHelper.generateOwnerProof(eventData.id, eventOwner);
    return eventData;
  }

  // TODO: replace by call to this function in eventsTestHelper,
  // once the latter does not use a global state
  async function advanceTimeEndEventAndWithdrawDeposit(eventId, eventDeposit) {
    await testHelper.advanceTimeToEventEnd(eventId);
    await eventsManager.endEvent(eventId);
    await withdrawDeposit(eventDeposit, eventOwner);
  }

  async function getExistingEventDeposit(_eventId) {
    return await eventsManager.getExistingEventDeposit(_eventId);
  }

  async function challengeEventSucceeds(eventId) {
    validChallengeDeposit = await getExistingEventDeposit(eventId);
    await makeDeposit(validChallengeDeposit, challengeOwner);
    await eventsManager.challengeEvent(eventId, {from: challengeOwner});
    const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventChallenged);

    const oldChallengeProposalId = validChallengeProposalId;
    validChallengeProposalId = eventArgs.proposalId.toNumber();
    assert.equal(validChallengeProposalId, oldChallengeProposalId + 1);
  }

  async function challengeEventFails(_deposit, _eventId) {
    await makeDeposit(_deposit, challengeOwner);
    await testHelper.expectRevert(() => eventsManager.challengeEvent(_eventId, {from: challengeOwner}));
    await withdrawDeposit(_deposit, challengeOwner);
  }

  async function advanceTimeAndEndEventChallenge(eventId) {
    await testHelper.advanceTimeToEndOfProposal(validChallengeProposalId);
    await eventsManager.endEventChallenge(eventId, {from: challengeEnder});
  }

  async function assertChallengeVotes(_expectedFor, _expectedAgainst) {
    const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventChallengeEnded);
    assert.equal(validChallengeProposalId, eventArgs.proposalId.toNumber());
    assert.equal(_expectedFor, eventArgs.votesFor.toNumber());
    assert.equal(_expectedAgainst, eventArgs.votesAgainst.toNumber());
  }

  async function makeDeposit(_depositAmount, _depositer) {
    await testHelper.addAVTToFund(_depositAmount, _depositer, "deposit");
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

  context("Challenge deposit", async () => {
    it("can get the correct event deposit", async () => {
      let testEvent  = await createValidEvent();
      let existingEventDeposit = await getExistingEventDeposit(testEvent.id);
      assert.notEqual(existingEventDeposit.toNumber(), 0);
      assert.equal(testEvent.deposit.toString(), existingEventDeposit.toString());
      await advanceTimeEndEventAndWithdrawDeposit(testEvent.id, testEvent.deposit);
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

  // TODO: Add futher sub-contexts and before/after methods to extract common code between tests
  context("Create and end challenge - no votes", async () => {
    let goodEvent;

    beforeEach(async () => {
      goodEvent = await createValidEvent();
    });

    afterEach(async () => {
      await advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
    });

    after(async () => await testHelper.checkFundsEmpty());

    async function withdrawDepositsAfterChallengeEnds() {
      // No one voted. The event owner wins their fixed amount...
      await withdrawDeposit(fixedAmountToWinner(), eventOwner);
      // ...the challenge ender gets the rest.
      await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);
    }

    it("can create and end a challenge to a valid event", async () => {
      await challengeEventSucceeds(goodEvent.id);
      await advanceTimeAndEndEventChallenge(goodEvent.id);
      await assertChallengeVotes(0, 0);

      await withdrawDepositsAfterChallengeEnds();
    });

    context("cannot create a challenge", async () => {
      it("to a non-existing event", async () => {
        const correctDeposit = await getExistingEventDeposit(goodEvent.id);
        const wrongEventId = 99999;
        await challengeEventFails(correctDeposit, wrongEventId);
      });

      it("to an event without sufficient deposit", async () => {
        const insufficientDeposit = (await getExistingEventDeposit(goodEvent.id)).minus(new web3.BigNumber(1));
        await challengeEventFails(insufficientDeposit, goodEvent.id);
      });

      it("to an event that has ended", async() => {
        const correctDeposit = await getExistingEventDeposit(goodEvent.id);
        await testHelper.advanceTimeToEventEnd(goodEvent.id);
        await challengeEventFails(correctDeposit, goodEvent.id);
      });
    });

    context("given an event is under challenge", async () => {
      beforeEach(async () => {
        await challengeEventSucceeds(goodEvent.id);
      });

      afterEach(async () => {
        await assertChallengeVotes(0, 0);
        await withdrawDepositsAfterChallengeEnds();
      });

      context("and in reporting period", async () => {
        afterEach(async () => {
          await advanceTimeAndEndEventChallenge(goodEvent.id);
        });

        it("cannot create another challenge to the same event", async () => {
          await challengeEventFails(validChallengeDeposit, goodEvent.id);
        });

        it("cannot end a non-existent challenge", async () => {
          await testHelper.expectRevert(() => eventsManager.endEventChallenge(99999999, {from: challengeEnder}));
        });

        it("cannot cancel the event", async () => {
          await testHelper.expectRevert(() => eventsManager.cancelEvent(goodEvent.id, validOwnerProof, {from: eventOwner}));
        });
      });

      context("and after off sale time", async () => {
        beforeEach(async () => {
          await testHelper.advanceTimeToEventEnd(goodEvent.id);
        });

        afterEach(async () => {
          await eventsManager.endEventChallenge(goodEvent.id, {from: challengeEnder});
        });

        it("cannot end the event", async () => {
          await testHelper.expectRevert(() => eventsManager.endEvent(goodEvent.id, {from: eventOwner}));
        });
      });
    });

  });

  context("End challenge - with votes", async () => {
    let winningsRemainder = 0;
    let goodEvent;

    beforeEach(async () => {
      goodEvent = await createValidEvent();
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

    function claimVoterWinnings(_voterAddress) {
      return votingTestHelper.claimVoterWinnings(validChallengeProposalId, _voterAddress);
    }

    async function voteToMarkEventAsFraudulentAndWithdrawWinnings(eventId, eventDeposit) {
      assert(eventDeposit !== undefined, "[eventChallengesTest.voteToMarkEventAsFraudulentAndWithdrawWinnings] eventDeposit must be defined");
      await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId,
          [{voter: voter1, option: 1}, {voter: voter2, option: 1}]);
      await advanceTimeAndEndEventChallenge(eventId);
      await assertChallengeVotes(stake * 2, 0);
      // Challenge won, the winner is the challenge owner.
      await withdrawDeposit(fixedAmountToWinner(), challengeOwner);
      // The challenge ender gets their bit.
      await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
      // Winning voters get the rest.
      await claimVoterWinnings(voter1);
      await claimVoterWinnings(voter2);
      const totalVoterWinnings = eventDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder());
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter1);
      await withdrawDeposit(totalVoterWinnings.dividedToIntegerBy(2), voter2);
      // Challenge is over, withdraw the deposit.
      await withdrawDeposit(validChallengeDeposit, challengeOwner);
      winningsRemainder += totalVoterWinnings.mod(2).toNumber();
    }

    context("clears the event challenge by", async () => {
      beforeEach(async () => {
        await challengeEventSucceeds(goodEvent.id);
      });

      afterEach(async () => {
        await advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
      });

      it("winning the vote", async () => {
        await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId, [{voter: voter1, option: 2}]);

        await advanceTimeAndEndEventChallenge(goodEvent.id);
        await assertChallengeVotes(0, stake);
        // Challenge lost, the winner is the event owner.
        await withdrawDeposit(fixedAmountToWinner(), eventOwner);
        // The challenge ender gets their bit.

        await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
        // Winning voter gets the rest.
        await claimVoterWinnings(voter1);
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter1);
      });

      it("a 'score draw'", async () => {
        await votingTestHelper.advanceTimeCastAndRevealVotes(validChallengeProposalId,
            [{voter: voter1, option: 1}, {voter: voter2, option: 2}]);

        await advanceTimeAndEndEventChallenge(goodEvent.id);
        await assertChallengeVotes(stake, stake);
        // Challenge lost, the winner is the event owner.
        await withdrawDeposit(fixedAmountToWinner(), eventOwner);
        // The challenge ender gets their bit.
        await withdrawDeposit(fixedAmountToChallengeEnder(), challengeEnder);
        // Winning voter gets the rest.
        await claimVoterWinnings(voter2);
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()).minus(fixedAmountToChallengeEnder()), voter2);
      });

      it("a 'no-score draw'", async () => {
        await testHelper.advanceTimeToVotingStart(validChallengeProposalId);
        const signedMessage1 = await votingTestHelper.castVote(validChallengeProposalId, 1, voter1);
        const signedMessage2 = await votingTestHelper.castVote(validChallengeProposalId, 2, voter2);
        // No-one reveals their votes before the deadline.

        await advanceTimeAndEndEventChallenge(goodEvent.id);
        assertChallengeVotes(0, 0);

        await votingTestHelper.revealVote(signedMessage1, validChallengeProposalId, 1, voter1);
        await votingTestHelper.revealVote(signedMessage2, validChallengeProposalId, 2, voter2);

        // Challenge lost, the winner is the event owner.
        await withdrawDeposit(fixedAmountToWinner(), eventOwner);
        // The challenge ender gets the rest.
        await withdrawDeposit(validChallengeDeposit.minus(fixedAmountToWinner()), challengeEnder);
      });
    });

    context("marks the event as fraudulent then", async () => {

      beforeEach(async () => {
        await challengeEventSucceeds(goodEvent.id);
        await voteToMarkEventAsFraudulentAndWithdrawWinnings(goodEvent.id, goodEvent.deposit);
      });

      it("cannot cancel the event", async () => {
        await testHelper.expectRevert(() => eventsManager.cancelEvent(goodEvent.id, validOwnerProof, {from: eventOwner}));
      });

      it("cannot end the event", async () => {
        // TODO: add test.
      });

      it("cannot get the event deposit back", async () => {
        // TODO: add test.
      });

      it("can recreate the event ", async () => {
        // TODO: add test when marking as fraudulent clears the event hash.
      });
    });

    // TODO: Move the rest of this to EventsManagerTicketsTest.
    async function sellTicketFromEventOwner(_ticketBuyer, eventId) {
      const vendorTicketRefHash = web3Utils.soliditySha3("UniqueVendorTicketRef" + ticketCount++);
      const vendorProof = testHelper.createVendorTicketProof(eventId, vendorTicketRefHash, eventOwner, _ticketBuyer);
      await eventsManager.sellTicket(eventId, vendorTicketRefHash, "some metadata", _ticketBuyer, vendorProof,
          emptyDoorData, {from: eventOwner});
      return (await testHelper.getEventArgs(eventsManager.LogTicketSale)).ticketId;
    }

    async function returnTicketFromEventOwner(_ticketId, eventId) {
      const vendorReturnMessageHash = await web3Utils.soliditySha3(eventId, _ticketId);
      const vendorReturnTicketProof = testHelper.createSignedMessage(eventOwner, vendorReturnMessageHash);
      await eventsManager.returnTicket(eventId, _ticketId, vendorReturnTicketProof, {from: eventOwner});
    }

    it("can only sell and return tickets if event has not been deemed fraudulent", async () => {
      // Have to move to on-sale period first otherwise ending the challenge will be beyond the ticket sales time.
      await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
      await challengeEventSucceeds(goodEvent.id);

      const ticketBuyer = voter2;
      const ticketId1 = await sellTicketFromEventOwner(ticketBuyer, goodEvent.id);
      const ticketId2 = await sellTicketFromEventOwner(ticketBuyer, goodEvent.id);

      await returnTicketFromEventOwner(ticketId1, goodEvent.id);

      await voteToMarkEventAsFraudulentAndWithdrawWinnings(goodEvent.id, goodEvent.deposit);

      // Event is now marked as fraudulent - we can no longer sell or return tickets.
      await testHelper.expectRevert(() => returnTicketFromEventOwner(ticketId2, goodEvent.id));
      await testHelper.expectRevert(() => sellTicketFromEventOwner(ticketBuyer, goodEvent.id));
    });
  });
});