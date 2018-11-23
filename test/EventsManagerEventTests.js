const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');

contract('EventsManager - events', async () => {
  let eventsManager;
  const accounts = testHelper.getAccounts('eventOwner', 'notEventOwner', 'broker');

  const freeEventAverageTicketPriceInUSCents = 0;
  const badEventId = 9999;

  before(async () => {
    await testHelper.init();
    await signingTestHelper.init(testHelper);
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);

    eventsManager = testHelper.getEventsManager();
    await membersTestHelper.depositAndRegisterMember(accounts.broker, membersTestHelper.memberTypes.broker);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.broker, membersTestHelper.memberTypes.broker);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  function generateGoodCreateEventParams() {
    const eventDesc = 'My event';
    const eventSupportURL = testHelper.validEvidenceURL;
    const onSaleTime = timeTestHelper.now().toNumber() + (timeTestHelper.oneDay * 30); // 30 days minimum reporting period
    const offSaleTime = onSaleTime + 1; // Off sale time must be strictly after on sale time.
    const averageTicketPriceInUSCents = freeEventAverageTicketPriceInUSCents;
    const eventOwner = accounts.eventOwner;
    const eventOwnerProof = signingTestHelper.getCreateEventEventOwnerProof(eventOwner, eventDesc, eventSupportURL,
        onSaleTime, offSaleTime, freeEventAverageTicketPriceInUSCents);
    const sender = accounts.eventOwner;

    return {
      eventDesc, eventSupportURL, onSaleTime, offSaleTime, averageTicketPriceInUSCents, eventOwner, eventOwnerProof, sender
    };
  }

  async function makeEventDeposit(_averageTicketPriceInUSCents) {
    const [, eventDepositInAVT] = await eventsManager.getNewEventDeposit(_averageTicketPriceInUSCents);
    await avtTestHelper.addAVTToFund(eventDepositInAVT, accounts.eventOwner, 'deposit');
    return eventDepositInAVT;
  }

  async function createEvent(_createEventParams) {
    await eventsManager.createEvent(
        _createEventParams.eventDesc,
        _createEventParams.eventSupportURL,
        _createEventParams.onSaleTime,
        _createEventParams.offSaleTime,
        _createEventParams.averageTicketPriceInUSCents,
        _createEventParams.eventOwnerProof,
        {from: _createEventParams.sender}
    );
    const logArgs = await testHelper.getLogArgs(eventsManager.LogEventCreated);
    return logArgs.eventId;
  }

  async function endEvent(_eventId) {
    await eventsManager.endEvent(_eventId);
    return testHelper.getLogArgs(eventsManager.LogEventEnded);
  }

  async function withdrawDeposit(_deposit, _depositer) {
    return avtTestHelper.withdrawAVTFromFund(_deposit, _depositer, 'deposit');
  }

  context('getNewEventDeposit()', async () => {
    async function getNewEventDepositSucceeds(_averageTicketPriceInUSCents, _expectedDepositInUSCents) {
      const [actualDepositInUSCents, actualDepositInAVT] = await eventsManager.getNewEventDeposit(_averageTicketPriceInUSCents);
      assert.equal(actualDepositInUSCents.toString(), _expectedDepositInUSCents.toString());

      const expectedDepositInAVT = avtTestHelper.getAVTFromUSCents(_expectedDepositInUSCents);
      assert.equal(actualDepositInAVT.toString(), expectedDepositInAVT.toString());
    }

    context('all-good', async () => {
      it('for a new free event', async () => {
        const goodFreeAverageTicketPriceInUsCents = 0;
        const expectedDepositInUSCents = 1000000;  // From ParameterRegistry.
        await getNewEventDepositSucceeds(goodFreeAverageTicketPriceInUsCents, expectedDepositInUSCents);
      });

      it('for a new paid event', async () => {
        const goodNonFreeAverageTicketPriceInUSCents = 2000;
        const expectedDepositInUSCents = 2000000;  // From ParameterRegistry.
        await getNewEventDepositSucceeds(goodNonFreeAverageTicketPriceInUSCents, expectedDepositInUSCents);
      });
    });

    // NOTE: There are no bad arguments or bad states for getting a new event deposit.
  });

  context('getExistingEventDeposit()', async () => {
    let goodCreateEventParams, goodEventDeposit, goodEventId;

    beforeEach(async () => {
      goodCreateEventParams = generateGoodCreateEventParams();
      goodEventDeposit = await makeEventDeposit(goodCreateEventParams.averageTicketPriceInUSCents);
      goodEventId = await createEvent(goodCreateEventParams);
    });

    async function getExistingEventDepositSucceeds() {
      const actualDepositInAVT = await eventsManager.getExistingEventDeposit(goodEventId);
      assert.equal(actualDepositInAVT.toString(), goodEventDeposit.toString());
    }

    async function getExistingEventDepositFails(_eventId, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.getExistingEventDeposit(_eventId), _expectedError);
    }

    context('good state: event exists', async () => {
      afterEach(async () => {
        await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodCreateEventParams.eventOwner, goodEventId);
      });

      it('good parameters', async () => {
        await getExistingEventDepositSucceeds();
      });

      it('bad parameter: event id does not exist', async () => {
        await getExistingEventDepositFails(999, 'Event must exist');
      });
    });

    it('bad state: event has ended', async () => {
      await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodCreateEventParams.eventOwner, goodEventId);
      await getExistingEventDepositFails(goodEventId, 'Event must exist');
    });
  });

  context('createEvent()', async () => {
    let goodCreateEventParams, goodEventDeposit, goodEventId;

    beforeEach(async () => {
      // Set up the goodness for all tests.
      goodCreateEventParams = generateGoodCreateEventParams();
      goodEventDeposit = await makeEventDeposit(goodCreateEventParams.averageTicketPriceInUSCents);
    });

    async function createEventSucceeds() {
      await eventsManager.createEvent(
          goodCreateEventParams.eventDesc,
          goodCreateEventParams.eventSupportURL,
          goodCreateEventParams.onSaleTime,
          goodCreateEventParams.offSaleTime,
          goodCreateEventParams.averageTicketPriceInUSCents,
          goodCreateEventParams.eventOwnerProof,
          {from: goodCreateEventParams.sender}
      );
      const logArgs = await testHelper.getLogArgs(eventsManager.LogEventCreated);
      assert.equal(logArgs.eventDesc, goodCreateEventParams.eventDesc);
      assert.equal(logArgs.eventOwner, goodCreateEventParams.eventOwner);
      assert.equal(logArgs.eventSupportURL, goodCreateEventParams.eventSupportURL);
      assert.equal(logArgs.onSaleTime.toNumber(), goodCreateEventParams.onSaleTime);
      assert.equal(logArgs.offSaleTime.toNumber(), goodCreateEventParams.offSaleTime);
      assert.equal(logArgs.averageTicketPriceInUSCents.toNumber(), goodCreateEventParams.averageTicketPriceInUSCents);
      assert.equal(logArgs.depositInAVTDecimals.toNumber(), goodEventDeposit);
      goodEventId = logArgs.eventId;
    }

    async function createEventFails(_params, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.createEvent(_params.eventDesc, _params.eventSupportURL,
          _params.onSaleTime, _params.offSaleTime, _params.averageTicketPriceInUSCents, _params.eventOwnerProof,
          {from: _params.sender}), _expectedError);
    }

    context('all-good', async () => {
      afterEach(async () => {
        // Event was created: remove it and clear out the deposit.
        await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodCreateEventParams.eventOwner, goodEventId);
      });

      it('via event owner', async () => {
        await createEventSucceeds();
      });

      it('via broker', async () => {
        goodCreateEventParams.sender = accounts.broker;

        await createEventSucceeds();
      });
    });

    context('bad state, good parameters', async () => {
      it('insufficient deposit', async () => {
        await withdrawDeposit(1, goodCreateEventParams.eventOwner);
        await createEventFails(goodCreateEventParams, 'Insufficient deposits');
        // Event was NOT created: clear out the remainder of the deposit.
        await withdrawDeposit(goodEventDeposit.minus(1), goodCreateEventParams.eventOwner);
      });

      it('event already exists', async () => {
        const eventId = await createEvent(goodCreateEventParams);
        await createEventFails(goodCreateEventParams, 'Event already exists');

        await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodCreateEventParams.eventOwner, eventId);
      });
    });

    context('good state, bad parameter', async () => {
      let badParams;

      beforeEach(async () => {
        badParams = goodCreateEventParams;
        badParams.eventOwnerProof = undefined;  // Default to creating the proof.
      });

      afterEach(async () => {
        // Event was NOT created: clear out the deposit.
        await withdrawDeposit(goodEventDeposit, goodCreateEventParams.eventOwner);
      });

      async function createEventFailsWithBadParams(_errorString) {
        if (badParams.eventOwnerProof === undefined) {
          badParams.eventOwnerProof = signingTestHelper.getCreateEventEventOwnerProof(badParams.eventOwner,
              badParams.eventDesc, badParams.eventSupportURL, badParams.onSaleTime, badParams.offSaleTime,
              badParams.averageTicketPriceInUSCents);
        }
        return createEventFails(badParams, _errorString);
      }

      it('event description is empty', async () => {
        badParams.eventDesc = '';
        await createEventFailsWithBadParams('Event requires a non-empty description');
      });

      it('event support URL is empty', async () => {
        badParams.eventSupportURL = '';
        await createEventFailsWithBadParams('Event requires a non-empty support URL');
      });

      it('on sale time is in the past', async () => {
        badParams.onSaleTime = timeTestHelper.now().toNumber() - 1;
        await createEventFailsWithBadParams('Tickets on-sale time is not far enough in the future');
      });

      it('on sale time is not far enough in the future', async () => {
        badParams.onSaleTime = badParams.onSaleTime - 1;
        await createEventFailsWithBadParams('Tickets on-sale time is not far enough in the future');
      });

      it('off sale time is before on sale time', async () => {
        badParams.offSaleTime = badParams.onSaleTime - 1;
        await createEventFailsWithBadParams('Tickets on-sale time must be before off-sale time');
      });

      it('average ticket price does not match the price used to determine deposit', async () => {
        badParams.averageTicketPriceInUSCents++;
        await createEventFailsWithBadParams('Insufficient deposits');
      });

      it('event owner proof does not match data', async () => {
        badParams.eventOwnerProof = 'some old nonsense';
        await createEventFailsWithBadParams('Sender must be broker');
      });

      it('sender is not signer nor a registered broker', async () => {
        badParams.sender = accounts.notEventOwner;
        await createEventFailsWithBadParams('Sender must be broker');
      });
    });
  });

  context('endEvent()', async () => {
    let goodEventOwner, goodEventDeposit, goodEventId;

    beforeEach(async () => {
      const goodCreateEventParams = generateGoodCreateEventParams();
      goodEventOwner = goodCreateEventParams.eventOwner;
      goodEventDeposit = await makeEventDeposit(goodCreateEventParams.averageTicketPriceInUSCents);
      goodEventId = await createEvent(goodCreateEventParams);
    });

    afterEach(async () => {
      // Tests must end the event.
      await withdrawDeposit(goodEventDeposit, goodEventOwner);
    });

    async function endEventSucceeds() {
      await eventsManager.endEvent(goodEventId);
      const logArgs = await testHelper.getLogArgs(eventsManager.LogEventEnded);
      assert.equal(logArgs.eventId.toNumber(), goodEventId);
    }

    async function endEventFails(_eventId, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.endEvent(_eventId), _expectedError);
    }

    context('all-good', async () => {
      it('good state: after off-sale time', async () => {
        await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
        await endEventSucceeds();
      });
    });

    context('fails', async () => {
      it('good state, bad parameter: eventId', async () => {
        await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
        await endEventFails(badEventId, 'Event must be inactive');
        await endEvent(goodEventId);
      });

      it('bad state: before off sale time', async () => {
        await eventsTestHelper.advanceTimeToOnSaleTime(goodEventId);
        await endEventFails(goodEventId, 'Event must be inactive');
        await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
        await endEvent(goodEventId);
      });
    });
  });

  context('cancelEvent()', async () => {
    let goodEventOwner, goodSender, goodEventDeposit, goodEventId, goodCancelEventOwnerProof;
    const badSender = accounts.notEventOwner;

    beforeEach(async () => {
      const goodCreateEventParams = generateGoodCreateEventParams();
      goodEventOwner = goodCreateEventParams.eventOwner;
      goodSender = goodEventOwner;
      goodEventDeposit = await makeEventDeposit(goodCreateEventParams.averageTicketPriceInUSCents);
      goodEventId = await createEvent(goodCreateEventParams);
      goodCancelEventOwnerProof = signingTestHelper.getCancelEventEventOwnerProof(goodEventOwner, goodEventId);
    });

    afterEach(async () => {
      // Tests must end the event.
      await avtTestHelper.withdrawAVTFromFund(goodEventDeposit, goodEventOwner, 'deposit');
    });

    async function cancelEventSucceeds() {
      await eventsManager.cancelEvent(goodEventId, goodCancelEventOwnerProof, {from: goodSender});
      const logArgs = await testHelper.getLogArgs(eventsManager.LogEventCancelled);
      assert.equal(logArgs.eventId.toNumber(), goodEventId);
    }

    async function cancelEventFails(_eventId, _eventOwnerProof, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.cancelEvent(_eventId, _eventOwnerProof, {from: _sender}),
          _expectedError);
    }

    context('all-good', async () => {
      it('good state: event is before on-sale time', async () => {
        await cancelEventSucceeds();
      });
    });

    context('fails', async () => {
      afterEach(async () => {
        await eventsTestHelper.advanceTimeToOffSaleTime(goodEventId);
        await endEvent(goodEventId);
      });

      it('bad state: event is trading', async () => {
        await eventsTestHelper.advanceTimeToOnSaleTime(goodEventId);
        await cancelEventFails(goodEventId, goodCancelEventOwnerProof, goodSender, 'Event must be in reporting period');
      });

      context('bad parameter', async () => {
        it('event does not exist', async () => {
          // Update the proof otherwise we'd have two bad parameters.
          goodCancelEventOwnerProof = signingTestHelper.getCancelEventEventOwnerProof(goodEventOwner, badEventId);
          await cancelEventFails(badEventId, goodCancelEventOwnerProof, goodSender, 'Event must be in reporting period');
        });

        it('event owner proof is not provided', async () => {
          const badEventOwnerProof = 'some nonsense';
          await cancelEventFails(goodEventId, badEventOwnerProof, goodSender, 'Proof must be valid and signed by event owner');
        });

        it('sender is not event owner or a registered broker', async () => {
          await cancelEventFails(goodEventId, goodCancelEventOwnerProof, badSender,
              'Sender must be registered broker on this event');
        });
      });
    });
  });
});