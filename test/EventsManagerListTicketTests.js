const testHelper = require("./helpers/testHelper");
const eventsTestHelper = require("./helpers/eventsTestHelper");
const membersTestHelper = require("./helpers/membersTestHelper");
const merkleProofTestHelper = require("./helpers/merkleProofTestHelper.js");
const web3Utils = require('web3-utils');

contract('EventsManager - listTicket', async () => {
  testHelper.profilingHelper.addTimeReports('EventsManager - listTicket');

  let goodEvent;
  let eventsManager, merkleRootsManager, membersManager;
  let depositForScalingProvider;
  let depositForMerkleRoot;
  let vendorProof, vendorTicketRefHash;
  let refNum = 0;
  const eventOwner = testHelper.getAccount(0);
  const broker = testHelper.getAccount(1);
  const scalingProvider = testHelper.getAccount(2);
  const ticketOwner = testHelper.getAccount(3);
  const notTheTicketOwner = testHelper.getAccount(4);
  const emptyDoorData = "0x";
  const expectedTreeDepth = 12;

  before(async () => {
    await testHelper.before();
    await eventsTestHelper.before(testHelper, broker, eventOwner);
    await merkleProofTestHelper.before(testHelper);
    await membersTestHelper.before(testHelper);

    eventsManager = eventsTestHelper.getEventsManager();
    merkleRootsManager = merkleProofTestHelper.getMerkleRootsManager();
    membersManager = membersTestHelper.getMembersManager();

    depositForScalingProvider = await membersManager.getNewMemberDeposit(testHelper.scalingProviderMemberType);
    depositForMerkleRoot = await merkleRootsManager.getNewMerkleRootDeposit();
    await registerScalingProviderSucceeds(scalingProvider);
    await membersTestHelper.depositAndRegisterMember(broker, testHelper.brokerMemberType, testHelper.evidenceURL,
      "Registering broker");
  });

  after(async () => {
    await deregisterScalingProviderSucceeds(scalingProvider);
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(broker, testHelper.brokerMemberType);
    await testHelper.checkFundsEmpty();
  });

  beforeEach(async () => {
    await createNewEventAndAdvanceTimeToStart();
    // TODO: Encapsulate solidity sha3 function in test helper
    vendorTicketRefHash = web3Utils.soliditySha3(getUniqueRef());
    vendorProof = testHelper.createVendorTicketProof(goodEvent.id, vendorTicketRefHash, eventOwner, ticketOwner);
  });

  afterEach(async () => {
    await testHelper.advanceTimeToEventEnd(goodEvent.id);
    await eventsManager.endEvent(goodEvent.id);
    await eventsTestHelper.withdrawDeposit(goodEvent.deposit, eventOwner);
  });

  // TODO: return a new eventId, instead of using the global variable
  async function createNewEventAndAdvanceTimeToStart() {
    const isViaBroker = false;
    goodEvent = await eventsTestHelper.makeEventDepositAndCreateValidEvent(isViaBroker);
    await testHelper.advanceTimeToEventOnSaleTime(goodEvent.id);
  }

  async function registerScalingProviderSucceeds(_address) {
    await testHelper.addAVTToFund(depositForScalingProvider, _address, "deposit");
    await membersManager.registerMember(_address, testHelper.scalingProviderMemberType, testHelper.evidenceURL,
      "Registering scalingProvider");
  }

  async function deregisterScalingProviderSucceeds(_address) {
    await membersManager.deregisterMember(_address, testHelper.scalingProviderMemberType);
    await testHelper.withdrawAVTFromFund(depositForScalingProvider, _address, "deposit");
  }

  async function registerMerkleRootSucceeds(_ownerAddress, _rootHash) {
    await testHelper.addAVTToFund(depositForMerkleRoot, _ownerAddress, "deposit");
    await merkleRootsManager.registerMerkleRoot(_ownerAddress, testHelper.evidenceURL, "Registering a MerkleRoot", _rootHash);
    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootRegistered);
    assert.equal(eventArgs.rootHash, _rootHash, "wrong hash");
    assert.equal(eventArgs.ownerAddress, _ownerAddress, "wrong owner address");
    assert.equal(eventArgs.deposit.toNumber(), depositForMerkleRoot.toNumber(), "wrong deposit");
  }

  async function deregisterMerkleRootSucceeds(_ownerAddress, _rootHash) {
    await merkleRootsManager.deregisterMerkleRoot(_rootHash, {from: _ownerAddress});
    const eventArgs = await testHelper.getEventArgs(merkleRootsManager.LogMerkleRootDeregistered);
    assert.equal(eventArgs.rootHash, _rootHash, "wrong Merkle Root hash");
    await testHelper.withdrawAVTFromFund(depositForMerkleRoot, _ownerAddress, "deposit");
  }

  async function listTicketSucceeds(_eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData,
    _ticketOwnerProof, _merklePath, _ticketOwner, _expectedLeafHash, _sender) {
    await eventsManager.listTicket(_eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData,
      _ticketOwnerProof, _merklePath, {from: _sender});
    const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketListed);
    assert.equal(eventArgs.eventId, _eventId, "wrong event Id");
    assert.equal(eventArgs.ticketOwner, _ticketOwner, "wrong ticket owner");
    assert.equal(eventArgs.leafHash, _expectedLeafHash, "wrong leaf hash");
    return eventArgs.ticketId;
  }

  async function listTicketFails(_eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _doorData,
    _ticketOwnerProof, _merklePath, _ticketOwner, _expectedLeafHash, _sender) {
      await testHelper.expectRevert(() => eventsManager.listTicket(_eventId, _vendorTicketRefHash, _ticketMetadata,
        _vendorProof, _doorData, _ticketOwnerProof, _merklePath, {from: _sender}));
  }

  async function sendTicketToFriendSucceeds(_eventId, _ticketId, _sender) {
    let msgHash = await web3Utils.soliditySha3(_eventId, _ticketId, ticketOwner);
    let goodOwnerPermission = testHelper.createSignedMessage(ticketOwner, msgHash);
    let goodDoorData = testHelper.createSignedSecret(100, eventOwner);

    await eventsManager.sendTicketToFriend(_eventId, _ticketId, goodOwnerPermission, goodDoorData, {from: _sender});
    const eventArgs = await testHelper.getEventArgs(eventsManager.LogTicketSentToFriend);
    assert.equal(eventArgs.eventId.toNumber(), _eventId, "wrong event Id");
    assert.equal(eventArgs.ticketId.toNumber(), _ticketId, `wrong ticket Id`);
    assert.equal(eventArgs.newDoorData, goodDoorData, "wrong door data");

    // TODO: verify that the ticket owner has not changed, but that the door data has
  }

  //TODO: pass goodEvent as an argument to the function, instead of taking it from the context
  async function createAndListMerkleTreeTicket(vendorTicketRefHash, vendorProof, sender) {
    const ticketMetadata = "some metadata";
    const doorData = emptyDoorData;
    const ticketOwnerProof = testHelper.createSignedMessage(ticketOwner, vendorTicketRefHash);
    const leafData = [goodEvent.id, vendorTicketRefHash, ticketMetadata, ticketOwner, vendorProof, doorData];
    const tree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);

    await registerMerkleRootSucceeds(scalingProvider, tree.rootHash);
    let ticketId = await listTicketSucceeds(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, doorData,
      ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, sender);

    return [tree, ticketId];
  }

  function getUniqueRef() {
    refNum += 1;
    return "UniqueTicketRef"+refNum;
  }

  context("Listing a ticket sold via a merkle tree", async () => {
    context("succeeds when", async() => {
      it("listed by an event owner when access control is integrated", async () => {
        let tree;
        [tree, ] = await createAndListMerkleTreeTicket(vendorTicketRefHash, vendorProof, eventOwner);
        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });

      it("listed by a broker with a valid original seller proof", async () => {
        const vendorTicketRefHash = web3Utils.soliditySha3(getUniqueRef());
        const proofHash = web3Utils.soliditySha3(goodEvent.id, vendorTicketRefHash, ticketOwner);
        const vendorProof = testHelper.createSignedMessage(eventOwner, proofHash);

        let tree;
        [tree, ] = await createAndListMerkleTreeTicket(vendorTicketRefHash, vendorProof, broker);
        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });
    });

    context("fails when", async() => {
      it("the ticket owner proof is not signed by the correct ticket owner", async () => {
        const ticketMetadata = "some metadata";
        const ticketOwnerProof = testHelper.createSignedMessage(ticketOwner, vendorTicketRefHash);
        const badTicketOwnerProof = testHelper.createSignedMessage(notTheTicketOwner, vendorTicketRefHash);
        const leafData = [goodEvent.id, vendorTicketRefHash, ticketMetadata, ticketOwner, vendorProof, emptyDoorData];
        const tree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);

        await registerMerkleRootSucceeds(scalingProvider, tree.rootHash);
        await listTicketFails(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          badTicketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        // using the correct ticket owner proof
        await listTicketSucceeds(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });

      it("the ticket has already been listed", async () => {
        const ticketMetadata = "some metadata";
        const ticketOwnerProof = testHelper.createSignedMessage(ticketOwner, vendorTicketRefHash);
        const leafData = [goodEvent.id, vendorTicketRefHash, ticketMetadata, ticketOwner, vendorProof, emptyDoorData];
        const tree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);

        await registerMerkleRootSucceeds(scalingProvider, tree.rootHash);
        await listTicketSucceeds(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        // try to list the same ticket again
        await listTicketFails(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });

      it("the merkle root is not registered", async () => {
        const ticketMetadata = "some metadata";
        const ticketOwnerProof = testHelper.createSignedMessage(ticketOwner, vendorTicketRefHash);
        const leafData = [goodEvent.id, vendorTicketRefHash, ticketMetadata, ticketOwner, vendorProof, emptyDoorData];
        const tree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);

        // the merkle root has not been registered at this point
        await listTicketFails(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        await registerMerkleRootSucceeds(scalingProvider, tree.rootHash);
        await listTicketSucceeds(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
            ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });

      it("the data used to reconstruct the leaf is incorrect", async () => {
        const ticketMetadata = "some metadata";
        const ticketOwnerProof = testHelper.createSignedMessage(ticketOwner, vendorTicketRefHash);
        const badEventId = 0;

        let leafData = [goodEvent.id, vendorTicketRefHash, ticketMetadata, ticketOwner, vendorProof, emptyDoorData];
        let tree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);

        await registerMerkleRootSucceeds(scalingProvider, tree.rootHash);
        // passing bad goodEvent means the leaf reconstruction in listTicket should fail
        await listTicketFails(badEventId, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
          ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);

        await listTicketSucceeds(goodEvent.id, vendorTicketRefHash, ticketMetadata, vendorProof, emptyDoorData,
            ticketOwnerProof, tree.merklePath, ticketOwner, tree.leafHash, eventOwner);
        await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
      });
    });
  });

  context("A ticket sold via a valid Merkle tree", async () => {
    let tree, ticketId;

    beforeEach(async () => {
      [tree, ticketId] = await createAndListMerkleTreeTicket(vendorTicketRefHash, vendorProof, eventOwner);
    });

    afterEach(async () => {
      await deregisterMerkleRootSucceeds(scalingProvider, tree.rootHash);
    });

    context("can be sent to a friend", async () => {
      it("by ticket owner", async () => {
        await sendTicketToFriendSucceeds(goodEvent.id, ticketId, ticketOwner);
      });

      it("via an event registered broker", async () => {
        await eventsManager.registerMemberOnEvent(goodEvent.id, broker, testHelper.brokerMemberType, {from: eventOwner});
        await sendTicketToFriendSucceeds(goodEvent.id, ticketId, broker);
        await eventsManager.deregisterMemberFromEvent(goodEvent.id, broker, testHelper.brokerMemberType, {from: eventOwner});
      });
    });
  });
});