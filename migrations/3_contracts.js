const common = require('./common.js');

const eip55 = require('eip55');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");

const AVTManager = artifacts.require("AVTManager");
const AVTManagerInterface = artifacts.require("IAVTManager");

const ProposalsManager = artifacts.require("ProposalsManager");
const ProposalsManagerInterface = artifacts.require("IProposalsManager");

const AventitiesManager = artifacts.require("AventitiesManager");
const AventitiesManagerInterface = artifacts.require("IAventitiesManager");

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
let deployAventitiesManager;
let deployEventsManager;
let deployParameterRegistry;

let version;

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");

  const developmentMode = network === "development" || network === "coverage";

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployAVTManager = developmentMode;
  deployProposalsManager = developmentMode;
  deployAventitiesManager = developmentMode;
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
  .then(() => doDeployAventitiesManager(deployer, storage))
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
  .then(() => _storage.allowAccess("write", ProposalsManager.address))
}

function doDeployAVTManager(_deployer, _storage) {
  if (!deployAVTManager) return _deployer;

  return _deployer.deploy(AVTManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IAVTManager", AVTManagerInterface, AVTManager))
  .then(() => _storage.allowAccess("write", AVTManager.address))
  .then(() => _storage.allowAccess("transferAVT", AVTManager.address))
}

function doDeployAventitiesManager(_deployer, _storage) {
  if (!deployAventitiesManager) return _deployer;

  return _deployer.deploy(AventitiesManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IAventitiesManager", AventitiesManagerInterface, AventitiesManager))
  .then(() => _storage.allowAccess("write", AventitiesManager.address));
}

function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return _deployer;

  return _deployer.deploy(EventsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IEventsManager", EventsManagerInterface, EventsManager))
  .then(() => _storage.allowAccess("write", EventsManager.address));
}

function doDeployParameterRegistry(_deployer, _storage) {
  if (!deployParameterRegistry) return _deployer;

  return _deployer.deploy(ParameterRegistry, _storage.address)
  .then(() => _storage.allowAccess("write", ParameterRegistry.address))
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
