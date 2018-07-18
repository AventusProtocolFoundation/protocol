const common = require('./common.js');

const eip55 = require('eip55');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");

const AVTManager = artifacts.require("AVTManager");
const AVTManagerInterface = artifacts.require("IAVTManager");

const ProposalsManager = artifacts.require("ProposalsManager");
const ProposalsManagerInterface = artifacts.require("IProposalsManager");

const AppsManager = artifacts.require("AppsManager");
const AppsManagerInterface = artifacts.require("IAppsManager");

const EventsManager = artifacts.require("EventsManager");
const EventsManagerInterface = artifacts.require("IEventsManager");

const ParameterRegistry = artifacts.require("ParameterRegistry");
const abiPartLength = 16;

const Versioned = artifacts.require("Versioned");

module.exports = function(deployer, network, accounts) {
  return deployContracts(deployer, network)
  .then(() => console.log("*** CONTRACTS DEPLOY COMPLETE"));
};

let deployAVTManager;
let deployProposalsManager;
let deployAppsManager;
let deployEventsManager;
let deployParameterRegistry;

let version;

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");

  const developmentMode = network === "development" || network === "coverage";

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployAVTManager = developmentMode;
  deployProposalsManager = developmentMode;
  deployAppsManager = developmentMode;
  deployEventsManager = developmentMode;
  deployParameterRegistry = developmentMode;

  let storage;

  return deployer
  .then(() => getVersion())
  .then(() => common.getStorageContractFromJsonFile(deployer, AventusStorage))
  .then(s => {
    storage = s;
    return doDeployProposalsManager(deployer, storage)
  })
  .then(() => doDeployAVTManager(deployer, storage))
  .then(() => doDeployAppsManager(deployer, storage))
  .then(() => doDeployEventsManager(deployer, storage))
  .then(() => doDeployParameterRegistry(deployer, storage));
}

function getVersion(_deployer) {
  return Versioned.deployed()
  .then(versioned => versioned.getVersionMajorMinor())
  .then(v => {
    version = v;
    console.log("Deploying contracts with version", version);
    return _deployer;
  });
}

function doDeployProposalsManager(_deployer, _storage) {
  if (!deployProposalsManager) return _deployer;

  return _deployer.deploy(ProposalsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IProposalsManager", ProposalsManagerInterface, ProposalsManager))
  .then(() => _storage.allowAccess(ProposalsManager.address))
}

function doDeployAVTManager(_deployer, _storage) {
  if (!deployAVTManager) return _deployer;

  return _deployer.deploy(AVTManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IAVTManager", AVTManagerInterface, AVTManager))
  .then(() => _storage.allowAccess(AVTManager.address))
}

function doDeployAppsManager(_deployer, _storage) {
  if (!deployAppsManager) return _deployer;

  return _deployer.deploy(AppsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IAppsManager", AppsManagerInterface, AppsManager))
  .then(() => _storage.allowAccess(AppsManager.address));
}

function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return _deployer;

  return _deployer.deploy(EventsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IEventsManager", EventsManagerInterface, EventsManager))
  .then(() => _storage.allowAccess(EventsManager.address));
}

function doDeployParameterRegistry(_deployer, _storage) {
  if (!deployParameterRegistry) return _deployer;

  return _deployer.deploy(ParameterRegistry, _storage.address)
  .then(() => _storage.allowAccess(ParameterRegistry.address))
  .then(() => ParameterRegistry.deployed())
  .then(parameterRegistry => parameterRegistry.setupDefaultParameters());
}

function saveInterfaceToStorage(s, interfaceName, interfaceInstance, implementation) {
  interfaceName += "-" + version;
  console.log("+ saveInterfaceToStorage", interfaceName);
  let numParts;
  return s.setAddress(web3.sha3(interfaceName + "_Address"), eip55.encode(implementation.address))
  .then(() => {
    numParts = Math.ceil(interfaceInstance.abi.length / abiPartLength);
    return s.setUInt(web3.sha3(interfaceName + "_Abi_NumParts"), numParts);
  })
  .then(() => {
    console.log("Splitting " + interfaceName + " ABI into", numParts);
    let abiPromises = [];
    for (let i = 0; i < numParts; ++i) {
      const start = i * abiPartLength;
      const end = start + abiPartLength;
      const part = JSON.stringify(interfaceInstance.abi.slice(start, end), null, 0);
      abiPromises.push(s.setString(web3.sha3(interfaceName + "_Abi_Part_" + i), part));
    }
    return Promise.all(abiPromises);
  });
}
