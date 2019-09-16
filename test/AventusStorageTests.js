const AventusStorageForTesting = artifacts.require('AventusStorageForTesting');
const ParameterRegistry = artifacts.require('ParameterRegistry');
const testHelper = require('./helpers/testHelper');
const avtTestHelper = require('./helpers/avtTestHelper');

contract('AventusStorage', async () => {
  let aventusStorage, parameterRegistry;
  const key = testHelper.hash('key');
  let accounts;

  before(async () => {
    await testHelper.init();

    parameterRegistry = await ParameterRegistry.deployed();
    aventusStorage = testHelper.getAventusStorage();

    accounts = testHelper.getAccounts('owner', 'newOwner', 'storageUser', 'avtAccount');
  });

  context('ParameterRegistry test', async () => {
    it('cannot reinitialise the ParameterRegistry', async () => {
      // The ParameterRegistry has already been initiailised at this stage via the migration script so:
      await testHelper.expectRevert(() => parameterRegistry.init({from:accounts.owner}),'Cannot reinit ParameterRegistry');
    });
  });

  context('AVT tests', async () => {
    const someAVTTokens = new testHelper.BN(100);
    let initialStorageBalance, initialOwnerBalance;

    before(async () => {
      await avtTestHelper.init(testHelper);
      initialStorageBalance = await avtTestHelper.totalBalance();
      initialOwnerBalance = await avtTestHelper.balanceOf(accounts.owner);
    });

    afterEach(async () => {
      testHelper.assertBNEquals(initialStorageBalance, await avtTestHelper.totalBalance());
      testHelper.assertBNEquals(initialOwnerBalance, await avtTestHelper.balanceOf(accounts.owner));
    });

    it ('can transfer AVT directly to and from storage if owner', async () => {
      await avtTestHelper.approve(someAVTTokens, accounts.owner);
      await aventusStorage.transferAVTFrom(accounts.owner, someAVTTokens);
      testHelper.assertBNEquals(await avtTestHelper.totalBalance(), initialStorageBalance.add(someAVTTokens));
      testHelper.assertBNEquals(await avtTestHelper.balanceOf(accounts.owner), initialOwnerBalance.sub(someAVTTokens));
      await aventusStorage.transferAVTTo(accounts.owner, someAVTTokens);
    });

    it ('can transfer AVT directly to and from storage if allowed', async () => {
      await aventusStorage.allowAccess('transferAVT', accounts.avtAccount);

      await avtTestHelper.approve(someAVTTokens, accounts.owner);
      await aventusStorage.transferAVTFrom(accounts.owner, someAVTTokens, {from:accounts.avtAccount});
      testHelper.assertBNEquals(await avtTestHelper.totalBalance(), initialStorageBalance.add(someAVTTokens));
      testHelper.assertBNEquals(await avtTestHelper.balanceOf(accounts.owner), initialOwnerBalance.sub(someAVTTokens));
      await aventusStorage.transferAVTTo(accounts.owner, someAVTTokens, {from:accounts.avtAccount});

      await aventusStorage.denyAccess('transferAVT', accounts.avtAccount);
    });

    it ('cannot transfer AVT directly to and from storage if not allowed', async () => {
      await avtTestHelper.approve(someAVTTokens, accounts.owner);
      await testHelper.expectRevert(() => aventusStorage.transferAVTFrom(accounts.owner, someAVTTokens,
          {from:accounts.avtAccount}), 'Access denied for storage');
      await aventusStorage.transferAVTFrom(accounts.owner, someAVTTokens);
      testHelper.assertBNEquals(await avtTestHelper.totalBalance(), initialStorageBalance.add(someAVTTokens));
      testHelper.assertBNEquals(await avtTestHelper.balanceOf(accounts.owner), initialOwnerBalance.sub(someAVTTokens));
      await testHelper.expectRevert(() => aventusStorage.transferAVTTo(accounts.owner, someAVTTokens,
          {from:accounts.avtAccount}), 'Access denied for storage');
      await aventusStorage.transferAVTTo(accounts.owner, someAVTTokens);
    });
  });

  context('Getting and setting storage values', async () => {
    it('can store and retrieve a uint value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await aventusStorage.getUInt(key), defaultValue);

      await aventusStorage.setUInt(key, testValue);
      assert.equal(await aventusStorage.getUInt(key), testValue);

      await aventusStorage.setUInt(key, defaultValue);
      assert.equal(await aventusStorage.getUInt(key), defaultValue);
    });

    it('can store and retrieve an address value from AventusStorage', async () => {
      const defaultValue = testHelper.zeroAddress;
      const testValue = aventusStorage.address;
      assert.equal(await aventusStorage.getAddress(key), defaultValue);

      await aventusStorage.setAddress(key, testValue);
      assert.equal(await aventusStorage.getAddress(key), testValue);

      await aventusStorage.setAddress(key, defaultValue);
      assert.equal(await aventusStorage.getAddress(key), defaultValue);
    });

    it('can store and retrieve a string value from AventusStorage', async () => {
      const defaultValue = '';
      const testValue = 'A Value String';
      assert.equal(await aventusStorage.getString(key), defaultValue);

      await aventusStorage.setString(key, testValue);
      assert.equal(await aventusStorage.getString(key), testValue);

      await aventusStorage.setString(key, defaultValue);
      assert.equal(await aventusStorage.getString(key), defaultValue);
    });

    it('can store and retrieve a bytes value from AventusStorage', async () => {
      // Bytes is a dynamic type of variable length.
      // Unlike fixed-size bytes, it is returned as a string and not as a number.
      // The default value is null
      const defaultValue = null;
      const zeroValue = '0x';
      const testValue = '0x123456';

      assert.equal(await aventusStorage.getBytes(key), defaultValue);

      await aventusStorage.setBytes(key, testValue);
      assert.equal(await aventusStorage.getBytes(key), testValue);

      await aventusStorage.setBytes(key, zeroValue);
      assert.equal(await aventusStorage.getBytes(key), defaultValue);
    });

    it('can store and retrieve a bytes32 value from AventusStorage', async () => {
      const defaultValue = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const testValue = '0x1234560000000000000000000000000000000000000000000000000000000000';

      assert.equal(await aventusStorage.getBytes32(key), defaultValue);

      await aventusStorage.setBytes32(key, testValue);
      assert.equal(await aventusStorage.getBytes32(key), testValue);

      await aventusStorage.setBytes32(key, defaultValue);
      assert.equal(await aventusStorage.getBytes32(key), defaultValue);
    });

    it('can store and retrieve an int value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = -1234;
      assert.equal(await aventusStorage.getInt(key), defaultValue);

      await aventusStorage.setInt(key, testValue);
      assert.equal(await aventusStorage.getInt(key), testValue);

      await aventusStorage.setInt(key, defaultValue);
      assert.equal(await aventusStorage.getInt(key), defaultValue);
    });

    it('can store and retrieve a boolean value from AventusStorage', async () => {
      const defaultValue = false;
      const testValue = true;
      assert.equal(await aventusStorage.getBoolean(key), defaultValue);

      await aventusStorage.setBoolean(key, testValue);
      assert.equal(await aventusStorage.getBoolean(key), testValue);

      await aventusStorage.setBoolean(key, defaultValue);
      assert.equal(await aventusStorage.getBoolean(key), defaultValue);
    });
  });

  context('Ownership and access rights', async () => {

    it('can set a new storage contract owner', async () => {
      assert.equal(await aventusStorage.owner(), accounts.owner);
      await aventusStorage.setOwner(accounts.newOwner);
      assert.equal(await aventusStorage.owner(), accounts.newOwner);

      // And the original owner should no longer be able to set it back to themselves
      await testHelper.expectRevert(() => aventusStorage.setOwner(accounts.owner, {from: accounts.owner}),
          'Sender must be owner');

      await aventusStorage.setOwner(accounts.owner, {from: accounts.newOwner});
    });

    it('cannot set a storage contract without an owner', async () => {
      assert.equal(await aventusStorage.owner(), accounts.owner);
      await testHelper.expectRevert(() => aventusStorage.setOwner(testHelper.zeroAddress), 'Owner cannot be zero address');
      assert.equal(await aventusStorage.owner(), accounts.owner);
    });

    it('can allow access', async () => {
      const defaultValue = 0;
      const testValue = 5;

      await testHelper.expectRevert(() => aventusStorage.setUInt(key, testValue, {from: accounts.storageUser}),
          'Access denied for storage');
      await aventusStorage.setUInt(key, testValue);
      assert.equal(await aventusStorage.getUInt(key), testValue);

      await testHelper.expectRevert(() => aventusStorage.setUInt(key, defaultValue, {from: accounts.storageUser}),
          'Access denied for storage');
      await aventusStorage.setUInt(key, defaultValue);
      assert.equal(await aventusStorage.getUInt(key), defaultValue);

      await aventusStorage.allowAccess('write', accounts.storageUser);

      // Now storageUser should have access right to update storage
      await aventusStorage.setUInt(key, testValue, {from: accounts.storageUser});
      assert.equal(await aventusStorage.getUInt(key), testValue);

      await aventusStorage.setUInt(key, defaultValue, {from: accounts.storageUser});
      assert.equal(await aventusStorage.getUInt(key), defaultValue);
    });

    it('can deny access', async () => {
      const defaultValue = 0;
      const testValue = 23;

      await aventusStorage.setUInt(key, defaultValue);
      assert.equal(await aventusStorage.getUInt(key), defaultValue);

      // Now deny storageUser its access rights
      await aventusStorage.denyAccess('write', accounts.storageUser);

      // And it should no longer be able to change the value from default
      await testHelper.expectRevert(() => aventusStorage.setUInt(key, testValue, {from: accounts.storageUser}),
          'Access denied for storage');
      assert.equal(await aventusStorage.getUInt(key), defaultValue);
    });

    it('can delegate new functionality', async () => {
      let aventusStorageForTesting = await AventusStorageForTesting.new();
      // create instance pointing to storage address in order to access methods
      let aventusStorageForTestingAsDelegate = await AventusStorageForTesting.at(aventusStorage.address);
      assert.ok(aventusStorageForTesting);
      assert.ok(aventusStorageForTestingAsDelegate);

      const testValue = 111;

      await testHelper.expectRevert(() => aventusStorageForTestingAsDelegate.setTestValue(testValue),
          'Extended functionality StorageContract not found');

      let msgHash = testHelper.hash('StorageInstance');
      await aventusStorage.setAddress(msgHash, aventusStorageForTesting.address);

      await aventusStorageForTestingAsDelegate.setTestValue(testValue);
      assert.equal((await aventusStorageForTestingAsDelegate.getTestValue()).toNumber(), testValue);
    });
  });
});
