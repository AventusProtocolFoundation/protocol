const EventsManager = artifacts.require("EventsManager");
const AventusStorage = artifacts.require("AventusStorage");
const IERC20 = artifacts.require("IERC20");
const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const web3Utils = require('web3-utils');

// For unsigned transactions, only the event owner or a delegate can be the msg.sender.
// For signed transactions, anyone can be the msg.sender IFF they have registered as a broker.
// Therefore, we need two addresses for all transactions that:
//   - create an event: a sender and an owner
//   - affect an event: a sender and an agent
// These two address may be the same (for unsigned transcations) or different (for signed transactions.)
contract('EventsManager - transactions', async () => {
  let eventsManager;

  let eventId, eventDeposit;

  const brokerAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primaryDelegate = testHelper.getAccount(2);
  const secondaryDelegate = testHelper.getAccount(3);
  const buyer1 = testHelper.getAccount(4);
  const buyer2 = testHelper.getAccount(5);
  const newBuyer1 = testHelper.getAccount(6);

  const ticketDetailsBase = "Unallocated seating. Ticket number: ";
  let ticketCount = 1;

  before(async () => {
    await eventsTestHelper.before(brokerAddress, eventOwner);

    eventsManager = eventsTestHelper.getEventsManager();
  });

  after(async () => await testHelper.checkFundsEmpty());

  function setupUniqueTicketParameters() {
    // Make each call give us unique ticket details so we don't sell the same
    // ticket twice in a test.
    return ticketDetailsBase + ticketCount++;
  }

  // Just test with the unsigned version of createEvent(), so long as there is no difference between
  // an event that is created with signedCreateEvent().
  const useSignedCreateEvent = false;
  const signedTransaction = [false, true];
  let ticketId;

  for (let j = 0; j < signedTransaction.length; ++j) {
    const transactionIsSigned = signedTransaction[j];
    const transactionPreTitle = (transactionIsSigned ? "signed " : "unsigned ");

    context(transactionPreTitle + "transactions", async () => {

      beforeEach(async () => {
        if (transactionIsSigned) {
          await eventsTestHelper.depositAndRegisterAventity(brokerAddress, testHelper.brokerAventityType, testHelper.evidenceURL, "Registering broker");
        };
        await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
        eventId = eventsTestHelper.getValidEventId();
        eventDeposit = eventsTestHelper.getEventDeposit();
      });

      if (transactionIsSigned) {
        afterEach(async () => {
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(brokerAddress, testHelper.brokerAventityType);
        });
      }

      async function doCancelEvent(_eventId, _canceller) {
        if (transactionIsSigned) {
          await doSignedCancelEvent(_eventId, _canceller, brokerAddress);
        } else {
          await eventsManager.cancelEvent(_eventId, {from: _canceller});
        }
      }

      async function doSignedCancelEvent(_eventId, _canceller, _sender) {
        let keccak256Msg = await web3Utils.soliditySha3(_eventId);
        let signedMessage = testHelper.createSignedMessage(_canceller, keccak256Msg);
        await eventsManager.signedCancelEvent(signedMessage, _eventId, {from: _sender});
      }

      async function cancelEventSucceeds() {
        await doCancelEvent(eventId, eventOwner);
        const eventArgs = await testHelper.getEventArgs(transactionIsSigned
           ? eventsManager.LogSignedEventCancellation
           : eventsManager.LogEventCancellation);
        assert.equal(eventArgs.eventId.toNumber(), eventId);
      }

      async function doSellTicket(_eventId, _ticketDetails, _buyer, _seller) {
        const seller = _seller || eventOwner;
        if (transactionIsSigned) {
          await doSignedSellTicket(_eventId, _ticketDetails, _buyer, seller, brokerAddress);
        } else {
          await eventsManager.sellTicket(_eventId, _ticketDetails, _buyer, {from: seller});
        }
      }

      async function doSignedSellTicket(_eventId, _ticketDetails, _buyer, _seller, _sender) {
        let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketDetails, _buyer);
        let signedMessage = testHelper.createSignedMessage(_seller, keccak256Msg);
        await eventsManager.signedSellTicket(signedMessage, _eventId, _ticketDetails, _buyer, {from: _sender});
      }

      async function sellTicketSucceeds(_eventId, _buyer) {
        let buyer = _buyer || buyer1;
        await doSellTicket(_eventId, setupUniqueTicketParameters(), buyer);
        const eventArgs = await testHelper.getEventArgs(transactionIsSigned
          ? eventsManager.LogSignedTicketSale
          : eventsManager.LogTicketSale);
        ticketId = eventArgs.ticketId.toNumber();
        assert.equal(eventArgs.buyer, buyer);
      }

      async function doRefundTicket(_eventId, _ticketId, _refunder) {
        const refunder = _refunder || eventOwner;
        if (transactionIsSigned) {
          await doSignedRefundTicket(_eventId, _ticketId, refunder, brokerAddress);
        } else {
          await eventsManager.refundTicket(eventId, _ticketId, {from: refunder});
        }
      };

      async function doSignedRefundTicket(_eventId, _ticketId, _refunder, _sender) {
        let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId);
        let signedMessage = testHelper.createSignedMessage(_refunder, keccak256Msg);
        await eventsManager.signedRefundTicket(signedMessage, _eventId, _ticketId, {from: _sender});
      }

      async function doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId, _currentOwner);
        let ownerPermission = testHelper.createSignedMessage(_currentOwner, keccak256Msg);
        if (transactionIsSigned) {
          await doSignedResellTicket(_eventId, _ticketId, ownerPermission, _newBuyer, _seller, brokerAddress);
        } else {
          await eventsManager.resellTicket(_eventId, _ticketId, ownerPermission, _newBuyer, {from: _seller});
        }
      }

      async function doSignedResellTicket(_eventId, _ticketId, _ownerPermission, _newBuyer, _seller, _sender) {
        let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId, _ownerPermission, _newBuyer);
        let signedMessage = testHelper.createSignedMessage(_seller, keccak256Msg);
        await eventsManager.signedResellTicket(signedMessage, _eventId, _ticketId, _ownerPermission, _newBuyer, {from: _sender});
      }

      async function resellTicketSucceeds(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        const seller = _seller || eventOwner;
        await doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, seller);
        const eventArgs = await testHelper.getEventArgs(transactionIsSigned
          ? eventsManager.LogSignedTicketResale
          : eventsManager.LogTicketResale);
        assert.equal(eventArgs.newBuyer, _newBuyer);
      }

      async function resellTicketFails(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        await testHelper.expectRevert(() => doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _seller));
      }

      context(transactionPreTitle + "cancel event", async () => {
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
            await sellTicketSucceeds(eventId);
            await doRefundTicket(eventId, ticketId);
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
            await cancelEventFails(eventId, buyer1);
          });

          it("if done by a primary delegate", async function () {
            await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
            await cancelEventFails(eventId, primaryDelegate); // when not primary delegate
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
            await cancelEventFails(eventId, primaryDelegate); // when primary delegate
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
          });

          it("if done by a secondary delegate", async function () {
            await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
            await cancelEventFails(eventId, secondaryDelegate); // when not secondary delegate
            await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
            await cancelEventFails(eventId, secondaryDelegate); // when secondary delegate
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
          });

          it("if tickets have been sold", async () => {
            await testHelper.advanceTimeToEventTicketSaleStart(eventId);
            await sellTicketSucceeds(eventId);
            await cancelEventFails(eventId);
          });

          if (transactionIsSigned) {
            context("when signed", async () => {
              it("but sending address is not registered as a broker", async () => {
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(brokerAddress, testHelper.brokerAventityType);
                await cancelEventFails(eventId);
                await eventsTestHelper.depositAndRegisterAventity(brokerAddress, testHelper.brokerAventityType, testHelper.evidenceURL, "Registering broker");
              });

              it("but owner is sending address", async () => {
                await testHelper.expectRevert(() => doSignedCancelEvent(eventId, eventOwner, eventOwner));
              });
            });
          }
        });
      });

      context(transactionPreTitle + "sell ticket", async () => {
        afterEach(async () => {
          // Event is closed down by the tests, just make sure we get the deposit out.
          await eventsTestHelper.withdrawDeposit(eventDeposit, eventOwner);
        });

        context("with valid event", async () => {
          afterEach(async () => {
            // Event was valid for the tests, close it down.
            await testHelper.advanceTimeToEventEnd(eventId);
            await eventsManager.unlockEventDeposit(eventId);
          });

          it("fails if the event is in the reporting period", async () => {
            await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
          });

          context("after ticket sale starts", async () => {
            beforeEach(async () => {
              await testHelper.advanceTimeToEventTicketSaleStart(eventId);
            });

            context("succeeds if", async() => {
              it("seller is event owner", async () => {
                await sellTicketSucceeds(eventId);
              });

              it("seller is a primary delegate", async function () {
                await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, primaryDelegate));
                await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
                await doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, primaryDelegate);
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
              });
            });

            context("fails if", async () => {
              it("real time is used", async () => {
                await sellTicketSucceeds(eventId);
                await testHelper.useRealTime();
                // TODO: Fix to run with Solcover (see issue #517)
                // await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
                await testHelper.useMockTime();
                await sellTicketSucceeds(eventId);
              });

              it("the ticket has already been sold", async () => {
                const ticketDetails = setupUniqueTicketParameters();
                await doSellTicket(eventId, ticketDetails, buyer1);
                await testHelper.expectRevert(() => doSellTicket(eventId, ticketDetails, buyer1));
                await testHelper.expectRevert(() => doSellTicket(eventId, ticketDetails, buyer2));
              });

              it("the ticket seller is not the event owner or a primary delegate", async () => {
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, buyer1));
              });

              it("the ticket seller is a deregistered primary delegate still registered on the event", async function () {
                await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
                await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, primaryDelegate));
              });

              it("the seller is a secondary delegate", async function () {
                await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, secondaryDelegate));
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1, secondaryDelegate));
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
              });

              it("the wrong eventId is used", async () => {
                await testHelper.expectRevert(() => doSellTicket(999, setupUniqueTicketParameters(), buyer1));
              });

              it("the event has reached declared number of tickets", async () => {
                for (i = 1; i < 6; i+=1) {
                  await sellTicketSucceeds(eventId);
                }
                await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
              });

              if (transactionIsSigned) {
                context("signed", async () => {
                  it("the signer is the sender", async () => {
                    const ticketDetails = setupUniqueTicketParameters();
                    await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegates");
                    await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
                    await testHelper.expectRevert(() => doSignedSellTicket(eventId, ticketDetails, buyer1, primaryDelegate, primaryDelegate));
                    await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
                  });

                  it("but sending address is not registered as a broker", async () => {
                    await eventsTestHelper.deregisterAventityAndWithdrawDeposit(brokerAddress, testHelper.brokerAventityType);
                    await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
                    await eventsTestHelper.depositAndRegisterAventity(brokerAddress, testHelper.brokerAventityType, testHelper.evidenceURL, "Registering broker");
                  });

                  it("but owner is sending address", async () => {
                    const seller = eventOwner;
                    const sender = eventOwner;
                    await testHelper.expectRevert(() => doSignedSellTicket(eventId, setupUniqueTicketParameters(), buyer1, seller, sender));
                  });
                });
              }
            });
          });
        });

        context("fails if event has", async() => {
          beforeEach(async () => {
            await testHelper.advanceTimeToEventTicketSaleStart(eventId);
          });

          it("ended", async () => {
            await testHelper.advanceTimeToEventEnd(eventId);
            await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
            await eventsManager.unlockEventDeposit(eventId);
          });

          it("been cancelled", async () => {
            await cancelEventSucceeds();
            await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueTicketParameters(), buyer1));
          });
        });
      });

      context(transactionPreTitle + "resell ticket", async () => {
        let soldTicketId;
        let currentOwner;

        beforeEach(async () => {
          await testHelper.advanceTimeToEventTicketSaleStart(eventId);
          const ticketDetails = setupUniqueTicketParameters();
          await doSellTicket(eventId, ticketDetails, buyer1);
          const eventArgs = await testHelper.getEventArgs(transactionIsSigned
            ? eventsManager.LogSignedTicketSale
            : eventsManager.LogTicketSale);
          soldTicketId = eventArgs.ticketId.toNumber();
          currentOwner = eventArgs.buyer;
        });

        afterEach(async () => {
          await testHelper.advanceTimeToEventEnd(eventId);
          await eventsManager.unlockEventDeposit(eventId);
          await eventsTestHelper.withdrawDeposit(eventDeposit, eventOwner);
        });

        context("with valid event", async () => {
          context("succeeds if", async() => {
            context("ticket exists and", async() => {
              it("current owner provides resale permission to event owner", async () => {
                await resellTicketSucceeds(eventId, soldTicketId, currentOwner, newBuyer1);
              });

              it("current owner provides resale permission to secondary delegate", async () => {
                await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
                await resellTicketSucceeds(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
              });
            });
          });

          context("fails if", async() => {
            it("ticket does not exist", async () => {
              await resellTicketFails(eventId, 999, currentOwner, newBuyer1, eventOwner);
            });

            context("ticket exists but", async () => {
              it("reseller is a primary delegate", async () => {
                await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
                await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, primaryDelegate, eventOwner);
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
              });

              it("has already been refunded", async () => {
                await doRefundTicket(eventId, soldTicketId);
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, eventOwner);
              });

              it("is out of sale period", async () => {
                await testHelper.advanceTimeToEventEnd(eventId);
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, eventOwner);
              });

              it("current owner has not granted permission for resale", async () => {
                await resellTicketFails(eventId, soldTicketId, buyer2, newBuyer1, eventOwner);
              });

              it("secondary delegate is not registered on the event", async () => {
                await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
                await resellTicketSucceeds(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await eventsManager.deregisterRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate, eventOwner);
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
              });

              it("secondary delegate is registered on the event but not as an aventity", async () => {
                await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await eventsManager.deregisterRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
              });
            });

            context("event", async() => {
              it("has ended", async () => {
                await testHelper.advanceTimeToEventEnd(eventId);
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, eventOwner);
              });
            });
          });
        });
        context("fails if", async () => {
          it("event does not exist", async () => {
            await resellTicketFails(999, soldTicketId, currentOwner, newBuyer1, eventOwner);
          });
        });
      });

      context(transactionPreTitle + "refund and sell ticket again", async () => {
        beforeEach(async () => {
          await testHelper.advanceTimeToEventTicketSaleStart(eventId);
          await sellTicketSucceeds(eventId);
        });

        afterEach(async () => {
          await eventsTestHelper.withdrawDeposit(eventDeposit, eventOwner);
        });

        context("with valid event", async () => {
          afterEach(async () => {
            // Event was valid for the tests, close it down.
            await testHelper.advanceTimeToEventEnd(eventId);
            await eventsManager.unlockEventDeposit(eventId);
          });

          it("can refund and sell the same ticket again", async () => {
            await doRefundTicket(eventId, ticketId);
            const eventArgs = await testHelper.getEventArgs(transactionIsSigned
                ? eventsManager.LogSignedTicketRefund
                : eventsManager.LogTicketRefund);
            const refundedTicketId = eventArgs.ticketId.toNumber();
            assert.equal(ticketId, refundedTicketId);

            const oldTicketId = ticketId;
            await sellTicketSucceeds(eventId, buyer2);
            assert.ok(ticketId > oldTicketId);
          });

          it("cannot refund invalid ticket", async () => {
            await testHelper.expectRevert(() => doRefundTicket(eventId, 999));
          });

          it("cannot refund ticket if not event owner or primary delegate", async () => {
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId, buyer1));
          });

          it("cannot refund a ticket which is already marked as refunded", async () => {
            await doRefundTicket(eventId, ticketId);
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId));
          });

          it("cannot refund a ticket if sender is a secondary delegate", async function () {
            await eventsTestHelper.depositAndRegisterAventity(secondaryDelegate, testHelper.secondaryDelegateAventityType, testHelper.evidenceURL, "Registering secondary delegate");
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId, secondaryDelegate));
            await eventsManager.registerRole(eventId, testHelper.secondaryDelegateAventityType, secondaryDelegate, {from: eventOwner});
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId, secondaryDelegate));
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(secondaryDelegate, testHelper.secondaryDelegateAventityType);
          });

          it("can refund a ticket if sender is a primary delegate", async function () {
            await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId, primaryDelegate));
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
            await doRefundTicket(eventId, ticketId, primaryDelegate);
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
          });

          it("cannot refund a ticket if primary delegate is registered on the event but not as an aventity", async function () {
            await eventsTestHelper.depositAndRegisterAventity(primaryDelegate, testHelper.primaryDelegateAventityType, testHelper.evidenceURL, "Registering primary delegate");
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateAventityType, primaryDelegate, {from: eventOwner});
            await eventsTestHelper.deregisterAventityAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateAventityType);
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId, primaryDelegate));
          });

          if (transactionIsSigned) {
            context("when signed", async () => {
              it("but sending address is not registered as a broker", async () => {
                await eventsTestHelper.deregisterAventityAndWithdrawDeposit(brokerAddress, testHelper.brokerAventityType);
                await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId));
                await eventsTestHelper.depositAndRegisterAventity(brokerAddress, testHelper.brokerAventityType, testHelper.evidenceURL, "Registering broker");
              });

              it("but owner is sending address", async () => {
                const refunder = eventOwner;
                const sender = eventOwner;
                await testHelper.expectRevert(() => doSignedRefundTicket(eventId, ticketId, refunder, sender));
              });
            });
          }
        });

        context("fails if event has", async () => {
          it("ended", async () => {
            await testHelper.advanceTimeToEventEnd(eventId);
            await testHelper.expectRevert(() => doRefundTicket(eventId, ticketId));
            await eventsManager.unlockEventDeposit(eventId);
          });
        });
      });
    });
  }
});