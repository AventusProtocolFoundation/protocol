// Specifically request an abstraction for AventusStorage
const AventusStorage = artifacts.require('AventusStorage.sol');
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
      await avtStorage.setUInt(key, 567);
      let uint = await avtStorage.getUInt(key);
      assert.equal(uint, 567);

      await avtStorage.setUInt(key, 0);
      uint = await avtStorage.getUInt(key);
      assert.equal(uint, 0);
    });

    it('can store and retrieve UInt128 from AventusStorage', async function() {
      await avtStorage.setUInt128(key, 567);
      let uint128 = await avtStorage.getUInt128(key);
      assert.equal(uint128, 567);

      await avtStorage.setUInt128(key, 0);
      uint128 = await avtStorage.getUInt128(key);
      assert.equal(uint128, 0);
    });

    it('can store and retrieve UInt64 from AventusStorage', async function() {
      await avtStorage.setUInt64(key, 567);
      let uint64 = await avtStorage.getUInt64(key);
      assert.equal(uint64, 567);

      await avtStorage.setUInt64(key, 0);
      uint64 = await avtStorage.getUInt64(key);
      assert.equal(uint64, 0);
    });

    it('can store and retrieve UInt32 from AventusStorage', async function() {
      await avtStorage.setUInt32(key, 567);
      let uint32 = await avtStorage.getUInt32(key);
      assert.equal(uint32, 567);

      await avtStorage.setUInt32(key, 0);
      uint32 = await avtStorage.getUInt32(key);
      assert.equal(uint32, 0);
    });

    it('can store and retrieve UInt16 from AventusStorage', async function() {
      await avtStorage.setUInt16(key, 567);
      let uint16 = await avtStorage.getUInt16(key);
      assert.equal(uint16, 567);

      await avtStorage.setUInt16(key, 0);
      uint16 = await avtStorage.getUInt16(key);
      assert.equal(uint16, 0);
    });

    it('can store and retrieve UInt8 from AventusStorage', async function() {
      await avtStorage.setUInt8(key, 5);
      let uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 5);

      await avtStorage.setUInt8(key, 0);
      uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 0);
    });

    it('can store and retrieve UInt8 from AventusStorage with a permitted address', async function() {
      let account1 = testHelper.getAccount(1);

      await testHelper.expectRevert(() => avtStorage.setUInt8(key, 5, {from: account1}));
      await avtStorage.setUInt8(key, 5);
      let uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 5);

      await testHelper.expectRevert(() => avtStorage.setUInt8(key, 0, {from: account1}));
      await avtStorage.setUInt8(key, 0);
      uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 0);

      await avtStorage.allowAccess(account1);

      // Now account1 should have access right to update storage
      await avtStorage.setUInt8(key, 5, {from: account1});
      uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 5);

      await avtStorage.setUInt8(key, 0, {from: account1});
      uint8 = await avtStorage.getUInt8(key);
      assert.equal(uint8, 0);
    });
  });

  it('can store and retrieve Address from AventusStorage', async function() {
    await avtStorage.setAddress(key, avtStorage.address);
    let addr = await avtStorage.getAddress(key);
    assert.equal(addr, avtStorage.address);

    await avtStorage.setAddress(key, 0);
    addr = await avtStorage.getAddress(key);
    assert.equal(addr, 0);
  });

  it('can store and retrieve String from AventusStorage', async function() {
    await avtStorage.setString(key, 'A Value String');
    let str = await avtStorage.getString(key);
    assert.equal(str, 'A Value String');

    await avtStorage.setString(key, "");
    str = await avtStorage.getString(key);
    assert.equal(str, '');
  });

  context('Storage test for Bytes/8/16/32 - ', async () => {
    it('can store and retrieve Bytes from AventusStorage', async function() {
      await avtStorage.setBytes(key, '0x123456');
      let byteValue = await avtStorage.getBytes(key);
      assert.equal(byteValue, '0x123456');

      await avtStorage.setBytes(key, 0);
      byteValue = await avtStorage.getBytes(key);
      assert.equal(byteValue, '0x');
    });

    it('can store and retrieve Bytes32 from AventusStorage', async function() {
      const value = '0x1234560000000000000000000000000000000000000000000000000000000000';
      await avtStorage.setBytes32(key, value);
      let byte32Value = await avtStorage.getBytes32(key);
      assert.equal(byte32Value, value);

      await avtStorage.setBytes32(key, 0);
      byte32Value = await avtStorage.getBytes32(key);
      assert.equal(byte32Value, 0);
    });

    it('can store and retrieve Bytes16 from AventusStorage', async function() {
      const value = '0x12345600000000000000000000000000';
      await avtStorage.setBytes16(key, value);
      let actualValue = await avtStorage.getBytes16(key);
      assert.equal(actualValue, value);

      await avtStorage.setBytes16(key, 0);
      actualValue = await avtStorage.getBytes16(key);
      assert.equal(actualValue, '0x00000000000000000000000000000000');
    });

    it('can store and retrieve Bytes8 from AventusStorage', async function() {
      await avtStorage.setBytes8(key, '0x1234560000000000');
      let byte8Value = await avtStorage.getBytes8(key);
      assert.equal(byte8Value, '0x1234560000000000');

      await avtStorage.setBytes8(key, 0);
      byte8Value = await avtStorage.getBytes8(key);
      assert.equal(byte8Value, 0);
    });
  });

  context('Storage test for Int/8/16/32/64/128 - ', async () => {
    it('can store and retrieve Int from AventusStorage', async function() {
      await avtStorage.setInt(key, 1234);
      let value = await avtStorage.getInt(key);
      assert.equal(value, 1234);

      await avtStorage.setInt(key, 0);
      value = await avtStorage.getInt(key);
      assert.equal(value, 0);
    });

    it('can store and retrieve Int128 from AventusStorage', async function() {
      await avtStorage.setInt128(key, 567);
      let int128 = await avtStorage.getInt128(key);
      assert.equal(int128, 567);

      await avtStorage.setInt128(key, 0);
      int128 = await avtStorage.getInt128(key);
      assert.equal(int128, 0);
    });

    it('can store and retrieve Int64 from AventusStorage', async function() {
      await avtStorage.setInt64(key, 567);
      let int64 = await avtStorage.getInt64(key);
      assert.equal(int64, 567);

      await avtStorage.setInt64(key, 0);
      int64 = await avtStorage.getInt64(key);
      assert.equal(int64, 0);
    });

    it('can store and retrieve Int32 from AventusStorage', async function() {
      await avtStorage.setInt32(key, 567);
      let int32 = await avtStorage.getInt32(key);
      assert.equal(int32, 567);

      await avtStorage.setInt32(key, 0);
      int32 = await avtStorage.getInt32(key);
      assert.equal(int32, 0);
    });

    it('can store and retrieve Int16 from AventusStorage', async function() {
      await avtStorage.setInt16(key, 567);
      let int16 = await avtStorage.getInt16(key);
      assert.equal(int16, 567);

      await avtStorage.setInt16(key, 0);
      int16 = await avtStorage.getInt16(key);
      assert.equal(int16, 0);
    });

    it('can store and retrieve Int8 from AventusStorage', async function() {
      await avtStorage.setInt8(key, -7);
      let int8 = await avtStorage.getInt8(key);
      assert.equal(int8, -7);

      await avtStorage.setInt8(key, 0);
      int8 = await avtStorage.getInt8(key);
      assert.equal(int8, 0);
    });
  });

  // TODO: Rewrite all tests above to match this format.
  it('can store and retrieve Boolean from AventusStorage', async function() {
    const defaultValue = false;
    const testValue = true;
    assert.equal(await avtStorage.getBoolean(key), defaultValue);

    await avtStorage.setBoolean(key, testValue);
    assert.equal(await avtStorage.getBoolean(key), testValue);

    await avtStorage.setBoolean(key, false);
    assert.equal(await avtStorage.getBoolean(key), defaultValue);
  });
});
