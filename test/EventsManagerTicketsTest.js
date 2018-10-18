const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const membersTestHelper = require("./helpers/membersTestHelper");
const web3Utils = require('web3-utils');

contract('EventsManager - tickets', async () => {
  testHelper.profilingHelper.addTimeReports('EventsManager - tickets');
  let eventsManager;

  const brokerAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primary = testHelper.getAccount(2);
  const secondary = testHelper.getAccount(3);
  const buyer1 = testHelper.getAccount(4);
  const buyer2 = testHelper.getAccount(5);
  const newBuyer1 = testHelper.getAccount(6);
  const emptyDoorData = "0x";
  const emptyVendorProof = "0x";
  const emptyResellerProof = "0x";
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

  // Just test with the direct version of createEvent(), so long as there is no difference between
  // an event that is created via a broker.
  const createEventViaBroker = false;
  const viaBroker = [false, true];
  const primaryIntegrated = [true, false];
  const doorIntegrated = [true, false];
  let ticketId;

  for (let j = 0; j < viaBroker.length; ++j) {
    const isViaBroker = viaBroker[j];
    const transactionPreTitle = (isViaBroker ? "via broker " : "direct ");

    context(transactionPreTitle + "transactions", async () => {
      let goodEvent;

      beforeEach(async () => {
        goodEvent = await eventsTestHelper.makeEventDepositAndCreateValidEvent(createEventViaBroker);
        if (isViaBroker) {
          await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType, testHelper.evidenceURL,
            "Registering broker");
          await eventsManager.registerMemberOnEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
              {from: eventOwner});
        }
      });

      afterEach(async () => {
        // Note: the tests make sure the event has ended before this point...
        if (isViaBroker) {
          // ...so we cannot deregister the member type, but must deregister the member.
          await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
        }
        // ...so all we have to do is withdraw the event deposit for the AVT funds checks.
        await eventsTestHelper.withdrawDeposit(goodEvent.deposit, eventOwner);
      });

      // TODO: return ticketId along with ticket ref rather than storing as a global variable
      async function sellTicketSucceeds(_eventId, _buyer, _vendor, _isPrimaryIntegrated, _isDoorIntegrated, _vendorTicketRef) {
        const vendorTicketRef = _vendorTicketRef || setupUniqueVendorTicketRef();
        const vendorTicketRefHash = web3Utils.soliditySha3(vendorTicketRef);
        const expectedTicketId = web3Utils.soliditySha3(vendorTicketRefHash, _vendor);
        const ticketMetadata = 'some metadata';

        const sender = isViaBroker ? brokerAddress : _vendor;
        const vendorProof = testHelper.createVendorTicketProof(_eventId, vendorTicketRefHash, _vendor, _buyer,
            _isPrimaryIntegrated);
        const doorData = _isDoorIntegrated ? emptyDoorData : testHelper.createSignedSecret(secret, _buyer);

        ticketId = await eventsTestHelper.sellTicketSucceeds(_eventId, vendorTicketRefHash, ticketMetadata, _buyer, vendorProof,
          doorData, sender);

        assert.equal(parseInt(expectedTicketId), parseInt(web3Utils.toHex(ticketId)));
        return vendorTicketRef;
      }

      // TODO: extract common code with sellTicketSucceeds
      async function sellTicketFails(_eventId, _vendorTicketRef, _buyer, _vendor, _isPrimaryIntegrated, _isDoorIntegrated,
        _optionalSender) {
        const vendorTicketRefHash = web3Utils.soliditySha3(_vendorTicketRef);
        const ticketMetadata = 'some metadata';

        const vendorProof = testHelper.createVendorTicketProof(_eventId, vendorTicketRefHash, _vendor, _buyer,
            _isPrimaryIntegrated);
        const sender = _optionalSender || (isViaBroker ? brokerAddress : _vendor);
        const doorData = _isDoorIntegrated ? emptyDoorData : testHelper.createSignedSecret(secret, _buyer);

        await testHelper.expectRevert(() => eventsManager.sellTicket(_eventId, vendorTicketRefHash, ticketMetadata, _buyer,
          vendorProof, doorData, {from: sender}));
      }

      async function returnTicketSucceeds(_eventId, _ticketId, _returner) {
        const sender = isViaBroker ? brokerAddress : _returner;

        const keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId);
        const vendorProof = testHelper.createSignedMessage(_returner, keccak256Msg);

        await eventsTestHelper.returnTicketSucceeds(_eventId, _ticketId, sender, vendorProof);
      }

      async function returnTicketFails(_eventId, _ticketId, _returner, _sender) {
        const sender = _sender || (isViaBroker ? brokerAddress : _returner);

        const keccak256Msg = await web3Utils.soliditySha3(_eventId, _ticketId);
        const vendorProof = testHelper.createSignedMessage(_returner, keccak256Msg);

        await testHelper.expectRevert(() => eventsManager.returnTicket(_eventId, _ticketId, vendorProof, {from: sender}));
      }

      async function doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _isSecondaryIntegrated, _signer, _sender) {
        const signer = _signer || eventOwner;
        const sender = _sender || (isViaBroker ? brokerAddress : signer);
        const ticketOwnerProofHash = await web3Utils.soliditySha3(_eventId, _ticketId, _currentOwner);
        const ticketOwnerProof = testHelper.createSignedMessage(_currentOwner, ticketOwnerProofHash);
        let doorData;

        const resellerProofHash = _isSecondaryIntegrated
            ? await web3Utils.soliditySha3(_eventId, _ticketId, ticketOwnerProof, _newBuyer)
            : await web3Utils.soliditySha3(_eventId, _ticketId, ticketOwnerProof);
        const resellerProof = testHelper.createSignedMessage(signer, resellerProofHash);

        // TODO: set door data based on a separate boolean argument, not on whether the transaction is via a broker
        if (isViaBroker) {
          doorData = testHelper.createSignedSecret(secret, _newBuyer);
        } else {
          doorData =  emptyDoorData;
        }

        await eventsManager.resellTicket(_eventId, _ticketId, ticketOwnerProof, _newBuyer, resellerProof, doorData,
            {from: sender});
      }

      async function resellTicketSucceeds(_eventId, _ticketId, _currentOwner, _newBuyer, _isSecondaryIntegrated, _signer,
          _sender) {
        await doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer, _isSecondaryIntegrated, _signer, _sender);
        const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketResale);
        assert.equal(eventArgs.newBuyer, _newBuyer);
      }

      async function resellTicketFails(_eventId, _ticketId, _currentOwner, _newBuyer, _isSecondaryIntegrated, _signer,
          _sender) {
        await testHelper.expectRevert(() => doResellTicket(_eventId, _ticketId, _currentOwner, _newBuyer,
            _isSecondaryIntegrated, _signer, _sender));
      }

      context("sell ticket", async () => {
        context("with active event", async () => {
          afterEach(async () => {
            // Event was valid for the tests, close it down.
            await testHelper.advanceTimeToEventEnd(goodEvent.id);
            await eventsManager.endEvent(goodEvent.id);
          });

          it("fails if the event is in the reporting period", async () => {
            await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
          });

          context("after ticket sale starts", async () => {
            beforeEach(async () => {
              await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
            });

            for (let k = 0; k < primaryIntegrated.length; ++k) {
              const primaryIsIntegrated = primaryIntegrated[k];
              const primaryIntegratedPreTitle = (primaryIsIntegrated ? "primary integrated " : "primary not integrated ");

              for (let l = 0; l < doorIntegrated.length; ++l) {
                const doorIsIntegrated = doorIntegrated[l];
                const doorIntegratedPreTitle = (doorIsIntegrated ? "door integrated " : "door not integrated ");

                context(primaryIntegratedPreTitle + doorIntegratedPreTitle + "succeeds if", async() => {

                  //TODO: pass goodEvent.id as an argument to the function, instead of taking it from the context
                  async function testSellingTicketAsPrimary(_isPrimaryIntegrated, _isDoorIntegrated) {
                    await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType,
                        testHelper.evidenceURL, "Registering primary");
                    await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, primary, _isPrimaryIntegrated,
                        _isDoorIntegrated);
                    await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType,
                        {from: eventOwner});
                    await sellTicketSucceeds(goodEvent.id, buyer1, primary, _isPrimaryIntegrated, _isDoorIntegrated);
                    await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
                  }

                  it("seller is event owner", async () => {
                    await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, primaryIsIntegrated, doorIsIntegrated);
                  });

                  it("seller is a primary", async function () {
                    await testSellingTicketAsPrimary(primaryIsIntegrated, doorIsIntegrated);
                  });
                });
              }
            }

            // TODO: use good/bad fields pattern to make these failure tests clearer
            context("fails if", async () => {
              it("real time is used", async () => {
                await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, true, true);
                await testHelper.useRealTime();
                // TODO: Fix to run with Solcover (see issue #517)
                // await testHelper.expectRevert(() => doSellTicket(goodEvent.id, setupUniqueVendorTicketRef(), buyer1));
                await testHelper.useMockTime();
                await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, true, true);
              });

              it("the ticket has already been sold", async () => {
                const vendorTicketRef = await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner);
                await sellTicketFails(goodEvent.id, vendorTicketRef, buyer1, eventOwner, true, true);
                await sellTicketFails(goodEvent.id, vendorTicketRef, buyer2, eventOwner, true, true);
              });

              it("the ticket seller is neither the event owner nor a primary", async () => {
                await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, buyer1, true, true);
              });

              it("the ticket seller is a deregistered primary still registered on the event", async function () {
                await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType,
                  testHelper.evidenceURL, "Registering primary");
                await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType,
                  {from: eventOwner});
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary,
                  testHelper.primaryMemberType);
                await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, primary, true, true);
              });

              it("the seller is a secondary", async function () {
                await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
                  testHelper.evidenceURL, "Registering secondary");
                await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, secondary, true, true);
                await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                  {from: eventOwner});
                await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, secondary, true, true);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary,
                  testHelper.secondaryMemberType);
              });

              it("the wrong eventId is used", async () => {
                await sellTicketFails(999, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
              });

              it("the ticket has previously been sold and returned", async () => {
                const ticketRef = await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, true, true);
                await returnTicketSucceeds(goodEvent.id, ticketId, eventOwner);

                await sellTicketFails(goodEvent.id, ticketRef, buyer1, eventOwner, true, true);
              });

              if (isViaBroker) {
                context("via broker", async () => {
                  it("but sending address is not registered as a broker", async () => {
                    await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                    await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
                    await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType,
                      testHelper.evidenceURL, "Registering broker");
                  });

                  it("but buyer does not match what the primary signed", async () => {
                    const newTicketDetails = setupUniqueVendorTicketRef();
                    const keccak256Msg = await web3Utils.soliditySha3(goodEvent.id, newTicketDetails,
                      eventOwner /*signing the message using an address different from buyer*/);
                    const vendorProof = testHelper.createSignedMessage(eventOwner, keccak256Msg);
                    await testHelper.expectRevert(() => eventsManager.sellTicket(goodEvent.id, newTicketDetails,
                        'some metadata', buyer1, vendorProof, emptyDoorData, {from: brokerAddress}));
                  });

                  it("the vendor proof is blank", async () => {
                    const vendorTicketRefHash = web3Utils.soliditySha3(setupUniqueVendorTicketRef());
                    await testHelper.expectRevert(() => eventsManager.sellTicket(goodEvent.id, vendorTicketRefHash,
                        'some metadata', buyer1, emptyVendorProof, emptyDoorData, {from: eventOwner}));
                  });

                  context("primary not integrated", async () => {
                    it("sending address is a registered broker but not on the event", async() => {
                      await eventsManager.deregisterMemberFromEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                        {from: eventOwner});
                      await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, eventOwner, false, true);
                      await eventsManager.registerMemberOnEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                        {from: eventOwner});
                    });
                  });
                });
              }
            });
          });
        });

        it("event has ended", async () => {
          await testHelper.advanceTimeToEventEnd(goodEvent.id);
          await sellTicketFails(goodEvent.id, setupUniqueVendorTicketRef(), buyer1, eventOwner, true, true);
          await eventsManager.endEvent(goodEvent.id);
        });
      });

      context("resell ticket", async () => {
        let soldTicketId;
        let currentOwner;
        const secondaryIntegrated = [true, false];

        beforeEach(async () => {
          await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
          await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, true, true);
          soldTicketId = ticketId;
          currentOwner = buyer1;
        });

        afterEach(async () => {
          await testHelper.advanceTimeToEventEnd(goodEvent.id);
          await eventsManager.endEvent(goodEvent.id);
        });

        context("with valid event", async () => {
          context("succeeds if", async() => {
            for (let j = 0; j < secondaryIntegrated.length; ++j) {
              const secondaryIsIntegrated = secondaryIntegrated[j];
              const secondaryIntegratedPreTitle =
                  (secondaryIsIntegrated ? "secondary integrated " : "secondary not integrated ");
              context(secondaryIntegratedPreTitle + "ticket exists and", async() => {
                it("current owner provides resale permission to event owner", async () => {
                  await resellTicketSucceeds(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated);
                });

                it("current owner provides resale permission to secondary", async () => {
                  await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
                      testHelper.evidenceURL, "Registering secondary");
                  await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                      {from: eventOwner});
                  await resellTicketSucceeds(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated,
                      secondary);
                  await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary, testHelper.secondaryMemberType);
                });
              });
            }
            it("ticket has been sold and returned to event owner", async () => {
              await returnTicketSucceeds(goodEvent.id, soldTicketId, eventOwner);
              await resellTicketSucceeds(goodEvent.id, soldTicketId, eventOwner, newBuyer1);
            });
          });

          context("fails if", async() => {
            const secondaryIsIntegrated = true;
            const secondaryNotIntegrated = false;

            it("ticket does not exist", async () => {
              await resellTicketFails(goodEvent.id, 999, currentOwner, newBuyer1, secondaryIsIntegrated);
            });

            context("ticket exists but", async () => {
              it("reseller is a primary", async () => {
                await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType,
                    testHelper.evidenceURL, "Registering primary");
                await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType,
                    {from: eventOwner});
                await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated, primary);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary,
                    testHelper.primaryMemberType);
              });

              it("has already been returned", async () => {
                await returnTicketSucceeds(goodEvent.id, soldTicketId, eventOwner);
                await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated);
              });

              it("is out of sale period", async () => {
                await testHelper.advanceTimeToEventEnd(goodEvent.id);
                await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated);
              });

              it("current owner has not granted permission for resale", async () => {
                await resellTicketFails(goodEvent.id, soldTicketId, buyer2, newBuyer1, secondaryIsIntegrated);
              });

              it("secondary is not registered on the event", async () => {
                await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
                    testHelper.evidenceURL, "Registering secondary");
                await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                    {from: eventOwner});
                await resellTicketSucceeds(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated,
                    secondary);
                await eventsManager.deregisterMemberFromEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                    {from: eventOwner});
                await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated, secondary);
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary, testHelper.secondaryMemberType);
              });

              it("secondary is registered on the event but not as a member", async () => {
                await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
                  testHelper.evidenceURL, "Registering secondary");
                await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                  {from: eventOwner});
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary,
                  testHelper.secondaryMemberType);
                await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated, secondary);
                await eventsManager.deregisterMemberFromEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
                    {from: eventOwner});
              });

              it("reseller proof is not provided", async () => {
                const keccak256PermissionMsg = await web3Utils.soliditySha3(goodEvent.id, soldTicketId, currentOwner);
                const ownerPermission = testHelper.createSignedMessage(currentOwner, keccak256PermissionMsg);
                testHelper.expectRevert(() => eventsManager.resellTicket(goodEvent.id, soldTicketId, ownerPermission, newBuyer1,
                    emptyResellerProof, emptyDoorData, {from: eventOwner}));
              });

              if(isViaBroker) {
                context("secondary is not integrated and", async () => {
                  it("sending address is a registered broker but not on the event", async() => {
                    await eventsManager.deregisterMemberFromEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                        {from: eventOwner});
                    await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryNotIntegrated);
                    await eventsManager.registerMemberOnEvent(goodEvent.id, brokerAddress, testHelper.brokerMemberType,
                        {from: eventOwner});
                  });
                });
              }
            });

            it("event has ended", async () => {
              await testHelper.advanceTimeToEventEnd(goodEvent.id);
              await resellTicketFails(goodEvent.id, soldTicketId, currentOwner, newBuyer1, secondaryIsIntegrated);
            });
          });
        });

        it("fails if event does not exist", async () => {
          await resellTicketFails(999, soldTicketId, currentOwner, newBuyer1, true);
        });
      });

      context("return ticket", async () => {
        beforeEach(async () => {
          await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
          await sellTicketSucceeds(goodEvent.id, buyer1, eventOwner, true, true);
        });

        context("in ticket on sale period", async () => {
          afterEach(async () => {
            // Event was valid for the tests, close it down.
            await testHelper.advanceTimeToEventEnd(goodEvent.id);
            await eventsManager.endEvent(goodEvent.id);
          });

          it("can return a sold ticket multiple times", async () => {
            await returnTicketSucceeds(goodEvent.id, ticketId, eventOwner);
            await returnTicketSucceeds(goodEvent.id, ticketId, eventOwner);
          });

          // TODO: Put all of these in a "fails" context.

          it("cannot return invalid ticket", async () => {
            await returnTicketFails(goodEvent.id, 999, eventOwner);
          });

          it("cannot return ticket if neither event owner nor primary", async () => {
            await returnTicketFails(goodEvent.id, ticketId, buyer1);
          });

          it("cannot return a ticket if sender and signer is a secondary", async function () {
            await membersTestHelper.depositAndRegisterMember(secondary, testHelper.secondaryMemberType,
              testHelper.evidenceURL, "Registering secondary");
            await returnTicketFails(goodEvent.id, ticketId, secondary);
            await eventsManager.registerMemberOnEvent(goodEvent.id, secondary, testHelper.secondaryMemberType,
              {from: eventOwner});
            await returnTicketFails(goodEvent.id, ticketId, secondary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(secondary,
              testHelper.secondaryMemberType);
          });

          it("can return a ticket if sender and signer is a primary", async function () {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType,
              testHelper.evidenceURL, "Registering primary");
            await returnTicketFails(goodEvent.id, ticketId, primary);
            await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType,
              {from: eventOwner});
            await returnTicketSucceeds(goodEvent.id, ticketId, primary);
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary,
              testHelper.primaryMemberType);
          });

          it("cannot return a ticket if primary is registered on the event but not as a member", async function () {
            await membersTestHelper.depositAndRegisterMember(primary, testHelper.primaryMemberType,
              testHelper.evidenceURL, "Registering primary");
            await eventsManager.registerMemberOnEvent(goodEvent.id, primary, testHelper.primaryMemberType,
              {from: eventOwner});
            await membersTestHelper.deregisterMemberAndWithdrawDeposit(primary, testHelper.primaryMemberType);
            await returnTicketFails(goodEvent.id, ticketId, primary);
          });

          it("cannot return a ticket if vendor proof is not provided", async () => {
            await testHelper.expectRevert(() => eventsManager.returnTicket(goodEvent.id, ticketId, emptyVendorProof,
                {from: eventOwner}));
          });

          if (isViaBroker) {
            context("when via broker", async () => {
              it("but sending address is not registered as a broker", async () => {
                await membersTestHelper.deregisterMemberAndWithdrawDeposit(brokerAddress, testHelper.brokerMemberType);
                await returnTicketFails(goodEvent.id, ticketId, eventOwner);
                await membersTestHelper.depositAndRegisterMember(brokerAddress, testHelper.brokerMemberType,
                  testHelper.evidenceURL, "Registering broker");
              });
            });
          }
        });

        it("fails if event has ended", async () => {
          await testHelper.advanceTimeToEventEnd(goodEvent.id);
          await returnTicketFails(goodEvent.id, ticketId, eventOwner);
          await eventsManager.endEvent(goodEvent.id);
        });
      });
    });
  }
});