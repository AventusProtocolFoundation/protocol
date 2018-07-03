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

let deployProposalsManager;
let deployAppsManager;
let deployEventsManager;
let deployParameterRegistry;

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");

  const developmentMode = network === "development";

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployProposalsManager = developmentMode;
  deployAppsManager = developmentMode;
  deployEventsManager = developmentMode;
  deployParameterRegistry = developmentMode;

  return deployer.then(() => {
    return common.getStorageContractFromJsonFile(deployer, AventusStorage);
  }).then((_s) => {
    const storage = _s;
    return doDeployProposalsManager(deployer, storage)
    .then(() => {
      return doDeployAppsManager(deployer, storage);
    }).then(() => {
      return doDeployEventsManager(deployer, storage);
    }).then(() => {
      return doDeployParameterRegistry(deployer, storage);
    });
  });
}

function doDeployProposalsManager(_deployer, _storage) {
  if (!deployProposalsManager) return _deployer;

  return _deployer.deploy(ProposalsManager, _storage.address).then(() => {
    return saveContractToStorage(_storage, "ProposalsManager", ProposalsManager);
  }).then(() => {
    return _deployer.then(() => _storage.allowAccess(ProposalsManager.address));
  });
}

function doDeployAppsManager(_deployer, _storage) {
  if (!deployAppsManager) return _deployer;

  return _deployer.deploy(AppsManager, _storage.address).then(() => {
    return saveContractToStorage(_storage, "AppsManager", AppsManager);
  }).then(() => {
    return _deployer.then(() => _storage.allowAccess(AppsManager.address));
  });
}

function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return _deployer;

  return _deployer.deploy(EventsManager, _storage.address)
  .then(() => {
    return saveContractToStorage(_storage, "EventsManager", EventsManager);
  }).then(() => {
    return _deployer.then(() => _storage.allowAccess(EventsManager.address));
  });
}

function doDeployParameterRegistry(_deployer, _storage) {
  if (!deployParameterRegistry) return _deployer;

  return _deployer.deploy(ParameterRegistry, _storage.address)
  .then(() => {
    return _deployer.then(() => _storage.allowAccess(ParameterRegistry.address));
  }).then(() => {
    return ParameterRegistry.deployed();
  }).then((parameterRegistry) => {
    return _deployer.then(() => parameterRegistry.setupDefaultParameters());
  });
}

function saveContractToStorage(s, contractName, contract) {
  console.log("+ saveContractToStorage", contractName);
  let numParts;
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
