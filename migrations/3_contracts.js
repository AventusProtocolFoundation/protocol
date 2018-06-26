const common = require('./common.js');

const eip55 = require('eip55');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");
const ProposalsManager = artifacts.require("AventusVote");
const AppsManager = artifacts.require("AppsManager");
const EventsManager = artifacts.require("EventsManager");
const ParameterRegistry = artifacts.require("ParameterRegistry");
const abiPartLength = 16;

module.exports = function(deployer, network, accounts) {
  return deployContracts(deployer, network).then(() => {
    console.log("*** CONTRACTS DEPLOY COMPLETE");
  });
};

function serializeObjectToJSON(fileName, object) {
  fs.writeFileSync(fileName, JSON.stringify(object, null, 4));
}

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");
  let s;
  return deployer.then(() => {
    return common.getStorageContractFromJsonFile(deployer, AventusStorage);
  }).then((_s) => {
    s = _s;
    if (network != "development") {
        try {
          fs.statSync("./api/aventusvote.json");
          console.log("AventusVote.json already exists! Skipping contract deployment.");
          return deployer;
        } catch (error) {
          // Continue.
        }
    }

    let numParts;
    return deployer.deploy([
      [ProposalsManager, s.address],
      [AppsManager, s.address],
      [EventsManager, s.address],
      [ParameterRegistry, s.address]
    ]).then(() => {
      return saveContractToStorage(s, "ProposalsManager", ProposalsManager);
    }).then(() => {
      return saveContractToStorage(s, "EventsManager", EventsManager);
    }).then(() => {
      return deployer.then(() => s.allowAccess(ProposalsManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(AppsManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(EventsManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(ParameterRegistry.address));
    }).then(() => {
      return ParameterRegistry.deployed();
    }).then((parameterRegistry) => {
      return deployer.then(() => parameterRegistry.setupDefaultParameters());
    });
  });
}

function saveContractToStorage(s, contractName, contract) {
  return s.setAddress(web3.sha3(contractName + "_Address"), eip55.encode(contract.address)).then(() => {
    numParts = Math.ceil(contract.abi.length / abiPartLength);
    return s.setUInt(web3.sha3(contractName + "_Abi_NumParts"), numParts);
  }).then(() => {
    console.log("Splitting " + contractName + " ABI into", numParts);
    let abiPromises = [];
    for (let i = 0; i < numParts; ++i) {
      const start = i * abiPartLength;
      const end = start + abiPartLength;
      const part = JSON.stringify(contract.abi.slice(start, end), null, 0);
      abiPromises.push(s.setString(web3.sha3(contractName + "_Abi_Part_" + i), part));
    }
    return Promise.all(abiPromises);
  });
}
