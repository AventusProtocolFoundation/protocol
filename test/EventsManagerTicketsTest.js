const EventsManager = artifacts.require("EventsManager");
const IERC20 = artifacts.require("IERC20");
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
contract('EventsManager - tickets', async () => {
  let eventsManager;

  let eventId, eventDeposit;

  const brokerAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primaryDelegate = testHelper.getAccount(2);
  const secondaryDelegate = testHelper.getAccount(3);
  const buyer1 = testHelper.getAccount(4);
  const buyer2 = testHelper.getAccount(5);
  const newBuyer1 = testHelper.getAccount(6);
  const emptyOptionalData = "0x";
  const secret = 1000;

  const vendorTicketRefBase = "UniqueVendorTicketRef ";
  let ticketCount = 1;

  before(async () => {
    await testHelper.before();
    await eventsTestHelper.before(testHelper, brokerAddress, eventOwner);
    await membersTestHelper.before(testHelper);

    eventsManager = eventsTestHelper.getEventsManager();
  });

  after(async () => await testHelper.checkFundsEmpty());

  function setupUniqueVendorTicketRef() {
    // Make each call give us a unique vendor ticket ID so we don't sell the same
    // ticket twice in a test.
    return vendorTicketRefBase + ticketCount++;
  }

  // Just test with the unsigned version of createEvent(), so long as there is no difference between
  // an event that is created with signedCreateEvent().
  const useSignedCreateEvent = false;
  const signedTransaction = [false, true];
  const primaryIntegrated = [true, false];
  const doorIntegrated = [true, false];
  let ticketId;

  for (let j = 0; j < signedTransaction.length; ++j) {
    const transactionIsSigned = signedTransaction[j];
    const transactionPreTitle = (transactionIsSigned ? "signed " : "unsigned ");

    context(transactionPreTitle + "transactions", async () => {

      beforeEach(async () => {
        if (transactionIsSigned) {
          await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL,
            "Registering broker");
        };
        await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
        eventId = eventsTestHelper.getValidEventId();
        eventDeposit = eventsTestHelper.getEventDeposit();
        if (transactionIsSigned) {
          await eventsManager.registerRole(eventId, testHelper.brokerMemberType, brokerAddress, {from: eventOwner});
        };
      });

      if (transactionIsSigned) {
        afterEach(async () => {
            await eventsManager.deregisterRole(eventId, testHelper.brokerMemberType, brokerAddress, {from: eventOwner});
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
        });
      }

      async function sellTicketSucceeds(_eventId, _buyer, _seller, _isPrimaryIntegrated, _isDoorIntegrated) {
        let sellerProof, doorData, sender;
        let vendorTicketRef = setupUniqueVendorTicketRef();
        let vendorTicketRefHash = web3Utils.soliditySha3(vendorTicketRef);
        const ticketMetadata = 'some metadata';

        if (transactionIsSigned) {
          let keccak256Msg;
          sender = brokerAddress;
          if (!_isPrimaryIntegrated) {
            keccak256Msg = await web3Utils.soliditySha3(_eventId, vendorTicketRefHash);
          } else {
            keccak256Msg = await web3Utils.soliditySha3(_eventId, vendorTicketRefHash, _buyer);
          }
          sellerProof = testHelper.createSignedMessage(_seller, keccak256Msg);
        } else {
          sender = _seller;
          sellerProof = emptyOptionalData;
        }

        doorData = _isDoorIntegrated ? emptyOptionalData : testHelper.createSignedSecret(secret, _buyer);

        ticketId = await eventsTestHelper.sellTicketSucceeds(_eventId, vendorTicketRefHash, ticketMetadata, _buyer, sellerProof,
          doorData, sender);
        return vendorTicketRef;
      }

      async function sellTicketFails(_eventId, _vendorTicketRef, _buyer, _seller, _isPrimaryIntegrated, _isDoorIntegrated,
        _optionalSender) {
        let sellerProof, doorData, sender;
        vendorTicketRefHash = web3Utils.soliditySha3(_vendorTicketRef);
        const ticketMetadata = 'some metadata';

        if (transactionIsSigned) {
          let keccak256Msg;
          sender = _optionalSender || brokerAddress;
          if (!_isPrimaryIntegrated) {
            keccak256Msg = await web3Utils.soliditySha3(_eventId, vendorTicketRefHash);
          } else {
            keccak256Msg = await web3Utils.soliditySha3(_eventId, vendorTicketRefHash, _buyer);
          }
          sellerProof = testHelper.createSignedMessage(_seller, keccak256Msg);
        } else {
          sender = _optionalSender || _seller;
          sellerProof = emptyOptionalData;
        }

        doorData = _isDoorIntegrated ? emptyOptionalData : testHelper.createSignedSecret(secret, _buyer);

        await testHelper.expectRevert(() => eventsManager.sellTicket(_eventId, vendorTicketRefHash, ticketMetadata, _buyer,
          sellerProof, doorData, {from: sender}));
      }

      async function refundTicketSucceeds(_eventId, _ticketId, _refunder) {
        let vendorProof, sender;

        if (transactionIsSigned) {
          sender = brokerAddress;
          let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId);
          vendorProof = testHelper.createSignedMessage(_refunder, keccak256Msg);
        } else {
          sender = _refunder;
          vendorProof = emptyOptionalData;
        }

        await eventsTestHelper.refundTicketSucceeds(_eventId, _ticketId, sender, vendorProof);
      }

      async function refundTicketFails(_eventId, _ticketId, _refunder, _sender) {
        let vendorProof, sender;

        if (transactionIsSigned) {
          sender = _sender || brokerAddress;
          let keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId);
          vendorProof = testHelper.createSignedMessage(_refunder, keccak256Msg);
        } else {
          sender = _refunder;
          vendorProof = emptyOptionalData;
        }

        await testHelper.expectRevert(() => eventsManager.refundTicket(_eventId, _ticketId, vendorProof, {from: sender}));
      }

      async function doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        let sender, sellerProof;
        let keccak256PermissionMsg = await web3Utils.soliditySha3(_eventId, _ticketId, _currentOwner);
        let ownerPermission = testHelper.createSignedMessage(_currentOwner, keccak256PermissionMsg);

        if (transactionIsSigned) {
          let keccak256ProofMsg = await web3Utils.soliditySha3(_eventId, _ticketId, ownerPermission, _newBuyer);
          sellerProof = testHelper.createSignedMessage(_seller, keccak256ProofMsg);
          sender = brokerAddress;
        } else {
          sellerProof = emptyOptionalData;
          sender = _seller;
        }

        await eventsManager.resellTicket(_eventId, _ticketId, ownerPermission, _newBuyer, sellerProof, {from: sender});
      }

      async function resellTicketSucceeds(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        const seller = _seller || eventOwner;
        await doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, seller);
        const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketResale);
        assert.equal(eventArgs.newBuyer, _newBuyer);
      }

      async function resellTicketFails(_eventId, _ticketId, _currentOwner, _newBuyer, _seller) {
        await testHelper.expectRevert(() => doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _seller));
      }

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
            await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
          });

          context("after ticket sale starts", async () => {
            beforeEach(async () => {
              await testHelper.advanceTimeToEventTicketSaleStart(eventId);
            });

            for (let k = 0; k < primaryIntegrated.length; ++k) {
              const primaryIsIntegrated = primaryIntegrated[k];
              // This case is covered by other tests
              if (!primaryIsIntegrated && !transactionIsSigned)  {
                continue;
              }
              const primaryIntegratedPreTitle = (primaryIsIntegrated ? "primary integrated " : "primary not integrated ");

              for (let l = 0; l < doorIntegrated.length; ++l) {
                const doorIsIntegrated = doorIntegrated[l];
                const doorIntegratedPreTitle = (doorIsIntegrated ? "door integrated " : "door not integrated ");

                context(primaryIntegratedPreTitle + doorIntegratedPreTitle + "succeeds if", async() => {

                  async function testSellingTicketAsPrimaryDelegate(_isPrimaryIntegrated, _isDoorIntegrated) {
                    await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
                      testHelper.evidenceURL, "Registering primary delegate");
                    await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, primaryDelegate, _isPrimaryIntegrated,
                    _isDoorIntegrated);
                    await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
                      {from: eventOwner});
                    await sellTicketSucceeds(eventId, buyer1, primaryDelegate, _isPrimaryIntegrated, _isDoorIntegrated);
                    await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate,
                      testHelper.primaryDelegateMemberType);
                  }

                  it("seller is event owner", async () => {
                    await sellTicketSucceeds(eventId, buyer1, eventOwner, primaryIsIntegrated, doorIsIntegrated);
                  });

                  it("seller is a primary delegate", async function () {
                    await testSellingTicketAsPrimaryDelegate(primaryIsIntegrated, doorIsIntegrated);
                  });
                });
              }
            }

            context("fails if", async () => {
              it("real time is used", async () => {
                await sellTicketSucceeds(eventId, buyer1, eventOwner, true, true);
                await testHelper.useRealTime();
                // TODO: Fix to run with Solcover (see issue #517)
                // await testHelper.expectRevert(() => doSellTicket(eventId, setupUniqueVendorTicketRef(), buyer1));
                await testHelper.useMockTime();
                await sellTicketSucceeds(eventId, buyer1, eventOwner, true, true);
              });

              it("the ticket has already been sold", async () => {
                const vendorTicketRef = await sellTicketSucceeds(eventId, buyer1, eventOwner);
                await sellTicketFails(eventId, vendorTicketRef, buyer1, eventOwner, true, true);
                await sellTicketFails(eventId, vendorTicketRef, buyer2, eventOwner, true, true);
              });

              it("the ticket seller is not the event owner or a primary delegate", async () => {
                await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, buyer1, true, true);
              });

              it("the ticket seller is a deregistered primary delegate still registered on the event", async function () {
                await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering primary delegate");
                await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
                  {from: eventOwner});
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate,
                  testHelper.primaryDelegateMemberType);
                await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, primaryDelegate, true, true);
              });

              it("the seller is a secondary delegate", async function () {
                await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering secondary delegate");
                await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, secondaryDelegate, true, true);
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
                  {from: eventOwner});
                await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, secondaryDelegate, true, true);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate,
                  testHelper.secondaryDelegateMemberType);
              });

              it("the wrong eventId is used", async () => {
                await sellTicketFails(999, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
              });

              it("the event has reached declared number of tickets", async () => {
                for (i = 1; i < 6; i+=1) {
                  await sellTicketSucceeds(eventId, buyer1, eventOwner, true, true);
                }
                await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
              });

              if (transactionIsSigned) {
                context("signed", async () => {
                  it("the signer is the sender", async () => {
                    await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
                      testHelper.evidenceURL, "Registering primary delegates");
                    await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
                      {from: eventOwner});
                    await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, primaryDelegate, true, true,
                      primaryDelegate);
                    await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate,
                      testHelper.primaryDelegateMemberType);
                  });

                  it("but sending address is not registered as a broker", async () => {
                    await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                    await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
                    await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType,
                      testHelper.evidenceURL, "Registering broker");
                  });

                  it("but owner is sending address", async () => {
                    const seller = eventOwner;
                    const sender = eventOwner;
                    await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, seller, true, true, sender);
                  });

                  it("but buyer is not the same as what the primary signed", async () => {
                    const newTicketDetails = setupUniqueVendorTicketRef();
                    let keccak256Msg = await web3Utils.soliditySha3(eventId, newTicketDetails,
                      eventOwner /*signing the message using an address different from buyer*/);
                    let signedMessage = testHelper.createSignedMessage(eventOwner, keccak256Msg);
                    await testHelper.expectRevert(() => eventsManager.sellTicket(eventId, newTicketDetails, 'some metadata',
                      buyer1, signedMessage, emptyOptionalData, {from: brokerAddress}));
                  });

                  context("primary not integrated", async () => {
                    it("sending address is a registered broker but not on the event", async() => {
                      await eventsManager.deregisterRole(eventId, testHelper.brokerMemberType, brokerAddress,
                        {from: eventOwner});
                      await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, eventOwner, false, true);
                      await eventsManager.registerRole(eventId, testHelper.brokerMemberType, brokerAddress, {from: eventOwner});
                    });
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
            await sellTicketFails(eventId, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
            await eventsManager.unlockEventDeposit(eventId);
          });

        });
      });


      context(transactionPreTitle + "resell ticket", async () => {
        let soldTicketId;
        let currentOwner;

        beforeEach(async () => {
          await testHelper.advanceTimeToEventTicketSaleStart(eventId);
          const vendorTicketRef = await sellTicketSucceeds(eventId, buyer1, eventOwner, true, true);
          soldTicketId = ticketId;
          currentOwner = buyer1;
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
                await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
                  {from: eventOwner});
                await resellTicketSucceeds(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate,
                  testHelper.secondaryDelegateMemberType);
              });
            });
          });

          context("fails if", async() => {
            it("ticket does not exist", async () => {
              await resellTicketFails(eventId, 999, currentOwner, newBuyer1, eventOwner);
            });

            context("ticket exists but", async () => {
              it("reseller is a primary delegate", async () => {
                await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering primary delegate");
                await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
                  {from: eventOwner});
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, primaryDelegate, eventOwner);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate,
                  testHelper.primaryDelegateMemberType);
              });

              it("has already been refunded", async () => {
                await refundTicketSucceeds(eventId, soldTicketId, eventOwner);
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
                await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
                  {from: eventOwner});
                await resellTicketSucceeds(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await eventsManager.deregisterRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
                  {from: eventOwner});
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate, eventOwner);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate,
                  testHelper.secondaryDelegateMemberType);
              });

              it("secondary delegate is registered on the event but not as a member", async () => {
                await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType,
                  testHelper.evidenceURL, "Registering secondary delegate");
                await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
                  {from: eventOwner});
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate,
                  testHelper.secondaryDelegateMemberType);
                await resellTicketFails(eventId, soldTicketId, currentOwner, newBuyer1, secondaryDelegate);
                await eventsManager.deregisterRole(eventId, testHelper.secondaryDelegateMemberType,
                  secondaryDelegate, {from: eventOwner});
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
          await sellTicketSucceeds(eventId, buyer1, eventOwner, true, true);
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
            await refundTicketSucceeds(eventId, ticketId, eventOwner);
            const oldTicketId = ticketId;
            await sellTicketSucceeds(eventId, buyer2, eventOwner, true, true);
            assert.ok(ticketId > oldTicketId);
          });

          it("cannot refund invalid ticket", async () => {
            await refundTicketFails(eventId, 999, eventOwner);
          });

          it("cannot refund ticket if not event owner or primary delegate", async () => {
            await refundTicketFails(eventId, ticketId, buyer1);
          });

          it("cannot refund a ticket which is already marked as refunded", async () => {
            await refundTicketSucceeds(eventId, ticketId, eventOwner);
            await refundTicketFails(eventId, ticketId, eventOwner);
          });

          it("cannot refund a ticket if sender is a secondary delegate", async function () {
            await membersTestHelper.depositAndRegisterMember(secondaryDelegate, testHelper.secondaryDelegateMemberType,
              testHelper.evidenceURL, "Registering secondary delegate");
            await refundTicketFails(eventId, ticketId, secondaryDelegate);
            await eventsManager.registerRole(eventId, testHelper.secondaryDelegateMemberType, secondaryDelegate,
              {from: eventOwner});
            await refundTicketFails(eventId, ticketId, secondaryDelegate);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondaryDelegate,
              testHelper.secondaryDelegateMemberType);
          });

          it("can refund a ticket if sender is a primary delegate", async function () {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
              testHelper.evidenceURL, "Registering primary delegate");
            await refundTicketFails(eventId, ticketId, primaryDelegate);
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
              {from: eventOwner});
            await refundTicketSucceeds(eventId, ticketId, primaryDelegate);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate,
              testHelper.primaryDelegateMemberType);
          });

          it("cannot refund a ticket if primary delegate is registered on the event but not as a member", async function () {
            await membersTestHelper.depositAndRegisterMember(primaryDelegate, testHelper.primaryDelegateMemberType,
              testHelper.evidenceURL, "Registering primary delegate");
            await eventsManager.registerRole(eventId, testHelper.primaryDelegateMemberType, primaryDelegate,
              {from: eventOwner});
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primaryDelegate, testHelper.primaryDelegateMemberType);
            await refundTicketFails(eventId, ticketId, primaryDelegate);
          });

          if (transactionIsSigned) {
            context("when signed", async () => {
              it("but sending address is not registered as a broker", async () => {
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                await refundTicketFails(eventId, ticketId, eventOwner);
                await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType,
                  testHelper.evidenceURL, "Registering broker");
              });

              it("but owner is sending address", async () => {
                const refunder = eventOwner;
                const sender = eventOwner;
                await refundTicketFails(eventId, ticketId, refunder, sender);
              });
            });
          }
        });

        context("fails if event has", async () => {
          it("ended", async () => {
            await testHelper.advanceTimeToEventEnd(eventId);
            await refundTicketFails(eventId, ticketId, eventOwner);
            await eventsManager.unlockEventDeposit(eventId);
          });
        });
      });
    });
  }
});