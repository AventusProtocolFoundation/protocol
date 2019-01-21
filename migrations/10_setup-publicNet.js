const common = require('./common.js');
const avtsaleJson = require('./AVTSale.json');
const eip55 = require('eip55');

const Migrations = artifacts.require('Migrations');
const AventusStorage = artifacts.require('AventusStorage');

const storageJsonFile = './api/storagemain.json';
const mainNetAvtAddress = '0x0d88ed6e74bbfd96b831231638b66c05571e824f';

async function getStorageContract(_deployer, _network) {
  console.log('Using existing storage contract');
  const existingStorageContract = await common.getStorageContractFromJsonFile(AventusStorage, _network);
  console.log('AventusStorage:', existingStorageContract.address);
  return existingStorageContract;
}

async function checkAVTContract(_storage) {
  console.log('Using existing AVT ERC20 contract.');
  const avtAddress = await _storage.getAddress(web3.utils.sha3('AVTERC20Instance'));
  if (avtAddress == 0) {
    throw '***ERROR*** AVT ERC20 contract is not set in storage';
  }
  if (web3.toChecksumAddress(avtAddress) != web3.toChecksumAddress(mainNetAvtAddress)) {
    throw '***ERROR*** AVT ERC20 contract set in storage is wrong';
  }
  console.log('AVT ERC20 contract:', avtAddress);
}

module.exports = async function(_deployer, _network, _accounts) {
  if (_network != 'live') {
    console.log(`network ${_network} not supported by this migration script, skipping...`);
    return;
  }
  console.log('MAIN NET DEPLOYMENT');
  console.log('*** Version of web3: ', web3.version);
  console.log('*** Starting setup of storage and AVT contracts...');
  console.log('Deploying Migrations');
  await _deployer.deploy(Migrations);
  const storage = await getStorageContract(_deployer, _network);
  await checkAVTContract(storage);
  console.log('*** SETUP COMPLETE');
};