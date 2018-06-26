const eip55 = require('eip55');
const fs = require('fs');

const storageJsonFile = "./api/storage.json";

function getStorageContractFromJsonFile(deployer, aventusStorage) {
  const rawdata = fs.readFileSync(storageJsonFile);
  return deployer.then(() => aventusStorage.at(JSON.parse(rawdata).address));
}

function saveStorageContractToJsonFile(aventusStorage) {
  const sAddress = aventusStorage.address;
  const storageObject = { address: eip55.encode(sAddress), abi: aventusStorage.abi };
  fs.writeFileSync(storageJsonFile, JSON.stringify(storageObject, null, 4));
}

module.exports = {
  getStorageContractFromJsonFile,
  saveStorageContractToJsonFile
};
