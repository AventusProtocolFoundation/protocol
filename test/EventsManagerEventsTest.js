const EventsManager = artifacts.require("EventsManager");
const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const web3Utils = require('web3-utils');

// For unsigned transactions, only the event owner or a delegate can be the msg.sender.
// For signed transactions, anyone can be the msg.sender IFF they have paid an app deposit.
// Therefore, we need two addresses for all transactions that:
//   - create an event: a sender and an owner
//   - affect an event: a sender and an agent
// These two address may be the same (for unsigned transcations) or different (for signed transactions.)
contract('EventsManager - event management', function () {
  let eventsManager, aventusStorage;

  const appAddress = testHelper.getAccount(0);
  const eventOwner = testHelper.getAccount(1);
  const primaryDelegate = testHelper.getAccount(2);
  const secondaryDelegate = testHelper.getAccount(3);

  before(async function() {
    await eventsTestHelper.before(appAddress, eventOwner);

    eventsManager = await EventsManager.deployed();
    aventusStorage = testHelper.getStorage();
  });

  after(async () => await testHelper.checkFundsEmpty());

  context("Event deposits", async () => {
    const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
    const to18SigFig = (new web3.BigNumber(10)).pow(18);

    // Use BigNumber for the deposits so we don't lose accuracy.
    async function getAndCheckEventDeposit(_eventCapacity, _price, _startTime, _expectedUSCentsDepositBN) {
      const deposits = await eventsManager.getEventDeposit(_eventCapacity, _price, _startTime);
      const depositInUsCentsBN = deposits[0];
      assert.equal(_expectedUSCentsDepositBN.toString(), depositInUsCentsBN.toString());
      const oneAvtInUsCentsBN = await aventusStorage.getUInt(web3Utils.soliditySha3("OneAVTInUSCents"));
      const depositInAVTBN = deposits[1];
      assert.equal(
        depositInAVTBN.toString(),
        depositInUsCentsBN.mul(to18SigFig).dividedToIntegerBy(oneAvtInUsCentsBN).toString());
    };

    it("gets the same deposit regardless of non-zero ticket price, eventCapacity or startTime", async function() {
      const expectedUSCentsDepositBN = (await aventusStorage.getUInt(web3Utils.soliditySha3("Events", "fixedDepositAmountUsCents")));
      for (i = 1000; i != 10000; i += 1000) {
        // Create some varied values for the deposit paramaters. Shouldn't make a difference.
        const eventCapacity = 1000 + i * 10;
        const price = i;
        const startTime = testHelper.now() + (i * oneDay);
        await getAndCheckEventDeposit(eventCapacity, price, startTime, expectedUSCentsDepositBN);
      }
    });

    it("gets the same deposit regardless of eventCapacity or startTime if event is free", async function() {
      const price = 0;
      const expectedUSCentsDepositBN = (await aventusStorage.getUInt(web3Utils.soliditySha3("Events", "minimumDepositAmountUsCents")));
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

        it(eventPreTitle + "creation fails unless sending address is whitelisted", async function() {
          eventsTestHelper.setupUniqueEventParameters();
          await eventsTestHelper.makeEventDeposit();
          await createEventFailsDueToPreconditions();
          await eventsTestHelper.depositAndWhitelistApp(appAddress);
          await eventsTestHelper.createValidEvent(useSignedCreateEvent);
          await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(appAddress);
          await eventsTestHelper.endEventAndWithdrawDeposit();
        });

      }

      context(eventPreTitle + (useSignedCreateEvent ? "with whitelisted app address" : ""), async () => {
        if (useSignedCreateEvent) {
          beforeEach(async () => {
            await eventsTestHelper.depositAndWhitelistApp(appAddress);
          });

          afterEach(async () => {
              await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(appAddress);
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

            beforeEach(async function() {
              await eventsTestHelper.makeEventDepositAndCreateValidEvent(useSignedCreateEvent);
            });

            it("end succeeds", async function() {
              await eventsTestHelper.endEventAndWithdrawDeposit();
            });

            it("cannot recreate the same event", async function() {
              const createdEventTime = eventsTestHelper.getEventTime();
              const createdTicketSaleStartTime = eventsTestHelper.getTicketSaleStartTime();
              const createdSupportingUrl = eventsTestHelper.getEventSupportURL();
              await eventsTestHelper.endEventAndWithdrawDeposit();
              await eventsTestHelper.makeEventDeposit();
              await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(useSignedCreateEvent, createdEventTime, createdTicketSaleStartTime, createdSupportingUrl));
              await eventsTestHelper.withdrawEventDeposit();
            });

            context("end fails", async function () {
              it("cannot end event twice", async function() {
                await eventsTestHelper.endEventAndWithdrawDeposit();
                await endEventFails();
              });

              it("cannot withdraw event deposit or end an event if the event eventTime isn't passed", async function() {
                await endEventFails();
                await testHelper.expectRevert(() => eventsTestHelper.withdrawEventDeposit());

                await eventsTestHelper.endEventAndWithdrawDeposit();
              });
            });
          });

          context("create fails", async () => {

            let goodEventTime, goodTicketSaleTime, goodSupportingUrl;

            beforeEach(async function() {
              eventsTestHelper.setupUniqueEventParameters(); // Set up the event parameters that are always good.
              await eventsTestHelper.makeEventDeposit();
              goodEventTime = eventsTestHelper.getEventTime();
              goodTicketSaleTime = eventsTestHelper.getTicketSaleStartTime();
              goodSupportingUrl = eventsTestHelper.getEventSupportURL();
            });

            it("if ticketSaleStartTime is too soon", async function() {
              let badTicketSaleStartTime = eventsTestHelper.getTicketSaleStartTime().minus(1);
              await createEventFails(goodEventTime, badTicketSaleStartTime, goodSupportingUrl);
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if eventTime is before ticketSaleStartTime", async function() {
              let badEventTime = eventsTestHelper.getTicketSaleStartTime().minus(1);
              await createEventFails(badEventTime, goodTicketSaleTime, eventsTestHelper.getEventSupportURL());
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if event supportingURL is not provided", async function() {
              let badEventSupportURL = "";
              await createEventFails(eventsTestHelper.getEventTime(), eventsTestHelper.getTicketSaleStartTime(), badEventSupportURL);
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if not enough deposit was made", async function() {
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
            await eventsManager.registerDelegate(eventId, "PrimaryDelegate", primaryDelegate, {from: eventOwner});
          }

          async function registerPrimaryDelegateFails(_delegate) {
            await testHelper.expectRevert(() => eventsManager.registerDelegate(eventId, "PrimaryDelegate", primaryDelegate, {from: _delegate}));
          }

          async function deregisterPrimaryDelegateSucceeds() {
            await eventsManager.deregisterDelegate(eventId, "PrimaryDelegate", primaryDelegate, {from: eventOwner});
          }

          async function registerUnknownDelegateRoleFails(_delegate) {
            await testHelper.expectRevert(() => eventsManager.registerDelegate(eventId, "unknown_role", _delegate, {from: eventOwner}));
          }

          it("can register/deregister a primary delegate for an event", async function() {
            await eventsTestHelper.depositAndWhitelistApp(primaryDelegate);

            let registered = await eventsManager.addressIsDelegate(eventId, "PrimaryDelegate", primaryDelegate);
            assert.ok(!registered);

            await registerPrimaryDelegateSucceeds();
            registered = await eventsManager.addressIsDelegate(eventId, "PrimaryDelegate", primaryDelegate);
            assert.ok(registered);

            await deregisterPrimaryDelegateSucceeds()
            registered = await eventsManager.addressIsDelegate(eventId, "PrimaryDelegate", primaryDelegate);
            assert.ok(!registered);

            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(primaryDelegate);
          });

          it("can register/deregister a secondary delegate for an event", async function() {
            await eventsTestHelper.depositAndWhitelistApp(secondaryDelegate);

            let registered = await eventsManager.addressIsDelegate(eventId, "SecondaryDelegate", secondaryDelegate);
            assert.ok(!registered);

            await eventsManager.registerDelegate(eventId, "SecondaryDelegate", secondaryDelegate, {from: eventOwner});
            registered = await eventsManager.addressIsDelegate(eventId, "SecondaryDelegate", secondaryDelegate);
            assert.ok(registered);

            await eventsManager.deregisterDelegate(eventId, "SecondaryDelegate", secondaryDelegate, {from: eventOwner});
            registered = await eventsManager.addressIsDelegate(eventId, "SecondaryDelegate", secondaryDelegate);
            assert.ok(!registered);

            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(secondaryDelegate);
          });

          it("cannot register a delegate for an event if they are not whitelisted", async function() {
            await registerPrimaryDelegateFails(eventOwner);
          });

          it ("can deregister a delegate if they are not registered", async function() {
            await eventsTestHelper.depositAndWhitelistApp(primaryDelegate);
            await deregisterPrimaryDelegateSucceeds()
            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(primaryDelegate);
          });

          it("cannot register/deregister a delegate for an event if not the owner", async function() {
            await eventsTestHelper.depositAndWhitelistApp(primaryDelegate);
            await registerPrimaryDelegateFails(primaryDelegate);
            await registerPrimaryDelegateSucceeds();
            await testHelper.expectRevert(() => eventsManager.deregisterDelegate(eventId, "PrimaryDelegate", primaryDelegate, {from: primaryDelegate}));
            await deregisterPrimaryDelegateSucceeds()
            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(primaryDelegate);
          });

          it("cannot register a delegate with an unknown role", async function() {
            await eventsTestHelper.depositAndWhitelistApp(primaryDelegate);
            await registerUnknownDelegateRoleFails(primaryDelegate);
            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(primaryDelegate);
          });
        });
      });
    });
  }
});
