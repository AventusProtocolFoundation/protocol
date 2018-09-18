const EventsManager = artifacts.require("EventsManager");
const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const membersTestHelper = require("./helpers/membersTestHelper");
const web3Utils = require('web3-utils');

// For unsigned transactions, only the event owner or a delegate can be the msg.sender.
// For signed transactions, anyone can be the msg.sender IFF they have registered as a broker.
// Therefore, we need two addresses for all transactions that:
//   - create an event: a sender and an owner
//   - affect an event: a sender and an agent
// These two address may be the same (for unsigned transcations) or different (for signed transactions.)
contract('EventsManager - event management', async () => {
  let eventsManager, aventusStorage;

  const brokerAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primaryDelegate = testHelper.getAccount(2);
  const secondaryDelegate = testHelper.getAccount(3);
  const buyer = testHelper.getAccount(4);
  const emptyOptionalData = "0x";

  before(async () => {
    await testHelper.before();
    await eventsTestHelper.before(testHelper, brokerAddress, eventOwner);
    await membersTestHelper.before(testHelper);

    eventsManager = await EventsManager.deployed();
    aventusStorage = testHelper.getStorage();
  });

  after(async () => await testHelper.checkFundsEmpty());

  context("Event deposits", async () => {
    const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
    const to18SigFig = (new web3.BigNumber(10)).pow(18);

    // Use BigNumber for the deposits so we don't lose accuracy.
    async function getAndCheckEventDeposit(_eventCapacity, _price, _startTime, _expectedUSCentsDepositBN) {
      const deposits = await eventsManager.getNewEventDeposit(_price);
      const depositInUSCentsBN = deposits[0];
      assert.equal(_expectedUSCentsDepositBN.toString(), depositInUSCentsBN.toString());
      const oneAvtInUSCentsBN = await aventusStorage.getUInt(web3Utils.soliditySha3("OneAVTInUSCents"));
      const depositInAVTBN = deposits[1];
      assert.equal(
        depositInAVTBN.toString(),
        depositInUSCentsBN.mul(to18SigFig).dividedToIntegerBy(oneAvtInUSCentsBN).toString());
    };

    it("gets the same deposit regardless of non-zero ticket price, eventCapacity or startTime", async () => {
      const expectedUSCentsDepositBN = await aventusStorage.getUInt(
          web3Utils.soliditySha3("Events", "fixedDepositAmountUSCents"));
      for (i = 1000; i != 10000; i += 1000) {
        // Create some varied values for the deposit paramaters. Shouldn't make a difference.
        const eventCapacity = 1000 + i * 10;
        const price = i;
        const startTime = testHelper.now() + (i * oneDay);
        await getAndCheckEventDeposit(eventCapacity, price, startTime, expectedUSCentsDepositBN);
      }
    });

    it("gets the same deposit regardless of eventCapacity or startTime if event is free", async () => {
      const price = 0;
      const expectedUSCentsDepositBN = await aventusStorage.getUInt(
          web3Utils.soliditySha3("Events", "minimumDepositAmountUSCents"));
      for (i = 1000; i != 10000; i += 1000) {
        // Create some varied values for the deposit paramaters. Shouldn't make a difference.
        const eventCapacity = 1000 + i * 10;
        const startTime = testHelper.now() + (i * oneDay);
        await getAndCheckEventDeposit(eventCapacity, price, startTime, expectedUSCentsDepositBN);
      }
    });
  });

  const signedEvent = [false, true];

  for (let i = 0; i < signedEvent.length; ++i) {
    const useSignedCreateEvent = signedEvent[i];
    const eventPreTitle = (useSignedCreateEvent ? "Signed" : "Unsigned") + " event ";

    context(eventPreTitle, async () => {
      async function createEventFails(_eventTime, _ticketSaleStartTime, _eventSupportURL) {
        await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(useSignedCreateEvent, _eventTime, _ticketSaleStartTime, _eventSupportURL))
      }

      async function createEventFailsDueToPreconditions() {
        // Pass in valid values.
        await createEventFails(
          eventsTestHelper.getEventTime(),
          eventsTestHelper.getTicketSaleStartTime(),
          eventsTestHelper.getEventSupportURL());
      }

      if (useSignedCreateEvent) {

        it(eventPreTitle + "creation fails unless sending address is a broker", async () => {
          eventsTestHelper.setupUniqueEventParameters();
          await eventsTestHelper.makeEventDeposit();
          await createEventFailsDueToPreconditions();
          await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL, "Registering broker");
          await eventsTestHelper.createValidEvent(useSignedCreateEvent);
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
          await eventsTestHelper.endEventAndWithdrawDeposit();
        });

      }

      // TODO: Consider moving these out of the for loop - they don't depend on whether the creation comes from a broker or not.
      context(eventPreTitle + (useSignedCreateEvent ? "with broker address" : ""), async () => {
        if (useSignedCreateEvent) {
          beforeEach(async () => {
            await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL,
                "Registering broker");
          });

          afterEach(async () => {
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
          });
        }

        async function makeEventDepositAndCreateFailingEvent(_eventTime, _ticketSaleStartTime, _eventSupportURL) {
          await eventsTestHelper.makeEventDeposit();
          await eventsTestHelper.doCreateEvent(useSignedCreateEvent, _eventTime, _ticketSaleStartTime, _eventSupportURL);
        }

        context(eventPreTitle + "create and end", async () => {
          context("create succeeds", async () => {
            async function endEventFails() {
              await testHelper.expectRevert(() => eventsManager.unlockEventDeposit(
                eventsTestHelper.getValidEventId()));
            }

            beforeEach(async () => {
              await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
            });

            it("end succeeds", async () => {
              await eventsTestHelper.endEventAndWithdrawDeposit();
            });

            it("cannot recreate the same event", async () => {
              const createdEventTime = eventsTestHelper.getEventTime();
              const createdTicketSaleStartTime = eventsTestHelper.getTicketSaleStartTime();
              const createdSupportingUrl = eventsTestHelper.getEventSupportURL();
              await eventsTestHelper.endEventAndWithdrawDeposit();
              await eventsTestHelper.makeEventDeposit();
              await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(useSignedCreateEvent, createdEventTime, createdTicketSaleStartTime, createdSupportingUrl));
              await eventsTestHelper.withdrawEventDeposit();
            });

            context("end fails", async () => {
              it("cannot end event twice", async () => {
                await eventsTestHelper.endEventAndWithdrawDeposit();
                await endEventFails();
              });

              it("cannot withdraw event deposit or end an event if the event eventTime isn't passed", async () => {
                await endEventFails();
                await testHelper.expectRevert(() => eventsTestHelper.withdrawEventDeposit());

                await eventsTestHelper.endEventAndWithdrawDeposit();
              });
            });
          });

          context("create fails", async () => {

            let goodEventTime, goodTicketSaleTime, goodSupportingUrl;

            beforeEach(async () => {
              eventsTestHelper.setupUniqueEventParameters(); // Set up the event parameters that are always good.
              await eventsTestHelper.makeEventDeposit();
              goodEventTime = eventsTestHelper.getEventTime();
              goodTicketSaleTime = eventsTestHelper.getTicketSaleStartTime();
              goodSupportingUrl = eventsTestHelper.getEventSupportURL();
            });

            it("if ticketSaleStartTime is too soon", async () => {
              let badTicketSaleStartTime = eventsTestHelper.getTicketSaleStartTime().minus(1);
              await createEventFails(goodEventTime, badTicketSaleStartTime, goodSupportingUrl);
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if eventTime is before ticketSaleStartTime", async () => {
              let badEventTime = eventsTestHelper.getTicketSaleStartTime().minus(1);
              await createEventFails(badEventTime, goodTicketSaleTime, eventsTestHelper.getEventSupportURL());
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if event supportingURL is not provided", async () => {
              let badEventSupportURL = "";
              await createEventFails(eventsTestHelper.getEventTime(), eventsTestHelper.getTicketSaleStartTime(), badEventSupportURL);
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if not enough deposit was made", async () => {
              await eventsTestHelper.withdrawDeposit(1, eventOwner);
              await createEventFailsDueToPreconditions();
              await eventsTestHelper.withdrawDeposit(eventsTestHelper.getEventDeposit().minus(1), eventOwner);
            });
          });
        });

        context(eventPreTitle + "Delegates management", async () => {
          let eventId;
          beforeEach(async () => {
            await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
            eventId = eventsTestHelper.getValidEventId();
          });

          afterEach(async () => {
            await eventsTestHelper.endEventAndWithdrawDeposit();
          });

          async function registerPrimaryDelegateSucceeds() {
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate, {from: eventOwner});
          }

          async function registerPrimaryDelegateFails(_address) {
            await testHelper.expectRevert(() => eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate, {from: _address}));
          }

          async function deregisterPrimaryDelegateSucceeds() {
            await eventsManager.deregisterRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate, {from: eventOwner});
          }

          async function registerUnknownRoleFails(_address) {
            await testHelper.expectRevert(() => eventsManager.registerRole(eventId, "unknownMemberType", _address, {from: eventOwner}));
          }

          it("can register/deregister a primary delegate for an event", async () => {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType, testHelper.evidenceURL, "Registering primary delegate");

            let registered = await eventsManager.roleIsRegistered(eventId, testHelper.primaryDelegateMemberType, primaryDelegate);
            assert.ok(!registered);

            await registerPrimaryDelegateSucceeds();
            registered = await eventsManager.roleIsRegistered(eventId, testHelper.primaryDelegateMemberType, primaryDelegate);
            assert.ok(registered);

            await deregisterPrimaryDelegateSucceeds()
            registered = await eventsManager.roleIsRegistered(eventId, testHelper.primaryDelegateMemberType, primaryDelegate);
            assert.ok(!registered);

            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
          });

          it("can register/deregister a secondary delegate for an event", async () => {
            await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType, testHelper.evidenceURL, "Registering secondary delegate");

            let registered = await eventsManager.roleIsRegistered(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate);
            assert.ok(!registered);

            await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate, {from: eventOwner});
            registered = await eventsManager.roleIsRegistered(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate);
            assert.ok(registered);

            await eventsManager.deregisterRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate, {from: eventOwner});
            registered = await eventsManager.roleIsRegistered(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate);
            assert.ok(!registered);

            await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateMemberType);
          });

          it("cannot register a delegate for an event if they are not registered as a member", async () => {
            await registerPrimaryDelegateFails(eventOwner);
          });

          it ("can deregister a delegate for an event if they are not registered", async () => {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType, testHelper.evidenceURL, "Registering primary delegate");
            await deregisterPrimaryDelegateSucceeds()
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
          });

          it("cannot register/deregister a delegate for an event if not the owner", async () => {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType, testHelper.evidenceURL, "Registering primary delegate");
            await registerPrimaryDelegateFails(primaryDelegate);
            await registerPrimaryDelegateSucceeds();
            await testHelper.expectRevert(() => eventsManager.deregisterRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate, {from: primaryDelegate}));
            await deregisterPrimaryDelegateSucceeds()
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
          });

          it("cannot register a delegate with an unknown role", async () => {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType, testHelper.evidenceURL, "Registering primary delegate");
            await registerUnknownRoleFails(primaryDelegate);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
          });
        });

        context(eventPreTitle + "cancellation", async () => {
          let eventId;

          beforeEach(async () => {
            await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
            eventId = eventsTestHelper.getValidEventId();
            eventDeposit = eventsTestHelper.getEventDeposit();

            if (useSignedCreateEvent) {
              await eventsManager.registerRole(eventId, testHelper.brokerMemberType, brokerAddress, {from: eventOwner});
            };
          });

          async function doCancelEvent(_eventId, _canceller) {
            if (useSignedCreateEvent) {
              await doSignedCancelEvent(_eventId, _canceller, brokerAddress);
            } else {
              await eventsManager.cancelEvent(_eventId, '0x', {from: _canceller});
            }
          }

          async function doSignedCancelEvent(_eventId, _canceller, _sender) {
            let keccak256Msg = await web3Utils.soliditySha3(_eventId);
            let signedMessage = testHelper.createSignedMessage(_canceller, keccak256Msg);
            await eventsManager.cancelEvent(_eventId, signedMessage, {from: _sender});
          }

          async function cancelEventSucceeds() {
            await doCancelEvent(eventId, eventOwner);
            const eventArgs = await testHelper.getEventArgs(eventsManager.LogEventCancelled);
            assert.equal(eventArgs.eventId.toNumber(), eventId);
          }

          async function cancelEventFails(_eventId, _canceller) {
            const canceller = _canceller || eventOwner;
            await testHelper.expectRevert(() => doCancelEvent(_eventId, canceller));
          }

          context("succeeds", async () => {
            afterEach(async () => {
              await eventsTestHelper.withdrawDeposit(eventDeposit, eventOwner);
            });

            it("within the reporting period", async () => {
              await cancelEventSucceeds();
            });

            it("within the ticket sale period", async () => {
              await testHelper.advanceTimeToEventTicketSaleStart(eventId);
              await cancelEventSucceeds();
            });

            it("but only once", async () => {
              await cancelEventSucceeds();
              await cancelEventFails(eventId);
            });

            it("if all tickets have been refunded", async () => {
              await testHelper.advanceTimeToEventTicketSaleStart(eventId);
              const vendorTicketRefHash = web3Utils.soliditySha3("UniqueVendorTicketRef");
              const ticketId = await eventsTestHelper.sellTicketSucceeds(eventId, vendorTicketRefHash, "some metadata", buyer,
              emptyOptionalData, emptyOptionalData, eventOwner);
              await eventsTestHelper.refundTicketSucceeds(eventId, ticketId, eventOwner, emptyOptionalData);
              await cancelEventSucceeds(eventId);
            });
          });

          context("fails", async () => {
            afterEach(async () => {
              await eventsTestHelper.endEventAndWithdrawDeposit();
            });

            it("if event doesn't exist", async () => {
              await cancelEventFails(999);
            });

            it("if the event has ended", async () => {
              await testHelper.advanceTimeToEventEnd(eventId);
              await cancelEventFails(eventId);
            });

            it("if not the owner", async () => {
              await cancelEventFails(eventId, secondaryDelegate);
            });

            it("if done by a primary delegate", async function () {
              await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType, testHelper.evidenceURL, "Registering primary delegate");
              await cancelEventFails(eventId, primaryDelegate); // when not primary delegate
              await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate, {from: eventOwner});
              await cancelEventFails(eventId, primaryDelegate); // when primary delegate
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
            });

            it("if done by a secondary delegate", async function () {
              await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType, testHelper.evidenceURL, "Registering secondary delegate");
              await cancelEventFails(eventId, secondaryDelegate); // when not secondary delegate
              await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate, {from: eventOwner});
              await cancelEventFails(eventId, secondaryDelegate); // when secondary delegate
              await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateMemberType);
            });

            it("if tickets have been sold", async () => {
              await testHelper.advanceTimeToEventTicketSaleStart(eventId);
              const vendorTicketRefHash = web3Utils.soliditySha3("UniqueVendorTicketRef");
              await eventsTestHelper.sellTicketSucceeds(eventId, vendorTicketRefHash, "some metadata", buyer, emptyOptionalData, emptyOptionalData, eventOwner);
              await cancelEventFails(eventId);
            });

            if (useSignedCreateEvent) {
              context("when signed", async () => {
                it("but sending address is not registered as a broker", async () => {
                  await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                  await cancelEventFails(eventId);
                  await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL, "Registering broker");
                });

                it("but owner is sending address", async () => {
                  await testHelper.expectRevert(() => doSignedCancelEvent(eventId, eventOwner, eventOwner));
                });
              });
            }
          });
        })
      });
    });
  }
});
