const common = require('./common.js');

const eip55 = require('eip55');
const fs = require('fs');

const IAventusStorage = artifacts.require("IAventusStorage");

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

module.exports = function(_deployer, _network, _accounts) {
  return deployContracts(_deployer, _network)
  .then(() => console.log("*** CONTRACTS DEPLOY COMPLETE"));
};

let deployAVTManager;
let deployProposalsManager;
let deployMembersManager;
let deployEventsManager;
let deployMerkleRootsManager;
let deployParameterRegistry;

let version;

function deployContracts(_deployer, _network) {
  console.log("Deploying Contracts...");

  const developmentMode = _network === "development" || _network === "coverage";

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployAVTManager = developmentMode;
  deployProposalsManager = developmentMode;
  deployMembersManager = developmentMode;
  deployEventsManager = developmentMode;
  deployMerkleRootsManager = developmentMode;
  deployParameterRegistry = developmentMode;

  let storage;

  return _deployer
  .then(() => getVersion())
  .then(() => common.getStorageContractFromJsonFile(IAventusStorage))
  .then(s => {
    storage = s;
    return doDeployProposalsManager(_deployer, storage)
  })
  .then(() => doDeployAVTManager(_deployer, storage))
  .then(() => doDeployMembersManager(_deployer, storage))
  .then(() => doDeployEventsManager(_deployer, storage))
  .then(() => doDeployMerkleRootsManager(_deployer, storage))
  .then(() => doDeployParameterRegistry(_deployer, storage));
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
  .then(parameterRegistry => parameterRegistry.init());
}

function saveInterfaceToStorage(_s, _interfaceName, _interfaceInstance, _implementation) {
  _interfaceName += "-" + version;
  console.log("+ saveInterfaceToStorage", _interfaceName);
  let numParts;
  return _s.setAddress(web3.sha3(_interfaceName + "_Address"), eip55.encode(_implementation.address))
  .then(() => {
    numParts = Math.ceil(_interfaceInstance.abi.length / abiPartLength);
    return _s.setUInt(web3.sha3(_interfaceName + "_Abi_NumParts"), numParts);
  })
  .then(() => {
    console.log("Splitting " + _interfaceName + " ABI into", numParts);
    let abiPromises = [];
    for (let i = 0; i < numParts; ++i) {
      const start = i * abiPartLength;
      const end = start + abiPartLength;
      const part = JSON.stringify(_interfaceInstance.abi.slice(start, end), null, 0);
      abiPromises.push(_s.setString(web3.sha3(_interfaceName + "_Abi_Part_" + i), part));
    }
    return Promise.all(abiPromises);
  });
}
