const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

contract('EventsManager - merkle tickets', async () => {
  let merkleRootsManager, eventsManager;
  const accounts = testHelper.getAccounts('eventOwner', 'scalingProvider', 'primary', 'ticketOwner', 'badAddress');
  const memberTypes = membersTestHelper.memberTypes;

  let goodEventId;
  let goodVendorTicketRefHash;
  let goodTicketMetadata;
  let goodVendorProof;
  let goodTicketOwnerProof;
  let goodMerklePath;
  let goodTree;
  let goodSender;
  let goodTicketOwner = accounts.ticketOwner;
  let doorData = '0x';

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper);
    await merkleProofTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    eventsManager = testHelper.getEventsManager();

    await membersTestHelper.depositAndRegisterMember(accounts.scalingProvider, memberTypes.scalingProvider);
    await membersTestHelper.depositAndRegisterMember(accounts.primary, memberTypes.primary);
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.scalingProvider, memberTypes.scalingProvider);
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.primary, memberTypes.primary);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  async function depositAndCreateEventAndAdvanceToOnSaleTime() {
    const eventId = await eventsTestHelper.depositAndCreateEvent(accounts.eventOwner);
    await eventsTestHelper.advanceTimeToOnSaleTime(eventId);
    return eventId;
  }

  async function generateGoodParams() {
    goodEventId = await depositAndCreateEventAndAdvanceToOnSaleTime();
    goodVendorTicketRefHash = testHelper.hash('1');
    goodTicketMetadata = 'some metadata';
    goodVendorProof = signingTestHelper.getListTicketVendorProof(accounts.primary, goodEventId, goodVendorTicketRefHash,
        goodTicketOwner);
    goodTicketOwnerProof = signingTestHelper.getListTicketTicketOwnerProof(goodTicketOwner, goodVendorTicketRefHash);
    const leafData = [goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodTicketOwner, goodVendorProof, doorData];
    const expectedTreeDepth = 12;
    goodTree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);
    goodMerklePath = goodTree.merklePath;
    goodSender = accounts.eventOwner;
  }

  async function registerMerkleRootAndVendorOnEvent() {
    await merkleRootsManager.registerMerkleRoot(goodTree.rootHash, {from: accounts.scalingProvider});
    await eventsManager.registerMemberOnEvent(goodEventId, accounts.primary, memberTypes.primary, {from: goodSender});
  }

  async function listTicketSucceeds() {
    await eventsManager.listTicket(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof, doorData,
        goodTicketOwnerProof, goodMerklePath, {from: goodSender});

    const expectedTicketId = testHelper.hash(goodVendorTicketRefHash, accounts.primary);
    const logArgs = await testHelper.getLogArgs(eventsManager.LogTicketListed);
    assert.equal(logArgs.eventId.toNumber(), goodEventId);
    assert.equal(logArgs.ticketId.toNumber(), expectedTicketId);
    assert.equal(logArgs.ticketOwner, goodTicketOwner);
    assert.equal(logArgs.leafHash, goodTree.leafHash);
    return logArgs.ticketId;
  }

  context('listTicket()', async () => {
    before(async () => {
      await generateGoodParams();
      await registerMerkleRootAndVendorOnEvent();
    });

    after(async () => {
      await eventsTestHelper.advanceTimeEndEventAndWithdrawDeposit(accounts.eventOwner, goodEventId);
    });

    async function listTicketFails(_eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _ticketOwnerProof,
        _merklePath, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.listTicket(_eventId, _vendorTicketRefHash, _ticketMetadata,
          _vendorProof, doorData, _ticketOwnerProof, _merklePath, {from: _sender}), _expectedError);
    }

    context('succeeds with', async () => {
      it('good parameters', async () => {
        await listTicketSucceeds();
      });
    });

    context('fails with', async () => {
      context('bad parameters', async () => {
        it('eventId', async () => {
          const badEventId = 0;
          const updatedVendorProof = signingTestHelper.getListTicketVendorProof(accounts.primary, badEventId,
              goodVendorTicketRefHash, goodTicketOwner);
          await listTicketFails(badEventId, goodVendorTicketRefHash, goodTicketMetadata, updatedVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodSender, 'Event must be trading');
        });

        // TODO: The below 4 tests fail with 'Merkle root is not active' presently because of the leafHash in listTicket A & B.
        // Once we have a single listTicket() method these can be revised to fail properly.
        it('vendorTicketRefHash', async () => {
          const badVendorTicketRefHash = testHelper.hash(0);
          const updatedVendorProof = signingTestHelper.getListTicketVendorProof(accounts.primary, goodEventId,
              badVendorTicketRefHash, goodTicketOwner);
          const updatedTicketOwnerProof = signingTestHelper.getListTicketTicketOwnerProof(goodTicketOwner,
              badVendorTicketRefHash);
          await listTicketFails(goodEventId, badVendorTicketRefHash, goodTicketMetadata, updatedVendorProof,
              updatedTicketOwnerProof, goodMerklePath, goodSender, 'Merkle root is not active');
        });

        it('ticketMetadata', async () => {
          const badTicketMetadata = '';
          await listTicketFails(goodEventId, goodVendorTicketRefHash, badTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodSender, 'Merkle root is not active');
        });

        it('vendorProof', async () => {
          const badVendorProof = testHelper.sign(accounts.badAddress, testHelper.hash(0));
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, badVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodSender, 'Merkle root is not active');
        });

        it('ticketOwnerProof', async () => {
          const badTicketOwnerProof = testHelper.sign(accounts.badAddress, testHelper.hash(0));
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              badTicketOwnerProof, goodMerklePath, goodSender, 'Merkle root is not active');
        });

        it('merklePath', async () => {
          const badMerklePath = [0,0,0,0];
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, badMerklePath, goodSender, 'Merkle root is not active');
        });

        it('sender', async () => {
          const badSender = accounts.badAddress;
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, goodMerklePath, badSender, 'Primary or protocol active broker only');
        });
      });
    });
  });
});