const avtsaleJson = require('./AVTSale.json');
const common = require('./common.js');
const eip55 = require('eip55');
const binariesCheck = require('../tools/binariesCheck.js');
const web3Tools = require('../utils/web3Tools.js');
const {singletons} = require('@openzeppelin/test-helpers');

const Migrations = artifacts.require('Migrations');
const AventusStorage = artifacts.require('AventusStorage');
const AVTContractForTesting = artifacts.require('AVTContractForTesting');

const mainNetAvtAddress = '0x0d88ed6e74bbfd96b831231638b66c05571e824f';
const initTestNetAccountBalances = false;  // Switch on if testing on, eg Rinkeby

// Deploy a new (or use the old) AVT contract.
// PRECONDITION: Storage must already be deployed.
async function getAVTContractAddress(_storage, _deployer, _networkName) {
  const avtErc20InstanceKey = web3Tools.hash('AVTERC20Instance');
  const forceDeployAvtErc20 = common.isPrivateNetwork(_networkName);

  if (common.isMainnet(_networkName) && forceDeployAvtErc20) {
    throw 'Do NOT force AVT deployment on mainnet!';
  }

  let avtErc20Address;
  avtErc20Address = await _storage.getAddress(avtErc20InstanceKey);

  if (avtErc20Address == 0) {
    console.log("Could not get AVT contract from storage");
  } else if (!forceDeployAvtErc20) {
    console.log('Using existing AVT contract');
    if (common.isMainnet(_networkName) &&
        web3.utils.toChecksumAddress(avtErc20Address) != web3.utils.toChecksumAddress(mainNetAvtAddress)) {
      throw 'AVT ERC20 contract set in mainnet storage is wrong!';
    }
    return avtErc20Address;
  }

  // Still here? Storage has no AVT contract set.

  try {
    await AventusStorage.deployed();
    console.log("AventusStorage has just been deployed.")
  } catch (e) {
    throw 'AventusStorage from previous deployment but it has no AVT contract set!';
  }

  if (common.isMainnet(_networkName)) {
    avtErc20Address = mainNetAvtAddress;
  } else {
    console.log ("Deploying AVT contract");
    avtErc20Address = (await common.deploy(_deployer, AVTContractForTesting)).address;
  }

  await _storage.setAddress(avtErc20InstanceKey, avtErc20Address);
  return avtErc20Address;
}

async function doInitTestNetAccountBalances(_accounts) {
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
      console.log(" - Account", account, "balance is ETH ", balance);
    }
  }
}

async function initialDeploy(_deployer, _networkName) {
  await common.deploy(_deployer, Migrations);
  const storage = await getStorageContract(_deployer, _networkName);
  console.log('AventusStorage:', storage.address);
  const avtErc20Address = await getAVTContractAddress(storage, _deployer, _networkName);
  console.log('AVT ERC20:', avtErc20Address);
}

// Deploy a new (or use the old) storage contract.
async function getStorageContract(_deployer, _networkName) {
  const forceDeployStorage = common.isPrivateNetwork(_networkName);

  let storage;
  try {
    storage = await common.getStorageContractFromJsonFile(AventusStorage, _networkName);
    if (!forceDeployStorage) {
      console.log('Using existing storage contract');
      return storage;
    }
  } catch (e) {
    console.log("Could not get contract from JSON file");
  }

  console.log('Deploying storage contract');
  storage = await common.deploy(_deployer, AventusStorage);
  console.log('Saving storage contract to JSON file');
  common.saveStorageContractToJsonFile(AventusStorage, _networkName);
  return storage;
}

function exitOnOversizeBinary() {
  if (!binariesCheck()) process.exit(1);
}

async function deploy1820AndMocks(_deployer, _networkName, _accounts) {
  if (!_networkName.startsWith('development')) {
    // TODO: Figure out why Docker needs this when no one else does.
    require('@openzeppelin/test-helpers/configure')({ provider: 'http://' + _networkName + ':8545' });
  }
  console.log('*** Deploying ERC1820Registry...');
  await singletons.ERC1820Registry(_accounts[0]);
  console.log('*** Deploying MockERC777Token...');
  const MockERC777Token = artifacts.require('MockERC777Token');
  await _deployer.deploy(MockERC777Token);
}

module.exports = async function(_deployer, _networkName, _accounts) {
  global.web3 = web3; // make web3Tools work for truffle migrate without --reset

  if (!_networkName.startsWith('coverage')) exitOnOversizeBinary();

  console.log(_networkName.toUpperCase() + ' NETWORK DEPLOYMENT');
  console.log('*** Version of web3: ', web3.version);
  console.log('*** Starting setup...');

  if (initTestNetAccountBalances) await doInitTestNetAccountBalances(_accounts);

  if (!_networkName.startsWith('rinkeby') && !_networkName.startsWith('mainnet')) {
    await deploy1820AndMocks(_deployer, _networkName, _accounts);
  }

  await initialDeploy(_deployer, _networkName);
  console.log('*** SETUP COMPLETE');
};
