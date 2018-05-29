const EventsManager = artifacts.require("EventsManager");
const AventusVote = artifacts.require("AventusVote");
const AventusStorage = artifacts.require("AventusStorage");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const AppsManager = artifacts.require("AppsManager");
const IERC20 = artifacts.require("IERC20");
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
  const delegate = testHelper.getAccount(2);

  before(async function() {
    await eventsTestHelper.before(appAddress, eventOwner);
    eventsManager = await EventsManager.deployed();
    aventusStorage = await AventusStorage.deployed();
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
    const eventIsSigned = signedEvent[i];
    const eventPreTitle = (eventIsSigned ? "Signed" : "Unsigned") + " event ";

    context(eventPreTitle, async () => {
      async function createEventFails(_eventTime, _eventTicketSaleStartTime, _eventSupportURL) {
        await testHelper.expectRevert(() => eventsTestHelper.doCreateEvent(eventIsSigned, _eventTime, _eventTicketSaleStartTime, _eventSupportURL))
      }

      async function createEventFailsDueToPreconditions() {
        // Pass in valid values.
        await createEventFails(
          eventsTestHelper.getEventTime(),
          eventsTestHelper.getEventTicketSaleStartTime(),
          eventsTestHelper.getEventSupportURL());
      }

      if (eventIsSigned) {
        it(eventPreTitle + "creation fails unless sending address is whitelisted", async function() {
          eventsTestHelper.setupUniqueEventParameters();
          await eventsTestHelper.makeEventDeposit();
          await createEventFailsDueToPreconditions();
          await eventsTestHelper.depositAndWhitelistApp(appAddress);
          await eventsTestHelper.createValidEvent(eventIsSigned);
          await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(appAddress);
          await eventsTestHelper.endEventAndWithdrawDeposit();
        });
      }

      context(eventPreTitle + (eventIsSigned ? "with whitelisted app address" : ""), async () => {
        if (eventIsSigned) {
          beforeEach(async () => {
            await eventsTestHelper.depositAndWhitelistApp(appAddress);
          });

          afterEach(async () => {
              await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(appAddress);
          });
        }

        async function makeEventDepositAndCreateFailingEvent(_eventTime, _eventTicketSaleStartTime, _eventSupportURL) {
          await eventsTestHelper.makeEventDeposit();
          await eventsTestHelper.doCreateEvent(eventIsSigned, _eventTime, _eventTicketSaleStartTime, _eventSupportURL);
        }

        context(eventPreTitle + "create and end", async () => {
          context("create succeeds", async () => {
            async function endEventFails() {
              await testHelper.expectRevert(() => eventsManager.unlockEventDeposit(
                eventsTestHelper.getValidEventId()));
            }

            beforeEach(async function() {
              await eventsTestHelper.makeEventDepositAndCreateValidEvent();
            });

            it("end succeeds", async function() {
              await eventsTestHelper.endEventAndWithdrawDeposit();
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
              goodTicketSaleTime = eventsTestHelper.getEventTicketSaleStartTime();
              goodSupportingUrl = eventsTestHelper.getEventSupportURL();
            });

            it("if ticketSaleStartTime is too soon", async function() {
              let badEventTicketSaleStartTime = eventsTestHelper.getEventTicketSaleStartTime().minus(1);
              await createEventFails(goodEventTime, badEventTicketSaleStartTime, goodSupportingUrl);
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if eventTime is before ticketSaleStartTime", async function() {
              let badEventTime = eventsTestHelper.getEventTicketSaleStartTime().minus(1);
              await createEventFails(badEventTime, goodTicketSaleTime, eventsTestHelper.getEventSupportURL());
              await eventsTestHelper.withdrawEventDeposit();
            });

            it("if event supportingURL is not provided", async function() {
              let badEventSupportURL = "";
              await createEventFails(eventsTestHelper.getEventTime(), eventsTestHelper.getEventTicketSaleStartTime(), badEventSupportURL);
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
            await eventsTestHelper.makeEventDepositAndCreateValidEvent();
            eventId = eventsTestHelper.getValidEventId();
          });

          afterEach(async () => {
            await eventsTestHelper.endEventAndWithdrawDeposit();
          });

          async function registerDelegateSucceeds() {
            await eventsManager.registerDelegate(eventId, delegate, {from: eventOwner});
          }

          async function registerDelegateFails(_delegate) {
            await testHelper.expectRevert(() => eventsManager.registerDelegate(eventId, delegate, {from: _delegate}));
          }

          async function deregisterDelegateSucceeds() {
            await eventsManager.deregisterDelegate(eventId, delegate, {from: eventOwner});
          }

          it("can register/deregister a whitelisted delegate", async function() {
            await eventsTestHelper.depositAndWhitelistApp(delegate);

            let registered = await eventsManager.addressIsDelegate(eventId, delegate);
            assert.ok(!registered);

            await registerDelegateSucceeds();
            registered = await eventsManager.addressIsDelegate(eventId, delegate);
            assert.ok(registered);

            await deregisterDelegateSucceeds()
            registered = await eventsManager.addressIsDelegate(eventId, delegate);
            assert.ok(!registered);

            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(delegate);
          });

          it("cannot register a delegate if they are not whitelisted", async function() {
            await registerDelegateFails(eventOwner);
          });

          it ("can deregister a delegate if they are not registered", async function() {
            await eventsTestHelper.depositAndWhitelistApp(delegate);
            await deregisterDelegateSucceeds()
            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(delegate);
          });

          it("cannot register/deregister a delegate if not the owner", async function() {
            await eventsTestHelper.depositAndWhitelistApp(delegate);
            await registerDelegateFails(delegate);
            await registerDelegateSucceeds();
            await testHelper.expectRevert(() => eventsManager.deregisterDelegate(eventId, delegate, {from: delegate}));
            await deregisterDelegateSucceeds()
            await eventsTestHelper.dewhitelistAppAndWithdrawDeposit(delegate);
          });
        });
      });
    });
  }
});