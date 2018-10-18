// Specifically request an abstraction for AventusStorage
const AventusStorageForTesting = artifacts.require('AventusStorageForTesting');
const testHelper = require('./helpers/testHelper');
const web3Utils = require('web3-utils');

contract('AventusStorage', async () => {
  testHelper.profilingHelper.addTimeReports('AventusStorage');
  const owner = testHelper.getAccount(0);

  let avtStorage, avtERC20Contract;

  const key = 'key';

  before(async () => {
    await testHelper.before();
    avtStorage = testHelper.getStorage();
    avtERC20Contract = testHelper.getAVTContract();
  });

  context('AVT tests', async () => {
    const someAVTTokens = 100;
    const otherAccount = testHelper.getAccount(1);
    let initialStorageBalance, initialOwnerBalance;

    before(async () => {
      initialStorageBalance = (await avtERC20Contract.balanceOf(avtStorage.address)).toNumber();
      initialOwnerBalance = (await avtERC20Contract.balanceOf(owner)).toNumber();
    });

    afterEach(async () => {
      assert.equal(initialStorageBalance, (await avtERC20Contract.balanceOf(avtStorage.address)).toNumber());
      assert.equal(initialOwnerBalance, (await avtERC20Contract.balanceOf(owner)).toNumber());
    });

    it ('can transfer AVT directly to and from storage if owner', async () => {
      await avtERC20Contract.approve(avtStorage.address, someAVTTokens);
      await avtStorage.transferAVTFrom(owner, someAVTTokens);
      assert.equal((await avtERC20Contract.balanceOf(avtStorage.address)).toNumber(), initialStorageBalance + someAVTTokens);
      assert.equal((await avtERC20Contract.balanceOf(owner)).toNumber(), initialOwnerBalance - someAVTTokens);
      await avtStorage.transferAVTTo(owner, someAVTTokens);
    });

    it ('can transfer AVT directly to and from storage if allowed', async () => {
      await avtStorage.allowAccess("transferAVT", otherAccount);

      await avtERC20Contract.approve(avtStorage.address, someAVTTokens);
      await avtStorage.transferAVTFrom(owner, someAVTTokens, {from:otherAccount});
      assert.equal((await avtERC20Contract.balanceOf(avtStorage.address)).toNumber(), initialStorageBalance + someAVTTokens);
      assert.equal((await avtERC20Contract.balanceOf(owner)).toNumber(), initialOwnerBalance - someAVTTokens);
      await avtStorage.transferAVTTo(owner, someAVTTokens, {from:otherAccount});

      await avtStorage.denyAccess("transferAVT", otherAccount);
    });

     it ('cannot transfer AVT directly to and from storage if not allowed', async () => {
       await avtERC20Contract.approve(avtStorage.address, someAVTTokens);
       await testHelper.expectRevert(() => avtStorage.transferAVTFrom(owner, someAVTTokens, {from:otherAccount}));
       await avtStorage.transferAVTFrom(owner, someAVTTokens);
       assert.equal((await avtERC20Contract.balanceOf(avtStorage.address)).toNumber(), initialStorageBalance + someAVTTokens);
       assert.equal((await avtERC20Contract.balanceOf(owner)).toNumber(), initialOwnerBalance - someAVTTokens);
       await testHelper.expectRevert(() => avtStorage.transferAVTTo(owner, someAVTTokens, {from:otherAccount}));
       await avtStorage.transferAVTTo(owner, someAVTTokens);
     });
  });

  context('Getting and setting storage values', async () => {
    it('can store and retrieve a uint value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt(key), defaultValue);

      await avtStorage.setUInt(key, testValue);
      assert.equal(await avtStorage.getUInt(key), testValue);

      await avtStorage.setUInt(key, defaultValue);
      assert.equal(await avtStorage.getUInt(key), defaultValue);
    });

    it('can store and retrieve an address value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = avtStorage.address;
      assert.equal(await avtStorage.getAddress(key), defaultValue);

      await avtStorage.setAddress(key, testValue);
      assert.equal(await avtStorage.getAddress(key), testValue);

      await avtStorage.setAddress(key, defaultValue);
      assert.equal(await avtStorage.getAddress(key), defaultValue);
    });

    it('can store and retrieve a string value from AventusStorage', async () => {
      const defaultValue = '';
      const testValue = 'A Value String';
      assert.equal(await avtStorage.getString(key), defaultValue);

      await avtStorage.setString(key, testValue);
      assert.equal(await avtStorage.getString(key), testValue);

      await avtStorage.setString(key, defaultValue);
      assert.equal(await avtStorage.getString(key), defaultValue);
    });

    it('can store and retrieve a bytes value from AventusStorage', async () => {
      // Bytes is a dynamic type of variable length.
      // Unlike fixed-size bytes, it is returned as a string and not as a number.
      // The default value is represented by literal '0x'
      const defaultValue = '0x';
      const zeroValue = 0;
      const testValue = '0x123456';

      assert.equal(await avtStorage.getBytes(key), defaultValue);

      await avtStorage.setBytes(key, testValue);
      assert.equal(await avtStorage.getBytes(key), testValue);

      await avtStorage.setBytes(key, zeroValue);
      assert.equal(await avtStorage.getBytes(key), defaultValue);
    });

    it('can store and retrieve a bytes32 value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = '0x1234560000000000000000000000000000000000000000000000000000000000';

      assert.equal(await avtStorage.getBytes32(key), defaultValue);

      await avtStorage.setBytes32(key, testValue);
      assert.equal(await avtStorage.getBytes32(key), testValue);

      await avtStorage.setBytes32(key, defaultValue);
      assert.equal(await avtStorage.getBytes32(key), defaultValue);
    });

    it('can store and retrieve an int value from AventusStorage', async () => {
      const defaultValue = 0;
      const testValue = -1234;
      assert.equal(await avtStorage.getInt(key), defaultValue);

      await avtStorage.setInt(key, testValue);
      assert.equal(await avtStorage.getInt(key), testValue);

      await avtStorage.setInt(key, defaultValue);
      assert.equal(await avtStorage.getInt(key), defaultValue);
    });

    it('can store and retrieve a boolean value from AventusStorage', async () => {
      const defaultValue = false;
      const testValue = true;
      assert.equal(await avtStorage.getBoolean(key), defaultValue);

      await avtStorage.setBoolean(key, testValue);
      assert.equal(await avtStorage.getBoolean(key), testValue);

      await avtStorage.setBoolean(key, defaultValue);
      assert.equal(await avtStorage.getBoolean(key), defaultValue);
    });
  });

  context('Ownership and access rights - ', async () => {
    const newOwner = testHelper.getAccount(1);
    const account1 = testHelper.getAccount(2);

    it('can set a new storage contract owner', async () => {
      assert.equal(await avtStorage.owner(), owner);
      await avtStorage.setOwner(newOwner);
      assert.equal(await avtStorage.owner(), newOwner);

      // And the original owner should no longer be able to set it back to themselves
      await testHelper.expectRevert(() => avtStorage.setOwner(owner, {from: owner}));

      await avtStorage.setOwner(owner, {from: newOwner});
    });

    it('cannot set a storage contract without an owner', async () => {
      assert.equal(await avtStorage.owner(), owner);
      await testHelper.expectRevert(() => avtStorage.setOwner(0));
      assert.equal(await avtStorage.owner(), owner);
    });

    it('can allow access', async () => {
      const defaultValue = 0;
      const testValue = 5;

      await testHelper.expectRevert(() => avtStorage.setUInt(key, testValue, {from: account1}));
      await avtStorage.setUInt(key, testValue);
      assert.equal(await avtStorage.getUInt(key), testValue);

      await testHelper.expectRevert(() => avtStorage.setUInt(key, defaultValue, {from: account1}));
      await avtStorage.setUInt(key, defaultValue);
      assert.equal(await avtStorage.getUInt(key), defaultValue);

      await avtStorage.allowAccess("write", account1);

      // Now account1 should have access right to update storage
      await avtStorage.setUInt(key, testValue, {from: account1});
      assert.equal(await avtStorage.getUInt(key), testValue);

      await avtStorage.setUInt(key, defaultValue, {from: account1});
      assert.equal(await avtStorage.getUInt(key), defaultValue);
    });

    it('can deny access', async () => {
      const defaultValue = 0;
      const testValue = 23;

      await avtStorage.setUInt(key, defaultValue);
      assert.equal(await avtStorage.getUInt(key), defaultValue);

      // Now deny account1 its access rights
      await avtStorage.denyAccess("write", account1);

      // And it should no longer be able to change the value from default
      await testHelper.expectRevert(() => avtStorage.setUInt(key, testValue, {from: account1}));
      assert.equal(await avtStorage.getUInt(key), defaultValue);
    });

    it('can delegate new functionality', async () => {
      let avtStorageForTesting = await AventusStorageForTesting.new();
      // create instance pointing to storage address in order to access methods
      let avtStorageForTestingAsDelegate = await AventusStorageForTesting.at(avtStorage.address);
      assert.ok(avtStorageForTesting);
      assert.ok(avtStorageForTestingAsDelegate);

      const testValue = 111;

      await testHelper.expectRevert(() => avtStorageForTestingAsDelegate.setTestValue(testValue));

      keccak256Msg = web3Utils.soliditySha3("StorageInstance");
      await avtStorage.setAddress(keccak256Msg, avtStorageForTesting.address);

      await avtStorageForTestingAsDelegate.setTestValue(testValue);
      assert.equal((await avtStorageForTestingAsDelegate.getTestValue()).toNumber(), testValue);
    });
  });
});