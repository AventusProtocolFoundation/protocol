// Specifically request an abstraction for AventusStorage
const AventusStorage = artifacts.require("AventusStorage.sol");

contract('AventusStorage', function () {
    var avtStorage;

    before(async function () {
        avtStorage = await AventusStorage.new();
        assert.ok(avtStorage);
    });

    it("can store and retrieve UInt from AventusStorage", async function() {
        await avtStorage.setUInt("BobKing", 567);
        var uint = await avtStorage.getUInt("BobKing");
        assert.equal(uint, 567, "Expected value returned from storage!");

        await avtStorage.deleteUInt("BobKing");
        uint = await avtStorage.getUInt("BobKing");
        assert.equal(uint, 0, "Zero returned from storage!");
    });

    it("can store and retrieve Address from AventusStorage", async function() {
        await avtStorage.setAddress("BobKing", avtStorage.address);
        var addr = await avtStorage.getAddress("BobKing");
        assert.equal(addr, avtStorage.address, "Expected address value returned from storage");

        await avtStorage.deleteAddress("BobKing");
        addr = await avtStorage.getAddress("BobKing");
        assert.equal(addr, 0, "Zero returned from storage!");
    });

    it("can store and retrieve String from AventusStorage", async function() {
        await avtStorage.setString("BobKing", "Bob King");
        var str = await avtStorage.getString("BobKing");
        assert.equal(str, "Bob King", "Expected value returned from storage");

        await avtStorage.deleteString("BobKing");
        await avtStorage.setString("BobKing", "");
        var str = await avtStorage.getString("BobKing");
        assert.equal(str, "", "Expected value returned from storage");

        await avtStorage.deleteString("BobKing");
        str = await avtStorage.getString("BobKing");
        assert.equal(str, 0, "Zero returned from storage!");
    });

    it("can store and retrieve Bytes from AventusStorage", async function() {
        await avtStorage.setBytes("BobKing", "0x123456");
        var byteValue = await avtStorage.getBytes("BobKing");
        assert.equal(byteValue, "0x123456", "Expected address value returned from storage");

        await avtStorage.deleteBytes("BobKing");
        byteValue = await avtStorage.getBytes("BobKing");
        assert.equal(byteValue, "0x", "Zero returned from storage!");
    });

    it("can store and retrieve Bytes32 from AventusStorage", async function() {
        await avtStorage.setBytes32("BobKing",
                                    "0x1234560000000000000000000000000000000000000000000000000000000000");
        var byte32Value = await avtStorage.getBytes32("BobKing");
        assert.equal(byte32Value,
                     "0x1234560000000000000000000000000000000000000000000000000000000000",
                     "Expected address value returned from storage");

        await avtStorage.deleteBytes32("BobKing");
        byte32Value = await avtStorage.getBytes32("BobKing");
        assert.equal(byte32Value,
                     "0x0000000000000000000000000000000000000000000000000000000000000000",
                     "Zero returned from storage!");
    });

    it("can store and retrieve Int from AventusStorage", async function() {
        await avtStorage.setInt("BobKing", 1234);
        var value = await avtStorage.getInt("BobKing");
        assert.equal(value, 1234, "Expected value returned from storage");

        await avtStorage.deleteInt("BobKing");
        value = await avtStorage.getInt("BobKing");
        assert.equal(value, 0, "Zero returned from storage!");
    });

    it("can store and retrieve Boolean from AventusStorage", async function() {
        await avtStorage.setBoolean("BobKing", true);
        var bool = await avtStorage.getBoolean("BobKing");
        assert.equal(bool, true, "Expected value returned from storage");

        await avtStorage.deleteBoolean("BobKing");
        await avtStorage.setBoolean("BobKing", 9);
        var bool = await avtStorage.getBoolean("BobKing");
        assert.equal(bool, true, "Expected value returned from storage");

        await avtStorage.deleteBoolean("BobKing");
        await avtStorage.setBoolean("BobKing", 0);
        var bool = await avtStorage.getBoolean("BobKing");
        assert.notEqual(bool, true, "Expected value returned from storage");

        await avtStorage.deleteBoolean("BobKing");
        var bool = await avtStorage.getBoolean("BobKing");
        assert.equal(bool, 0, "Zero returned from storage!");
    });
});
