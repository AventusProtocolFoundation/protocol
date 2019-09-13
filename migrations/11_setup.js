const avtsaleJson = require('./AVTSale.json');
const common = require('./common.js');
const eip55 = require('eip55');
const binariesCheck = require('../tools/binariesCheck.js');

const Migrations = artifacts.require('Migrations');
const AventusStorage = artifacts.require('AventusStorage');
const AVTContractForTesting = artifacts.require('AVTContractForTesting');

// ALWAYS deploy storage and AVT ERC20 contracts by default.
const forceDeployStorage = ((process.env.FORCE_DEPLOY_STORAGE || 1) == 1);
const forceDeployAvtErc20 = ((process.env.FORCE_DEPLOY_AVTERC20 || 1) == 1);

const avtErc20InstanceKey = web3.utils.soliditySha3('AVTERC20Instance');

async function getExistingAVTContract(_storage) {
  console.log('Using existing AVT ERC20 contract');
  const avtErc20Address = await _storage.getAddress(avtErc20InstanceKey);
  if (avtErc20Address == 0) {
    throw '***ERROR*** can not re-use AVT ERC20 contract because it is not set in storage';
  }
  return avtErc20Address;
}

async function initTestNetAccountBalances(_accounts) {
  const ONE_ETH_IN_WEI = 10**18;
  const accountZero = _accounts[0];
  let index = _accounts.length;
  while(--index > 0) {
    const account = _accounts[index];
    const balance = await web3.eth.getBalance(account);
    if (balance < ONE_ETH_IN_WEI) {
      await web3.eth.sendTransaction({from: accountZero, to: account, value: ONE_ETH_IN_WEI - balance});
      console.log(" - Account", account, "topped up to 1 ETH");
    } else {
      console.log(" - Account", account, "balance is", balance);
    }
  }
}

async function initialDeploy(_deployer, _networkName) {
  await common.deploy(_deployer, Migrations);
  const storage = await getStorageContract(_deployer, _networkName);
  console.log('AventusStorage:', storage.address);
  let avtErc20Address;
  if (forceDeployAvtErc20) {
    avtErc20Address = (await common.deploy(_deployer, AVTContractForTesting)).address;
    await storage.setAddress(avtErc20InstanceKey, avtErc20Address);
  } else {
    avtErc20Address = await getExistingAVTContract(storage);
  }
  console.log('AVT ERC20:', avtErc20Address);
}

// Deploy a new (or use the old) storage contract.
async function getStorageContract(_deployer, _networkName) {
  if (forceDeployStorage) {
    console.log('Deploying storage contract');
    await common.deploy(_deployer, AventusStorage);
    console.log('...saving storage contract for reuse.');
    common.saveStorageContractToJsonFile(AventusStorage, _networkName);
    return await AventusStorage.deployed();
  } else {
    console.log('Using existing storage contract');
    const storage = common.getStorageContractFromJsonFile(AventusStorage, _networkName);
    return storage;
  }
}

function exitOnOversizeBinary() {
  if (!binariesCheck()) process.exit(1);
}

module.exports = async function(_deployer, _networkName, _accounts) {
  if (!_networkName.startsWith('coverage')) exitOnOversizeBinary();

  if (!common.isTestNetwork(_networkName)) {
    console.log(`test setup: network ${_networkName} not supported by this migration script, skipping...`);
    return _deployer;
  }
  console.log(_networkName.toUpperCase() + ' NETWORK DEPLOYMENT');
  console.log('*** Version of web3: ', web3.version);
  console.log('*** Starting setup...');

  if (!_networkName.startsWith('coverage') && !_networkName.startsWith('development'))
    await initTestNetAccountBalances(_accounts);

  await initialDeploy(_deployer, _networkName);
  console.log('*** SETUP COMPLETE');
};
