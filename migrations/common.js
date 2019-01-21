const eip55 = require('eip55');
const fs = require('fs');
const path = require('path');

const storageJsonFilePath = path.join(__dirname, '..', '/api/');

/**
 * @return TruffleContract for AventusStorage.
 * NOTE: Be aware that 'at' returns a 'thenable' contract that is not really a promise. It has a
 * 'then' method and the storage methods:
 * see https://github.com/trufflesuite/truffle-contract/blob/develop/contract.js
 */
function getStorageContractFromJsonFile(_aventusStorage, _network = '') {
  const storageJsonFile = getStorageFileName(_network);
  const rawdata = fs.readFileSync(storageJsonFile);
  return _aventusStorage.at(JSON.parse(rawdata).address);
}

function getStorageContractDescriptor(_network = '') {
  const storageJsonFile = getStorageFileName(_network);
  const rawdata = fs.readFileSync(storageJsonFile);
  return JSON.parse(rawdata);
}

function saveStorageContractToJsonFile(_aventusStorage, _network = '') {
  const storageJsonFile = getStorageFileName(_network);
  const sAddress = _aventusStorage.address;
  const storageObject = { address: eip55.encode(sAddress), abi: _aventusStorage.abi };
  fs.writeFileSync(storageJsonFile, JSON.stringify(storageObject, null, 4));
}

function getStorageFileName(_network) {
  const networkSuffix = (_network === 'rinkeby' || _network === 'live') ? _network : '';
  return storageJsonFilePath + 'storage' + networkSuffix + '.json'
}

async function getVersion(versioned) {
  const versionedInstance = await versioned.deployed();
  const version = await versionedInstance.getVersionMajorMinor();
  console.log('Deploying libraries and proxies with version', version);
  return version;
}

module.exports = {
  getStorageContractFromJsonFile,
  saveStorageContractToJsonFile,
  getStorageContractDescriptor,
  getVersion
};
