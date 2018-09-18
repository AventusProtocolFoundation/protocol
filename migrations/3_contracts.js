const common = require('./common.js');

const eip55 = require('eip55');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");

const AVTManager = artifacts.require("AVTManager");
const AVTManagerInterface = artifacts.require("IAVTManager");

const ProposalsManager = artifacts.require("ProposalsManager");
const ProposalsManagerInterface = artifacts.require("IProposalsManager");

const MembersManager = artifacts.require("MembersManager");
const MembersManagerInterface = artifacts.require("IMembersManager");

const EventsManager = artifacts.require("EventsManager");
const EventsManagerInterface = artifacts.require("IEventsManager");

const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const MerkleRootsManagerInterface = artifacts.require("IMerkleRootsManager");

const ParameterRegistry = artifacts.require("ParameterRegistry");
const abiPartLength = 16;

const Versioned = artifacts.require("Versioned");

module.exports = function(deployer, network, accounts) {
  return deployContracts(deployer, network)
  .then(() => console.log("*** CONTRACTS DEPLOY COMPLETE"));
};

let deployAVTManager;
let deployProposalsManager;
let deployMembersManager;
let deployEventsManager;
let deployMerkleRootsManager;
let deployParameterRegistry;

let version;

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");

  const developmentMode = network === "development" || network === "coverage";

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployAVTManager = developmentMode;
  deployProposalsManager = developmentMode;
  deployMembersManager = developmentMode;
  deployEventsManager = developmentMode;
  deployMerkleRootsManager = developmentMode;
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
  .then(() => doDeployMembersManager(deployer, storage))
  .then(() => doDeployEventsManager(deployer, storage))
  .then(() => doDeployMerkleRootsManager(deployer, storage))
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

function doDeployMembersManager(_deployer, _storage) {
  if (!deployMembersManager) return _deployer;

  return _deployer.deploy(MembersManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IMembersManager", MembersManagerInterface, MembersManager))
  .then(() => _storage.allowAccess("write", MembersManager.address));
}

function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return _deployer;

  return _deployer.deploy(EventsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IEventsManager", EventsManagerInterface, EventsManager))
  .then(() => _storage.allowAccess("write", EventsManager.address));
}

function doDeployMerkleRootsManager(_deployer, _storage) {
  if (!deployMerkleRootsManager) return _deployer;

  return _deployer.deploy(MerkleRootsManager, _storage.address)
  .then(() => saveInterfaceToStorage(_storage, "IMerkleRootsManager", MerkleRootsManagerInterface, MerkleRootsManager))
  .then(() => _storage.allowAccess("write", MerkleRootsManager.address));
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
