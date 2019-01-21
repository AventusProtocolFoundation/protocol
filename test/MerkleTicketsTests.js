const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');
const eventsTestHelper = require('./helpers/eventsTestHelper');
const membersTestHelper = require('./helpers/membersTestHelper');
const merkleProofTestHelper = require('./helpers/merkleProofTestHelper');
const signingTestHelper = require('./helpers/signingTestHelper');
const timeTestHelper = require('./helpers/timeTestHelper');

contract('EventsManager - merkle tickets', async () => {
  let merkleRootsManager, eventsManager, accounts;
  const memberTypes = membersTestHelper.memberTypes;

  let goodEventId;
  let goodVendorTicketRefHash;
  let goodTicketMetadata;
  let goodVendorProof;
  let goodTicketOwnerProof;
  let goodMerklePath;
  let goodTree;
  let goodEventOwner;
  let goodTicketOwner;
  let goodValidatorAddress;
  let doorData = '0x';

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await membersTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await merkleProofTestHelper.init(testHelper);
    await signingTestHelper.init(testHelper);
    await eventsTestHelper.init(testHelper, timeTestHelper, avtTestHelper, signingTestHelper);

    merkleRootsManager = testHelper.getMerkleRootsManager();
    eventsManager = testHelper.getEventsManager();

    accounts = testHelper.getAccounts('eventOwner', 'validator', 'primary', 'ticketOwner', 'badAddress');
    goodTicketOwner = accounts.ticketOwner;

    await membersTestHelper.depositAndRegisterMember(accounts.validator, memberTypes.validator);
    goodEventId = await eventsTestHelper.createEvent(accounts.eventOwner);
    goodValidatorAddress = accounts.validator;
    await eventsManager.registerRoleOnEvent(goodEventId, goodValidatorAddress, eventsTestHelper.roles.validator,
        {from: accounts.eventOwner});
    await eventsManager.registerRoleOnEvent(goodEventId, accounts.primary, eventsTestHelper.roles.primary,
        {from: accounts.eventOwner});
    goodTicketMetadata = 'some metadata';
    goodEventOwner = accounts.eventOwner;
  });

  after(async () => {
    await membersTestHelper.deregisterMemberAndWithdrawDeposit(accounts.validator, memberTypes.validator);
    await avtTestHelper.checkFundsEmpty(accounts);
  });

  async function generateGoodParams() {
    goodVendorTicketRefHash = testHelper.randomBytes32();
    goodVendorProof = await signingTestHelper.getListTicketVendorProof(accounts.primary, goodEventId, goodVendorTicketRefHash,
        goodTicketOwner);
    goodTicketOwnerProof = await signingTestHelper.getListTicketTicketOwnerProof(goodTicketOwner, goodVendorTicketRefHash);
    const leafData = [goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodTicketOwner, goodVendorProof, doorData];
    const expectedTreeDepth = 12;
    goodTree = merkleProofTestHelper.createTree(expectedTreeDepth, leafData);
    goodMerklePath = goodTree.merklePath;
  }

  async function registerMerkleRoot() {
    await merkleRootsManager.registerMerkleRoot(goodTree.rootHash, {from: accounts.validator});
  }

  async function listTicketSucceeds(_sender) {
    await eventsManager.listTicket(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof, doorData,
        goodTicketOwnerProof, goodMerklePath, {from: _sender});

    const expectedTicketId = new testHelper.toBN(testHelper.hash(goodVendorTicketRefHash, accounts.primary));
    const logArgs = await testHelper.getLogArgs(eventsManager, 'LogTicketListed');
    testHelper.assertBNEquals(logArgs.eventId, goodEventId);
    testHelper.assertBNEquals(logArgs.ticketId, expectedTicketId);
    assert.equal(logArgs.ticketOwner, goodTicketOwner);
    assert.equal(logArgs.leafHash, goodTree.leafHash);
    return logArgs.ticketId;
  }

  context('listTicket()', async () => {
    async function listTicketFails(_eventId, _vendorTicketRefHash, _ticketMetadata, _vendorProof, _ticketOwnerProof,
        _merklePath, _sender, _expectedError) {
      await testHelper.expectRevert(() => eventsManager.listTicket(_eventId, _vendorTicketRefHash, _ticketMetadata,
          _vendorProof, doorData, _ticketOwnerProof, _merklePath, {from: _sender}), _expectedError);
    }

    context('succeeds with good parameters', async () => {
      beforeEach(async () => {
        await generateGoodParams();
        await registerMerkleRoot();
      });

      it('via event owner', async () => {
        await listTicketSucceeds(goodEventOwner);
      });

      it('via validator', async () => {
        await listTicketSucceeds(goodValidatorAddress);
      });
    });

    context('fails with', async () => {
      before(async () => {
        await generateGoodParams();
        await registerMerkleRoot();
      });
      
      context('bad parameters', async () => {
        it('eventId', async () => {
          const badEventId = 0;
          const updatedVendorProof = await signingTestHelper.getListTicketVendorProof(accounts.primary, badEventId,
              goodVendorTicketRefHash, goodTicketOwner);
          await listTicketFails(badEventId, goodVendorTicketRefHash, goodTicketMetadata, updatedVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodEventOwner, 'Event must be trading');
        });

        // TODO: The below 4 tests fail with 'Merkle root is not active' presently because of the leafHash in listTicket A & B.
        // Once we have a single listTicket() method these can be revised to fail properly.
        it('vendorTicketRefHash', async () => {
          const badVendorTicketRefHash = testHelper.hash(0);
          const updatedVendorProof = await signingTestHelper.getListTicketVendorProof(accounts.primary, goodEventId,
              badVendorTicketRefHash, goodTicketOwner);
          const updatedTicketOwnerProof = await signingTestHelper.getListTicketTicketOwnerProof(goodTicketOwner,
              badVendorTicketRefHash);
          await listTicketFails(goodEventId, badVendorTicketRefHash, goodTicketMetadata, updatedVendorProof,
              updatedTicketOwnerProof, goodMerklePath, goodEventOwner, 'Merkle root is not active');
        });

        it('ticketMetadata', async () => {
          const badTicketMetadata = '';
          await listTicketFails(goodEventId, goodVendorTicketRefHash, badTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodEventOwner, 'Merkle root is not active');
        });

        it('vendorProof', async () => {
          const badVendorProof = await testHelper.sign(accounts.badAddress, testHelper.hash(0));
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, badVendorProof,
              goodTicketOwnerProof, goodMerklePath, goodEventOwner, 'Merkle root is not active');
        });

        it('ticketOwnerProof', async () => {
          const badTicketOwnerProof = await testHelper.sign(accounts.badAddress, testHelper.hash(0));
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              badTicketOwnerProof, goodMerklePath, goodEventOwner, 'Merkle root is not active');
        });

        it('merklePath', async () => {
          const hash = testHelper.randomBytes32();
          const badMerklePath = [hash, hash, hash, hash];
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, badMerklePath, goodEventOwner, 'Merkle root is not active');
        });

        it('sender', async () => {
          const badSender = accounts.badAddress;
          await listTicketFails(goodEventId, goodVendorTicketRefHash, goodTicketMetadata, goodVendorProof,
              goodTicketOwnerProof, goodMerklePath, badSender, 'Sender must be validator or vendor on event');
        });
      });
    });
  });
});