const FTScalingManagerExtension = artifacts.require('FTScalingManagerExtension');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const IERC1820Registry = artifacts.require('IERC1820Registry');
const MockERC777Token = artifacts.require('MockERC777Token');
const avtTestHelper = require('./helpers/avtTestHelper');
const merkleRootsTestHelper = require('./helpers/merkleRootsTestHelper');
const testHelper = require('./helpers/testHelper');
const timeTestHelper = require('./helpers/timeTestHelper');
const validatorsTestHelper = require('./helpers/validatorsTestHelper');
const merkleTreeHelper = require('../utils/merkleTreeHelper.js');

contract('FTScalingManager', async () => {
  const dummyBytes = '0x12345';

  let ftScalingManager, avt, erc1820Registry, mockERC777Token;
  let accounts;
  let erc20Amount = 100;
  let liftNonce, lowerNonce;
  let merkleTreesForCleanUp = [];
  let validatorDeposit, user1BalanceBefore;

  before(async () => {
    await testHelper.init();
    await avtTestHelper.init(testHelper);
    await timeTestHelper.init(testHelper);
    await merkleRootsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);
    await validatorsTestHelper.init(testHelper, avtTestHelper, timeTestHelper);

    ftScalingManager = await testHelper.getFTScalingManager();
    avt = await testHelper.getAVTIERC20();

    accounts = testHelper.getAccounts('user1', 'user2', 'validator');

    lowerNonce = 0;
    liftNonce = 0;

    user1BalanceBefore = await avt.balanceOf(accounts.user1);
    validatorDeposit = await validatorsTestHelper.depositAndRegisterValidator(accounts.validator);
    erc1820Registry = await IERC1820Registry.at('0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24');
    mockERC777Token = await MockERC777Token.deployed();
  });

  async function checkBalancesAreReset(_accounts) {
    for (const accountName in _accounts) {
      const account = _accounts[accountName];
      const balance = await avt.balanceOf(account);

      if (accountName == 'user1') {
        testHelper.assertBNEquals(balance, user1BalanceBefore);
      } else {
        testHelper.assertBNZero(balance);
      }
    }
    const ftScalingManagerBalance = await avt.balanceOf(ftScalingManager.address);
    testHelper.assertBNZero(ftScalingManagerBalance);
    const avtBalance = await avt.balanceOf(avt.address);
    testHelper.assertBNZero(avtBalance);
  }

  after(async () => {
    let giveBackToUser1 = validatorDeposit;
    for (var i in merkleTreesForCleanUp) {
      const merkleTree = merkleTreesForCleanUp[i];
      await merkleRootsTestHelper.advanceTimeUnlockAndWithdrawRootDeposit(merkleTree.rootHash, accounts.validator,
          merkleTree.deposit);
      giveBackToUser1.iadd(merkleTree.deposit);
    }
    await validatorsTestHelper.advanceToDeregistrationTime(accounts.validator, 'Validator');
    await validatorsTestHelper.deregisterValidatorAndWithdrawDeposit(accounts.validator);
    await avt.transfer(accounts.user1, giveBackToUser1, {from: accounts.validator});

    await avtTestHelper.checkBalancesAreZero(accounts);
    await checkBalancesAreReset(accounts);
  });

  function approveForLift(_lifter, _liftAmount) {
    return avt.approve(ftScalingManager.address, _liftAmount, {from: _lifter});
  }

  async function lift(_lifter, _liftAmount) {
    return ftScalingManager.lift(avt.address, _liftAmount, {from: _lifter});
  }

  async function approveAndLift(_lifter, _liftAmount) {
    await approveForLift(_lifter, _liftAmount);
    await lift(_lifter, _liftAmount);
  }

  function lower(_params) {
    return ftScalingManager.lower(_params.encodedTier2LeafData, _params.tier2MerklePath);
  }

  async function createGoodParamsAndLower(_tokenContract, _lowerer, _lowerAmount) {
    const leafData = createGoodLowerLeafData(_tokenContract, _lowerer, _lowerAmount);
    const params = await createLowerParamsAndRegisterMerkleRoot(leafData);
    await lower(params);
    return params;
  }

  function createGoodLowerLeafData(_tokenContract,_lowerer, _lowerAmount) {
    return merkleTreeHelper.getBaseFTLeaf(_tokenContract.address, _lowerer, ftScalingManager.address, _lowerAmount,
        lowerNonce++, dummyBytes);
  }

  async function createLowerParamsAndRegisterMerkleRoot(_leafData) {
    const encodedTier2LeafData = merkleTreeHelper.encodeFTLeaf(_leafData);
    const merkleTree = await merkleRootsTestHelper.createAndRegisterMerkleTree([encodedTier2LeafData, dummyBytes],
        accounts.validator);
    merkleTreesForCleanUp.push(merkleTree);
    return {
      encodedTier2LeafData,
      tier2MerklePath: merkleTree.merklePath,
    };
  }

  context('lift()', async () => {
    let lifter, liftAmount;

    before (async () => {
      lifter = accounts.user1;
    });

    context('succeeds', async () => {
      async function liftSucceeds() {
        assert.equal(await avt.balanceOf(ftScalingManager.address), 0);
        liftAmount = erc20Amount;
        await approveAndLift(lifter, liftAmount);

        const logArgs = await testHelper.getLogArgs(ftScalingManager, 'LogLifted');
        assert.equal(logArgs.tokenContract, avt.address);
        assert.equal(logArgs.lifter, lifter);
        assert.equal(logArgs.amount, liftAmount);
        assert.equal(logArgs.ftsmNonce, ++liftNonce);

        assert.equal(await avt.balanceOf(ftScalingManager.address), liftAmount);
      }

      afterEach(async () => {
        await createGoodParamsAndLower(avt, lifter, liftAmount);
      });

      it('with an amount', async () => {
        await liftSucceeds();
      });

      it('with same amount', async () => {
        await liftSucceeds();
      });

      it('with different amount', async () => {
        ++erc20Amount;
        await liftSucceeds();
      });
    });

    context('fails', async () => {

      async function liftFails(_msg) {
        await testHelper.expectRevert(() => lift(lifter, liftAmount), _msg);
      }

      it('insufficient ERC20 lifter funds.', async () => {
        liftAmount = (await avt.balanceOf(lifter)).add(testHelper.BN_ONE);
        await approveForLift(lifter, liftAmount);
        await liftFails('Insufficient funds');
      });

      it('lifter did not approve lift amount', async () => {
        liftAmount = 10000;
        await approveForLift(lifter, liftAmount - 1);
        await liftFails('Funds must be approved');
      });
    });
  });

  context('lower()', async () => {
    let lowerer, lowerAmount, lowerParams;

    before(() => {
      lowerer = accounts.user1;
      lowerAmount = testHelper.BN_ONE;
    });

    context('succeeds', async () => {
      beforeEach(async () => {
        lowerAmount = ++erc20Amount;
        liftNonce++;
        await approveAndLift(lowerer, lowerAmount);
      });

      async function lowerSucceeds() {
        assert.equal(await avt.balanceOf(ftScalingManager.address), lowerAmount);

        lowerParams = await createGoodParamsAndLower(avt, lowerer, lowerAmount);

        assert.equal(await avt.balanceOf(ftScalingManager.address), 0);

        const logArgs = await testHelper.getLogArgs(ftScalingManager, 'LogLowered');
        assert.equal(logArgs.tokenContract, avt.address);
        assert.equal(logArgs.lowerer, lowerer);
        assert.equal(logArgs.amount, lowerAmount);
        assert.deepEqual(logArgs.merklePath, lowerParams.tier2MerklePath);
      }

      it('with first use of leaf hash', async () => {
        lowerNonce++;
        await lowerSucceeds();
      });

      it('with same amount but different nonce', async () => {
        lowerNonce++;
        await lowerSucceeds();
      });
    });

    context('fails', async () => {
      async function lowerFails(_params, _msg) {
        await testHelper.expectRevert(() => lower(_params), _msg);
      }

      it('if replaying same tier 2 transaction', async () => {
        await lowerFails(lowerParams, 'Lower leaf hash must be unique');
      });

      context('different tier 2 transaction', async () => {
        let leafData;

        beforeEach(() => {
          leafData = createGoodLowerLeafData(avt, lowerer, lowerAmount);
        });

        it('but was not to the FTSM', async () => {
          leafData.to = lowerer;
          lowerParams = await createLowerParamsAndRegisterMerkleRoot(leafData);
          await lowerFails(lowerParams, 'Can only lower tier 2 transactions sent to this contract');
        });

        it('but transaction is not on a registered merkle tree', async () => {
          lowerParams = await createLowerParamsAndRegisterMerkleRoot(leafData);
          lowerParams.tier2MerklePath = [];
          await lowerFails(lowerParams, 'Tier 2 transaction must be registered on a merkle tree');
        });

      });

    });
  });

  context('ERC777 lift and lower', async () => {
    let lifter, lowerer, liftAndLowerAmount;
    const EMPTY_BYTES = '0x';
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    before(() => {
      lifter = accounts.user1;
      lowerer = accounts.user1;
      liftAndLowerAmount = 7;
    });

    async function erc777LiftSucceeds() {
      await mockERC777Token.send(ftScalingManager.address, liftAndLowerAmount, EMPTY_BYTES);

      const logArgs = await testHelper.getLogArgs(ftScalingManager, 'LogLifted');
      assert.equal(logArgs.tokenContract, mockERC777Token.address);
      assert.equal(logArgs.lifter, lifter);
      assert.equal(logArgs.amount, liftAndLowerAmount);
      assert.equal(logArgs.ftsmNonce, ++liftNonce);
    }

    async function erc777LowerSucceeds() {
      lowerParams = await createGoodParamsAndLower(mockERC777Token, lowerer, liftAndLowerAmount);

      let logArgs = await testHelper.getLogArgs(mockERC777Token, 'MockERC777Sent');
      assert.equal(logArgs.from, ftScalingManager.address);
      assert.equal(logArgs.to, lowerer);
      assert.equal(logArgs.amount, liftAndLowerAmount);
      assert.equal(logArgs.data, lowerParams.encodedTier2LeafData);

      logArgs = await testHelper.getLogArgs(ftScalingManager, 'LogLowered');
      assert.equal(logArgs.tokenContract, mockERC777Token.address);
      assert.equal(logArgs.lowerer, lowerer);
      assert.equal(logArgs.amount, liftAndLowerAmount);
      assert.deepEqual(logArgs.merklePath, lowerParams.tier2MerklePath);
    }

    context('succeeds', async () => {

      it('lift', async () => {
        await erc777LiftSucceeds();
      });

      it('lower', async () => {
        await erc777LowerSucceeds();
      });
    });

    context('fails', async () => {
      it('when receiving tokens from an account not registered as an ERC777 contract', async () => {
        await testHelper.expectRevert(() => ftScalingManager.tokensReceived(ZERO_ADDRESS, accounts.user1,
            ftScalingManager.address, 10, EMPTY_BYTES, EMPTY_BYTES), 'Must be registered as an ERC777 contract');
      });

      it('when receiving tokens not destined for itself', async () => {
        const ERC777_TOKEN_INTERFACE_HASH = web3.utils.soliditySha3('ERC777Token');
        await erc1820Registry.setInterfaceImplementer(accounts.user1, ERC777_TOKEN_INTERFACE_HASH, accounts.user1);
        await testHelper.expectRevert(() => ftScalingManager.tokensReceived(ZERO_ADDRESS, accounts.user1, accounts.user2, 10,
            EMPTY_BYTES, EMPTY_BYTES), 'Tokens must be sent to this contract');
      });
    });
  });

  context('Extensibility', async () => {
    let aventusStorage, ftScalingManagerExtension, ftScalingManagerExtensionAsDelegate;

    before(async () => {
      aventusStorage = await testHelper.getAventusStorage();
    });

    beforeEach(async () => {
      ftScalingManagerExtension = await getScalingManagerTestInstance();
      ftScalingManagerExtensionAsDelegate = await FTScalingManagerExtension.at(ftScalingManager.address);
      assert.ok(ftScalingManagerExtension);
      assert.ok(ftScalingManagerExtensionAsDelegate);
    });

    async function getScalingManagerTestInstance() {
      const merkleRootsLib = await LMerkleRoots.deployed();
      await FTScalingManagerExtension.link('LMerkleRoots', merkleRootsLib.address);
      return await FTScalingManagerExtension.new(aventusStorage.address);
    }

    it('can delegate new functionality', async () => {
      const testValue = 12345;
      const msgHash = await testHelper.hash('FTScalingManagerExtension');

      await testHelper.expectRevert(() => ftScalingManagerExtensionAsDelegate.setTestValue(testValue),
          'Extended functionality FTScalingManager not found');

      await aventusStorage.setAddress(msgHash, ftScalingManagerExtension.address);

      await ftScalingManagerExtensionAsDelegate.setTestValue(testValue);
      const v = await ftScalingManagerExtensionAsDelegate.getTestValue();
      assert.equal(v.toNumber(), testValue);
    });


    it('can delegate new functionality - storage', async () => {
      const testValue = 987654;
      await ftScalingManagerExtensionAsDelegate.setStorageTestValue(testValue);
      const v = await ftScalingManagerExtensionAsDelegate.getStorageTestValue();
      const storageValue = await aventusStorage.getUInt(testHelper.hash('FTScalingManagerExtension'));

      assert.equal(v.toNumber(), testValue);
      assert.equal(storageValue.toNumber(), testValue);
    });
  });

});
