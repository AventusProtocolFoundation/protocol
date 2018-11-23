const eip55 = require('eip55');
const fs = require('fs');

const storageJsonFile = "./api/storage.json";

/**
 * @return TruffleContract for AventusStorage.
 * NOTE: Be aware that "at" returns a "thenable" contract that is not really a promise. It has a
 * "then" method and the storage methods:
 * see https://github.com/trufflesuite/truffle-contract/blob/develop/contract.js
 */
function getStorageContractFromJsonFile(_aventusStorage) {
  const rawdata = fs.readFileSync(storageJsonFile);
  return _aventusStorage.at(JSON.parse(rawdata).address);
}

function saveStorageContractToJsonFile(_aventusStorage) {
  const sAddress = _aventusStorage.address;
  const storageObject = { address: eip55.encode(sAddress), abi: _aventusStorage.abi };
  fs.writeFileSync(storageJsonFile, JSON.stringify(storageObject, null, 4));
}

module.exports = {
  getStorageContractFromJsonFile,
  saveStorageContractToJsonFile
};
