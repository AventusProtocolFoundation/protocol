const common = require('./common.js');
const eip55 = require('eip55');
const fs = require('fs');

const IAventusStorage = artifacts.require('IAventusStorage');

const AVTManager = artifacts.require('AVTManager');
const AVTManagerInterface = artifacts.require('IAVTManager');

const ProposalsManager = artifacts.require('ProposalsManager');
const ProposalsManagerInterface = artifacts.require('IProposalsManager');

const MembersManager = artifacts.require('MembersManager');
const MembersManagerInterface = artifacts.require('IMembersManager');

const EventsManager = artifacts.require('EventsManager');
const EventsManagerInterface = artifacts.require('IEventsManager');

const MerkleRootsManager = artifacts.require('MerkleRootsManager');
const MerkleRootsManagerInterface = artifacts.require('IMerkleRootsManager');

const ParameterRegistry = artifacts.require('ParameterRegistry');
const abiPartLength = 16;

const Versioned = artifacts.require('Versioned');

module.exports = async function(_deployer, _network, _accounts) {
  await deployContracts(_deployer, _network);
  console.log('*** CONTRACTS DEPLOY COMPLETE');
};

let deployAVTManager;
let deployProposalsManager;
let deployMembersManager;
let deployEventsManager;
let deployMerkleRootsManager;
let deployParameterRegistry;

let version;

async function deployContracts(_deployer, _network) {
  console.log('Deploying Contracts...');
  const developmentMode = _network === 'development' || _network === 'coverage' || _network === 'rinkeby';

  // ALWAYS deploy to development, NEVER to another network unless hard coded.
  deployAVTManager = developmentMode;
  deployProposalsManager = developmentMode;
  deployMembersManager = developmentMode;
  deployEventsManager = developmentMode;
  deployMerkleRootsManager = developmentMode;
  deployParameterRegistry = developmentMode;

  version = await common.getVersion(Versioned);
  console.log('Deploying contracts with version', version);

  const storage = await common.getStorageContractFromJsonFile(IAventusStorage, _network);
  await doDeployProposalsManager(_deployer, storage);
  await doDeployAVTManager(_deployer, storage);
  await doDeployMembersManager(_deployer, storage);
  await doDeployEventsManager(_deployer, storage);
  await doDeployMerkleRootsManager(_deployer, storage);
  await doDeployParameterRegistry(_deployer, storage);
}

async function doDeployProposalsManager(_deployer, _storage) {
  if (!deployProposalsManager) return;
  await _deployer.deploy(ProposalsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IProposalsManager', ProposalsManagerInterface, ProposalsManager);
  await _storage.allowAccess('write', ProposalsManager.address);
}

async function doDeployAVTManager(_deployer, _storage) {
  if (!deployAVTManager) return;
  await _deployer.deploy(AVTManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IAVTManager', AVTManagerInterface, AVTManager);
  await _storage.allowAccess('write', AVTManager.address);
  await _storage.allowAccess('transferAVT', AVTManager.address);
}

async function doDeployMembersManager(_deployer, _storage) {
  if (!deployMembersManager) return;
  await _deployer.deploy(MembersManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IMembersManager', MembersManagerInterface, MembersManager);
  await _storage.allowAccess('write', MembersManager.address);
}

async function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return;
  await _deployer.deploy(EventsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IEventsManager', EventsManagerInterface, EventsManager);
  await _storage.allowAccess('write', EventsManager.address);
}

async function doDeployMerkleRootsManager(_deployer, _storage) {
  if (!deployMerkleRootsManager) return;
  await _deployer.deploy(MerkleRootsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IMerkleRootsManager', MerkleRootsManagerInterface, MerkleRootsManager);
  await _storage.allowAccess('write', MerkleRootsManager.address);
}

async function doDeployParameterRegistry(_deployer, _storage) {
  if (!deployParameterRegistry) return;
  await _deployer.deploy(ParameterRegistry, _storage.address);
  await _storage.allowAccess('write', ParameterRegistry.address);
  const parameterRegistry = await ParameterRegistry.deployed();
  await parameterRegistry.init();
}

async function saveInterfaceToStorage(_storage, _interfaceName, _interfaceInstance, _implementation) {
  const versionedInterfaceName = _interfaceName + '-' + version;
  console.log('+ saveInterfaceToStorage', versionedInterfaceName);
  await _storage.setAddress(web3.utils.sha3(versionedInterfaceName + '_Address'), eip55.encode(_implementation.address));
  const numParts = Math.ceil(_interfaceInstance.abi.length / abiPartLength);
  await _storage.setUInt(web3.utils.sha3(versionedInterfaceName + '_Abi_NumParts'), numParts);
  console.log('Splitting ' + versionedInterfaceName + ' ABI into', numParts);

  for (let i = 0; i < numParts; ++i) {
    const start = i * abiPartLength;
    const end = start + abiPartLength;
    const part = JSON.stringify(_interfaceInstance.abi.slice(start, end), null, 0);
    await _storage.setString(web3.utils.sha3(versionedInterfaceName + '_Abi_Part_' + i), part);
  }
}