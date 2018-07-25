// Specifically request an abstraction for AventusStorage
const AventusStorage = artifacts.require('AventusStorage.sol');
const AventusStorageForTesting = artifacts.require('AventusStorageForTesting');
const testHelper = require('./helpers/testHelper');

contract('AventusStorage', function() {
  let avtStorage;

  const key = 'key';

  before(async function() {
    avtStorage = await AventusStorage.new();
    assert.ok(avtStorage);
  });

  context('Storage test for uint8/16/32/64/128 - ', async () => {
    it('can store and retrieve UInt from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt(key), defaultValue);

      await avtStorage.setUInt(key, testValue);
      assert.equal(await avtStorage.getUInt(key), testValue);

      await avtStorage.setUInt(key, defaultValue);
      assert.equal(await avtStorage.getUInt(key), defaultValue);
    });

    it('can store and retrieve UInt128 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt128(key), defaultValue);

      await avtStorage.setUInt128(key, testValue);
      assert.equal(await avtStorage.getUInt128(key), testValue);

      await avtStorage.setUInt128(key, defaultValue);
      assert.equal(await avtStorage.getUInt128(key), defaultValue);
    });

    it('can store and retrieve UInt64 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt64(key), defaultValue);

      await avtStorage.setUInt64(key, testValue);
      assert.equal(await avtStorage.getUInt64(key), testValue);

      await avtStorage.setUInt64(key, defaultValue);
      assert.equal(await avtStorage.getUInt64(key), defaultValue);
    });

    it('can store and retrieve UInt32 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt32(key), defaultValue);

      await avtStorage.setUInt32(key, testValue);
      assert.equal(await avtStorage.getUInt32(key), testValue);

      await avtStorage.setUInt32(key, defaultValue);
      assert.equal(await avtStorage.getUInt32(key), defaultValue);
    });

    it('can store and retrieve UInt16 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getUInt16(key), defaultValue);

      await avtStorage.setUInt16(key, testValue);
      assert.equal(await avtStorage.getUInt16(key), testValue);

      await avtStorage.setUInt16(key, defaultValue);
      assert.equal(await avtStorage.getUInt16(key), defaultValue);
    });

    it('can store and retrieve UInt8 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 5;
      assert.equal(await avtStorage.getUInt8(key), defaultValue);

      await avtStorage.setUInt8(key, testValue);
      assert.equal(await avtStorage.getUInt8(key), testValue);

      await avtStorage.setUInt8(key, defaultValue);
      assert.equal(await avtStorage.getUInt8(key), defaultValue);
    });
  });

  it('can store and retrieve Address from AventusStorage', async function() {
    const defaultValue = 0;
    const testValue = avtStorage.address;
    assert.equal(await avtStorage.getAddress(key), defaultValue);

    await avtStorage.setAddress(key, testValue);
    assert.equal(await avtStorage.getAddress(key), testValue);

    await avtStorage.setAddress(key, defaultValue);
    assert.equal(await avtStorage.getAddress(key), defaultValue);
  });

  it('can store and retrieve String from AventusStorage', async function() {
    const defaultValue = '';
    const testValue = 'A Value String';
    assert.equal(await avtStorage.getString(key), defaultValue);

    await avtStorage.setString(key, testValue);
    assert.equal(await avtStorage.getString(key), testValue);

    await avtStorage.setString(key, defaultValue);
    assert.equal(await avtStorage.getString(key), defaultValue);
  });

  context('Storage test for Bytes/8/16/32 - ', async () => {
    it('can store and retrieve Bytes from AventusStorage', async function() {
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

    it('can store and retrieve Bytes32 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = '0x1234560000000000000000000000000000000000000000000000000000000000';

      assert.equal(await avtStorage.getBytes32(key), defaultValue);

      await avtStorage.setBytes32(key, testValue);
      assert.equal(await avtStorage.getBytes32(key), testValue);

      await avtStorage.setBytes32(key, defaultValue);
      assert.equal(await avtStorage.getBytes32(key), defaultValue);
    });

    it('can store and retrieve Bytes16 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = '0x12345600000000000000000000000000';

      assert.equal(await avtStorage.getBytes16(key), defaultValue);

      await avtStorage.setBytes16(key, testValue);
      assert.equal(await avtStorage.getBytes16(key), testValue);

      await avtStorage.setBytes16(key, defaultValue);
      assert.equal(await avtStorage.getBytes16(key), defaultValue);
    });

    it('can store and retrieve Bytes8 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = '0x1234560000000000';

      assert.equal(await avtStorage.getBytes8(key), defaultValue);

      await avtStorage.setBytes8(key, testValue);
      assert.equal(await avtStorage.getBytes8(key), testValue);

      await avtStorage.setBytes8(key, defaultValue);
      assert.equal(await avtStorage.getBytes8(key), defaultValue);
    });
  });

  context('Storage test for Int/8/16/32/64/128 - ', async () => {
    it('can store and retrieve Int from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 1234;
      assert.equal(await avtStorage.getInt(key), defaultValue);

      await avtStorage.setInt(key, testValue);
      assert.equal(await avtStorage.getInt(key), testValue);

      await avtStorage.setInt(key, defaultValue);
      assert.equal(await avtStorage.getInt(key), defaultValue);
    });

    it('can store and retrieve Int128 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getInt128(key), defaultValue);

      await avtStorage.setInt128(key, testValue);
      assert.equal(await avtStorage.getInt128(key), testValue);

      await avtStorage.setInt128(key, defaultValue);
      assert.equal(await avtStorage.getInt128(key), defaultValue);
    });

    it('can store and retrieve Int64 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getInt64(key), defaultValue);

      await avtStorage.setInt64(key, testValue);
      assert.equal(await avtStorage.getInt64(key), testValue);

      await avtStorage.setInt64(key, defaultValue);
      assert.equal(await avtStorage.getInt64(key), defaultValue);
    });

    it('can store and retrieve Int32 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getInt32(key), defaultValue);

      await avtStorage.setInt32(key, testValue);
      assert.equal(await avtStorage.getInt32(key), testValue);

      await avtStorage.setInt32(key, defaultValue);
      assert.equal(await avtStorage.getInt32(key), defaultValue);
    });

    it('can store and retrieve Int16 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = 567;
      assert.equal(await avtStorage.getInt16(key), defaultValue);

      await avtStorage.setInt16(key, testValue);
      assert.equal(await avtStorage.getInt16(key), testValue);

      await avtStorage.setInt16(key, defaultValue);
      assert.equal(await avtStorage.getInt16(key), defaultValue);
    });

    it('can store and retrieve Int8 from AventusStorage', async function() {
      const defaultValue = 0;
      const testValue = -7;
      assert.equal(await avtStorage.getInt8(key), defaultValue);

      await avtStorage.setInt8(key, testValue);
      assert.equal(await avtStorage.getInt8(key), testValue);

      await avtStorage.setInt8(key, defaultValue);
      assert.equal(await avtStorage.getInt8(key), defaultValue);
    });
  });

  it('can store and retrieve Boolean from AventusStorage', async function() {
    const defaultValue = false;
    const testValue = true;
    assert.equal(await avtStorage.getBoolean(key), defaultValue);

    await avtStorage.setBoolean(key, testValue);
    assert.equal(await avtStorage.getBoolean(key), testValue);

    await avtStorage.setBoolean(key, defaultValue);
    assert.equal(await avtStorage.getBoolean(key), defaultValue);
  });

  context('Ownership and access rights - ', async () => {
    const owner = testHelper.getAccount(0);
    const newOwner = testHelper.getAccount(1);
    const account1 = testHelper.getAccount(2);

    it('can set a new storage contract owner', async function() {
      assert.equal(await avtStorage.owner(), owner);
      await avtStorage.setOwner(newOwner);
      assert.equal(await avtStorage.owner(), newOwner);

      // And the original owner should no longer be able to set it back to themselves
      await testHelper.expectRevert(() => avtStorage.setOwner(owner, {from: owner}));

      await avtStorage.setOwner(owner, {from: newOwner});
    });

    it('cannot set a storage contract without an owner', async function() {
      assert.equal(await avtStorage.owner(), owner);
      await testHelper.expectRevert(() => avtStorage.setOwner(0));
      assert.equal(await avtStorage.owner(), owner);
    });

    it('can allow access', async function() {
      const defaultValue = 0;
      const testValue = 5;

      await testHelper.expectRevert(() => avtStorage.setUInt8(key, testValue, {from: account1}));
      await avtStorage.setUInt8(key, testValue);
      assert.equal(await avtStorage.getUInt8(key), testValue);

      await testHelper.expectRevert(() => avtStorage.setUInt8(key, defaultValue, {from: account1}));
      await avtStorage.setUInt8(key, defaultValue);
      assert.equal(await avtStorage.getUInt8(key), defaultValue);

      await avtStorage.allowAccess(account1);

      // Now account1 should have access right to update storage
      await avtStorage.setUInt8(key, testValue, {from: account1});
      assert.equal(await avtStorage.getUInt8(key), testValue);

      await avtStorage.setUInt8(key, defaultValue, {from: account1});
      assert.equal(await avtStorage.getUInt8(key), defaultValue);
    });

    it('can deny access', async function() {
      const defaultValue = 0;
      const testValue = 23;

      await avtStorage.setUInt8(key, defaultValue);
      assert.equal(await avtStorage.getUInt8(key), defaultValue);

      // Now deny account1 its access rights
      await avtStorage.denyAccess(account1);

      // And it should no longer be able to change the value from default
      await testHelper.expectRevert(() => avtStorage.setUInt8(key, testValue, {from: account1}));
      assert.equal(await avtStorage.getUInt8(key), defaultValue);
    });

    it('can delegate new functionality', async function() {
      let avtStorageForTesting = await AventusStorageForTesting.new();
      // create instance pointing to storage address in order to access methods
      let avtStorageForTestingAsDelegate = await AventusStorageForTesting.at(avtStorage.address);
      assert.ok(avtStorageForTesting);
      assert.ok(avtStorageForTestingAsDelegate);

      const testValue = 111;

      await testHelper.expectRevert(() => avtStorageForTestingAsDelegate.setTestValue(testValue));

      keccak256Msg = web3.sha3("StorageInstance");
      await avtStorage.setAddress(keccak256Msg, avtStorageForTesting.address);

      await avtStorageForTestingAsDelegate.setTestValue(testValue);
      assert.equal((await avtStorageForTestingAsDelegate.getTestValue()).toNumber(), testValue);
    });
  });
});
