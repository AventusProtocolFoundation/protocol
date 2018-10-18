const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const membersTestHelper = require("./helpers/membersTestHelper");

contract('EventsManager - event management', async () => {
  testHelper.profilingHelper.addTimeReports('EventsManager - event management');

  let eventsManager;

  const brokerAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primary = testHelper.getAccount(2);
  const secondary = testHelper.getAccount(3);
  const buyer = testHelper.getAccount(4);
  const someOtherAddress = testHelper.getAccount(5);
  const emptyOwnerProof = "0x";

  before(async () => {
    await testHelper.before();
    await eventsTestHelper.before(testHelper, brokerAddress, eventOwner);
    await membersTestHelper.before(testHelper);

    eventsManager = eventsTestHelper.getEventsManager();
  });

  after(async () => await testHelper.checkFundsEmpty());

  context("Event deposits", async () => {
    const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
    const to18SigFig = (new web3.BigNumber(10)).pow(18);

    // Use BigNumber for the deposits so we don't lose accuracy.
    async function getAndCheckEventDeposit(_price, _startTime, _expectedUSCentsDepositBN) {
      const deposits = await eventsManager.getNewEventDeposit(_price);
      const depositInUSCentsBN = deposits[0];
      assert.equal(_expectedUSCentsDepositBN.toString(), depositInUSCentsBN.toString());
      const oneAvtInUSCentsBN = await testHelper.getOneAVTUSCents();
      const depositInAVTBN = deposits[1];
      assert.equal(
        depositInAVTBN.toString(),
        depositInUSCentsBN.mul(to18SigFig).dividedToIntegerBy(oneAvtInUSCentsBN).toString());
    }

    it("gets the same deposit regardless of the parameters", async () => {
      const expectedUSCentsDepositBN = await testHelper.getPaidEventDepositUSCents();
      for (let i = 1000; i != 10000; i += 1000) {
        // Create some varied values for the deposit paramaters. Shouldn't make a difference.
        const price = i;
        const startTime = testHelper.now() + (i * oneDay);
        await getAndCheckEventDeposit(price, startTime, expectedUSCentsDepositBN);
      }
    });

    it("gets the same deposit regardless of startTime if event is free", async () => {
      const price = 0;
      const expectedUSCentsDepositBN = await testHelper.getFreeEventDepositUSCents();
      for (let i = 1000; i != 10000; i += 1000) {
        // Create some varied values for the deposit paramaters. Shouldn't make a difference.
        const startTime = testHelper.now() + (i * oneDay);
        await getAndCheckEventDeposit(price, startTime, expectedUSCentsDepositBN);
      }
    });
  });

  const viaBroker = [false, true];

  for (let i = 0; i < viaBroker.length; ++i) {
    const isViaBroker = viaBroker[i];
    const eventPreTitle = (isViaBroker ? "via broker" : "direct") + " event ";

    context(eventPreTitle, async () => {
      async function createEventFails(_offSaleTime, _onSaleTime, _eventSupportURL) {
        await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(isViaBroker, _offSaleTime, _onSaleTime,
            _eventSupportURL));
      }

      async function createEventFailsDueToPreconditions() {
        // Pass in valid values.
        await createEventFails(
          eventsTestHelper.getOffSaleTime(),
          eventsTestHelper.getOnSaleTime(),
          eventsTestHelper.getEventSupportURL());
      }

      if (isViaBroker) {

        it(eventPreTitle + "creation fails unless sending address is a broker", async () => {
          eventsTestHelper.setupUniqueEventParameters();
          let testEventDeposit = await eventsTestHelper.makeEventDeposit();
          await createEventFailsDueToPreconditions();
          await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL,
              "Registering broker");
          let testEventId = await eventsTestHelper.createValidEvent(isViaBroker);
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
          await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(testEventId, testEventDeposit);
        });

      }

      // TODO: Consider moving these out of the for loop - they don't depend on whether the creation comes from a broker or not.
      context(eventPreTitle + (isViaBroker ? "with broker address" : ""), async () => {
        if (isViaBroker) {
          beforeEach(async () => {
            await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL,
                "Registering broker");
          });

          afterEach(async () => {
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
          });
        }

        context(eventPreTitle + "create and end", async () => {
          context("create succeeds", async () => {
            async function endEventFails(eventId) {
              await testHelper.expectRevert(() => eventsManager.endEvent(eventId));
            }

            let goodEvent;

            beforeEach(async () => {
              goodEvent = await eventsTestHelper.makeEventDepositAndCreateValidEvent(isViaBroker);
            });

            it("end succeeds", async () => {
              await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
            });

            it("cannot recreate the same event", async () => {
              const createdOffSaleTime = eventsTestHelper.getOffSaleTime();
              const createdOnSaleTime = eventsTestHelper.getOnSaleTime();
              const createdSupportingUrl = eventsTestHelper.getEventSupportURL();
              let testEventDeposit = await eventsTestHelper.makeEventDeposit();
              await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(isViaBroker, createdOffSaleTime,
                  createdOnSaleTime, createdSupportingUrl));
              await eventsTestHelper.withdrawEventDeposit(testEventDeposit);
              await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
            });

            it("can recreate the same event if marked as fraudulent", async () => {
              const createdOffSaleTime = eventsTestHelper.getOffSaleTime();
              const createdOnSaleTime = eventsTestHelper.getOnSaleTime();
              const createdSupportingUrl = eventsTestHelper.getEventSupportURL();
              await eventsTestHelper.challengeEventAndMarkAsFraudulent(goodEvent.id, buyer,
                someOtherAddress, secondary);

              let testEventDeposit = await eventsTestHelper.makeEventDeposit();
              await eventsTestHelper.doCreateEvent(isViaBroker, createdOffSaleTime, createdOnSaleTime, createdSupportingUrl);
              const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
              const newEventId = eventArgs.eventId.toNumber();
              assert.notEqual(newEventId, goodEvent.id);

              await testHelper.advanceTimeToEventEnd(newEventId);
              await eventsManager.endEvent(newEventId);
              await eventsTestHelper.withdrawEventDeposit(testEventDeposit);
            });

            context("end fails", async () => {
              it("cannot end event twice", async () => {
                await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
                await endEventFails(goodEvent.id);
              });

              it("cannot withdraw event deposit or end an event if the event offSaleTime isn't passed", async () => {
                await endEventFails(goodEvent.id);
                await testHelper.expectRevert(() => eventsTestHelper.withdrawEventDeposit(goodEvent.deposit));

                await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
              });
            });
          });

          context("create fails", async () => {

            let goodEventDeposit, goodOffSaleTime, goodOnSaleTime, goodSupportingUrl;

            beforeEach(async () => {
              eventsTestHelper.setupUniqueEventParameters(); // Set up the event parameters that are always good.
              goodEventDeposit = await eventsTestHelper.makeEventDeposit();
              goodOffSaleTime = eventsTestHelper.getOffSaleTime();
              goodOnSaleTime = eventsTestHelper.getOnSaleTime();
              goodSupportingUrl = eventsTestHelper.getEventSupportURL();
            });

            it("if onSaleTime is too soon", async () => {
              let badOnSaleTime = testHelper.now().plus(1 * testHelper.oneDay);
              await createEventFails(goodOffSaleTime, badOnSaleTime, goodSupportingUrl);
              await eventsTestHelper.withdrawEventDeposit(goodEventDeposit);
            });

            it("if offSaleTime is before onSaleTime", async () => {
              let badOffSaleTime = goodOnSaleTime.minus(1);
              await createEventFails(badOffSaleTime, goodOnSaleTime, eventsTestHelper.getEventSupportURL());
              await eventsTestHelper.withdrawEventDeposit(goodEventDeposit);
            });

            it("if event supportingURL is not provided", async () => {
              let badEventSupportURL = "";
              await createEventFails(eventsTestHelper.getOffSaleTime(), goodOnSaleTime, badEventSupportURL);
              await eventsTestHelper.withdrawEventDeposit(goodEventDeposit);
            });

            it("if not enough deposit was made", async () => {
              await eventsTestHelper.withdrawDeposit(1, eventOwner);
              await createEventFailsDueToPreconditions();
              await eventsTestHelper.withdrawDeposit(goodEventDeposit.minus(1), eventOwner);
            });

            it("if event already exists", async () => {
              let testEventId = await eventsTestHelper.createValidEvent(isViaBroker);
              await createEventFails(goodOffSaleTime, goodOnSaleTime, goodSupportingUrl);
              await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(testEventId, goodEventDeposit);
            });

          });
        });

        context(eventPreTitle + "Members management", async () => {
          let goodEvent;
          beforeEach(async () => {
            goodEvent = await eventsTestHelper.makeEventDepositAndCreateValidEvent(isViaBroker);
          });

          afterEach(async () => {
            await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
          });

          //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
          async function registerMemberOnEventSucceeds(_memberType, _memberAddress) {
            await eventsManager.registerMemberOnEvent(goodEvent.id, _memberAddress, _memberType, {from: eventOwner});
            let eventArgs = await testHelper.getEventArgs(eventsManager.LogMemberRegisteredOnEvent);
            assert.equal(eventArgs.eventId, goodEvent.id);
            assert.equal(eventArgs.memberType, _memberType);
            assert.equal(eventArgs.memberAddress, _memberAddress);
          }

          //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
          async function registerMemberOnEventFails(_memberType, _memberAddress, _senderAddress) {
             await testHelper.expectRevert(() => eventsManager.registerMemberOnEvent(goodEvent.id, _memberAddress, _memberType,
                {from: _senderAddress}));
          }

          //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
          async function deregisterMemberFromEventSucceeds(_memberType, _memberAddress) {
            await eventsManager.deregisterMemberFromEvent(goodEvent.id, _memberAddress, _memberType, {from: eventOwner});
            let eventArgs = await testHelper.getEventArgs(eventsManager.LogMemberDeregisteredFromEvent);
            assert.equal(eventArgs.eventId, goodEvent.id);
            assert.equal(eventArgs.memberType, _memberType);
            assert.equal(eventArgs.memberAddress, _memberAddress);
          }

          //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
          async function registerUnknownMemberTypeFails(_address) {
            await testHelper.expectRevert(() => eventsManager.registerMemberOnEvent(goodEvent.id, _address, "unknownMemberType",
                {from: eventOwner}));
          }

          it("can register/deregister a primary for an event", async () => {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType, testHelper.evidenceURL,
                "Registering primary");
            await registerMemberOnEventSucceeds(testHelper.primaryMemberType, primary);
            await deregisterMemberFromEventSucceeds(testHelper.primaryMemberType, primary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
          });

          it("can register/deregister a secondary for an event", async () => {
            await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType, testHelper.evidenceURL,
                "Registering secondary");

            await registerMemberOnEventSucceeds(testHelper.secondaryMemberType, secondary);
            await deregisterMemberFromEventSucceeds(testHelper.secondaryMemberType, secondary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary, testHelper.secondaryMemberType);
          });

          it("cannot register a primary for an event if they are not registered as a member", async () => {
            await registerMemberOnEventFails(testHelper.primaryMemberType, primary, eventOwner);
          });

          it ("can deregister a primary for an event if they are not registered", async () => {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType, testHelper.evidenceURL,
                "Registering primary");
            await eventsManager.deregisterMemberFromEvent(goodEvent.id, primary, testHelper.primaryMemberType,
                {from: eventOwner});
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
          });

          it("cannot register/deregister a primary for an event if not the owner", async () => {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType, testHelper.evidenceURL,
                "Registering primary");
            await registerMemberOnEventFails(testHelper.primaryMemberType, primary, primary);
            await registerMemberOnEventSucceeds(testHelper.primaryMemberType, primary);
            await testHelper.expectRevert(() => eventsManager.deregisterMemberFromEvent(goodEvent.id, primary,
                testHelper.primaryMemberType, {from: primary}));
            await deregisterMemberFromEventSucceeds(testHelper.primaryMemberType, primary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
          });

          it("cannot register a member with an unknown member type", async () => {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType, testHelper.evidenceURL,
                "Registering primary");
            await registerUnknownMemberTypeFails(primary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
          });
        });

        context(eventPreTitle + "cancellation", async () => {
          let goodEvent, validOwnerProof;

          beforeEach(async () => {
            goodEvent = await eventsTestHelper.makeEventDepositAndCreateValidEvent(isViaBroker);
            validOwnerProof = await eventsTestHelper.generateOwnerProof(goodEvent.id, eventOwner);

            if (isViaBroker) {
              await eventsManager.registerMemberOnEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                  {from: eventOwner});
            }
          });

          //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
          async function cancelEventSucceeds(_canceller) {
            await doCancelEvent(goodEvent.id, validOwnerProof, _canceller);
            const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCancelled);
            assert.equal(eventArgs.eventId.toNumber(), goodEvent.id);
          }

          async function doCancelEvent(_eventId, _ownerProof, _canceller) {
            const canceller = _canceller || (isViaBroker ? brokerAddress : eventOwner);
            await eventsManager.cancelEvent(_eventId, _ownerProof, {from: canceller});
          }

          async function cancelEventFails(_eventId, _ownerProof, _canceller) {
            await testHelper.expectRevert(() => doCancelEvent(_eventId, _ownerProof, _canceller));
          }

          context("succeeds", async () => {
            afterEach(async () => {
              await eventsTestHelper.withdrawDeposit(goodEvent.deposit, eventOwner);
            });

            it("within the reporting period, once only", async () => {
              await cancelEventSucceeds();
              await cancelEventFails(goodEvent.id, validOwnerProof);
            });

            it("if sender is a registered primary on the event", async function () {
              await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType, testHelper.evidenceURL,
                  "Registering primary");
              await cancelEventFails(goodEvent.id, validOwnerProof, primary);
              await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType, {from: eventOwner});
              await cancelEventSucceeds(primary);
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
            });

            it("if sender is a registered secondary on the event", async function () {
              await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
                  testHelper.evidenceURL, "Registering secondary");
              await cancelEventFails(goodEvent.id, validOwnerProof, secondary);
              await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                  {from: eventOwner});
              await cancelEventSucceeds(secondary);
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary, testHelper.secondaryMemberType);
            });

            it("and we can create the same event again", async function () {
              const createdOffSaleTime = eventsTestHelper.getOffSaleTime();
              const createdOnSaleTime = eventsTestHelper.getOnSaleTime();
              const createdSupportingUrl = eventsTestHelper.getEventSupportURL();

              if (isViaBroker) {
                await eventsManager.registerMemberOnEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                    {from: eventOwner});
              }
              await cancelEventSucceeds();
              await eventsTestHelper.doCreateEvent(isViaBroker, createdOffSaleTime, createdOnSaleTime, createdSupportingUrl);
              const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCreated);
              const newEventId = eventArgs.eventId.toNumber();

              await testHelper.advanceTimeToEventEnd(newEventId);
              await eventsManager.endEvent(newEventId);
            });
          });

          context("fails", async () => {
            afterEach(async () => {
              await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(goodEvent.id, goodEvent.deposit);
            });

            it("if event doesn't exist", async () => {
              await cancelEventFails(999, validOwnerProof);
            });

            it("if the event has ended", async () => {
              await testHelper.advanceTimeToEventEnd(goodEvent.id);
              await cancelEventFails(goodEvent.id, validOwnerProof);
            });

            it("if owner proof is invalid", async () => {
              let invalidOwnerProof = await eventsTestHelper.generateOwnerProof(goodEvent.id, someOtherAddress);
              await cancelEventFails(goodEvent.id, invalidOwnerProof);
            });

            it("if owner proof is empty", async () => {
              await cancelEventFails(goodEvent.id, emptyOwnerProof);
            });

            if (isViaBroker) {
              it("when via broker but sender is not registered as a broker", async () => {
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                await cancelEventFails(goodEvent.id, validOwnerProof);
                await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType,
                    testHelper.evidenceURL, "Registering broker");
              });
            } else {
              it("if sender is not registered in any capacity", async () => {
                await cancelEventFails(goodEvent.id, validOwnerProof, someOtherAddress);
              });
            }

            it("if within the ticket sale period", async () => {
              await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
              await cancelEventFails(goodEvent.id, validOwnerProof);
            });
          });
        });
      });
    });
  }
});