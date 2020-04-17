const common = require('./common.js');
const eip55 = require('eip55');
const fs = require('fs');
const web3Tools = require('../utils/web3Tools.js');

const IAventusStorage = artifacts.require('IAventusStorage');

const AVTManager = artifacts.require('AVTManager');
const AVTManagerInterface = artifacts.require('IAVTManager');

const ProposalsManager = artifacts.require('ProposalsManager');
const ProposalsManagerInterface = artifacts.require('IProposalsManager');

const ValidatorsManager = artifacts.require('ValidatorsManager');
const ValidatorsManagerInterface = artifacts.require('IValidatorsManager');

const EventsManager = artifacts.require('EventsManager');
const EventsManagerInterface = artifacts.require('IEventsManager');

const MerkleRootsManager = artifacts.require('MerkleRootsManager');
const MerkleRootsManagerInterface = artifacts.require('IMerkleRootsManager');

const MerkleLeafChallenges = artifacts.require('MerkleLeafChallenges');
const MerkleLeafChallengesInterface = artifacts.require('IMerkleLeafChallenges');

const TimeMachine = artifacts.require('TimeMachine');
const TimeMachineInterface = artifacts.require('ITimeMachine');

const FTScalingManager = artifacts.require('FTScalingManager');
const FTScalingManagerInterface = artifacts.require('IFTScalingManager');

const ParameterRegistry = artifacts.require('ParameterRegistry');
const abiPartLength = 16;

const Versioned = artifacts.require('Versioned');

module.exports = async function(_deployer, _networkName, _accounts) {
  await deployContracts(_deployer, _networkName);
  console.log('*** CONTRACTS DEPLOY COMPLETE');
};

let deployAVTManager;
let deployProposalsManager;
let deployValidatorsManager;
let deployEventsManager;
let deployMerkleRootsManager;
let deployMerkleLeafChallenges;
let deployFTScalingManager;
let deployParameterRegistry;
let deployTimeMachine;

let version;

const proposalsOn = true; // See scripts/SwitchProposalsMode.js

const TWENTY_FOUR_HOURS = 24 * 60 * 60; // In seconds.

// TODO: This is copied from test/helpers/avtTestHelper - share this code.
function toAttoAVT(_amountInAVT) {
  const BN = web3Tools.BN;
  const oneAVTTo18SigFig = (new BN(10)).pow(new BN(18));
  const amountInAVT = new BN(_amountInAVT);
  return amountInAVT.mul(oneAVTTo18SigFig);
}

async function deployContracts(_deployer, _networkName) {
  console.log('Deploying Contracts...');
  const deployAll = common.deployAll(_networkName);

  deployAVTManager = deployAll;
  deployProposalsManager = proposalsOn && deployAll;
  deployValidatorsManager = deployAll;
  deployEventsManager = deployAll;
  deployMerkleRootsManager = deployAll;
  deployMerkleLeafChallenges = proposalsOn && deployAll;
  deployFTScalingManager = deployAll;
  deployParameterRegistry = deployAll;
  deployTimeMachine = common.mockTime(_networkName) && deployAll;

  version = await common.getVersion(Versioned);
  console.log('Deploying contracts with version', version);

  const storage = await common.getStorageContractFromJsonFile(IAventusStorage, _networkName);
  await doDeployProposalsManager(_deployer, storage);
  await doDeployAVTManager(_deployer, storage);
  await doDeployValidatorsManager(_deployer, storage);
  await doDeployEventsManager(_deployer, storage);
  await doDeployMerkleRootsManager(_deployer, storage);
  await doDeployMerkleLeafChallenges(_deployer, storage);
  await doDeployFTScalingManager(_deployer, storage);
  await doDeployParameterRegistry(_deployer, storage);
  await doDeployTimeMachine(_deployer, storage);
}

async function doDeployProposalsManager(_deployer, _storage) {
  if (!deployProposalsManager) return;
  await common.deploy(_deployer, ProposalsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IProposalsManager', ProposalsManagerInterface, ProposalsManager);
  await _storage.allowAccess('write', ProposalsManager.address);
}

async function doDeployAVTManager(_deployer, _storage) {
  if (!deployAVTManager) return;
  await common.deploy(_deployer, AVTManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IAVTManager', AVTManagerInterface, AVTManager);
  await _storage.allowAccess('write', AVTManager.address);
  await _storage.allowAccess('transferAVT', AVTManager.address);
}

async function doDeployValidatorsManager(_deployer, _storage) {
  if (!deployValidatorsManager) return;
  await common.deploy(_deployer, ValidatorsManager, _storage.address, proposalsOn);
  await saveInterfaceToStorage(_storage, 'IValidatorsManager', ValidatorsManagerInterface, ValidatorsManager);
  await _storage.allowAccess('write', ValidatorsManager.address);
}

async function doDeployEventsManager(_deployer, _storage) {
  if (!deployEventsManager) return;
  await common.deploy(_deployer, EventsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IEventsManager', EventsManagerInterface, EventsManager);
  await _storage.allowAccess('write', EventsManager.address);
}

async function doDeployMerkleRootsManager(_deployer, _storage) {
  if (!deployMerkleRootsManager) return;
  await common.deploy(_deployer, MerkleRootsManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IMerkleRootsManager', MerkleRootsManagerInterface, MerkleRootsManager);
  await _storage.allowAccess('write', MerkleRootsManager.address);
}

async function doDeployMerkleLeafChallenges(_deployer, _storage) {
  if (!deployMerkleLeafChallenges) return;
  await common.deploy(_deployer, MerkleLeafChallenges, _storage.address);
  await saveInterfaceToStorage(_storage, 'IMerkleLeafChallenges', MerkleLeafChallengesInterface, MerkleLeafChallenges);
  await _storage.allowAccess('write', MerkleLeafChallenges.address);
}

async function doDeployFTScalingManager(_deployer, _storage) {
  if (!deployFTScalingManager) return;
  await common.deploy(_deployer, FTScalingManager, _storage.address);
  await saveInterfaceToStorage(_storage, 'IFTScalingManager', FTScalingManagerInterface, FTScalingManager);
  await _storage.allowAccess('write', FTScalingManager.address);
  // TODO: Can be removed when we get registering with 1820 working in the constructor
  const ftScalingManager = await FTScalingManager.deployed();
  await ftScalingManager.init();
}

async function doDeployParameterRegistry(_deployer, _storage) {
  if (!deployParameterRegistry) return;
  await common.deploy(_deployer, ParameterRegistry, _storage.address);
  await _storage.allowAccess('write', ParameterRegistry.address);
  const parameterRegistry = await ParameterRegistry.deployed();
  await parameterRegistry.init();
}

async function doDeployTimeMachine(_deployer, _storage) {
  if (!deployTimeMachine) return;
  await common.deploy(_deployer, TimeMachine, _storage.address);
  await saveInterfaceToStorage(_storage, 'ITimeMachine', TimeMachineInterface, TimeMachine);
  await _storage.allowAccess('write', TimeMachine.address);
  const timeMachine = await TimeMachine.deployed();
  await timeMachine.init()
}

async function saveInterfaceToStorage(_storage, _interfaceName, _interfaceInstance, _implementation) {
  const versionedInterfaceName = _interfaceName + '-' + version;
  console.log('+ saveInterfaceToStorage', versionedInterfaceName);
  await _storage.setAddress(web3Tools.hash(versionedInterfaceName + '_Address'), eip55.encode(_implementation.address));
  const numParts = Math.ceil(_interfaceInstance.abi.length / abiPartLength);
  await _storage.setUInt(web3Tools.hash(versionedInterfaceName + '_Abi_NumParts'), numParts);
  console.log('Saving ' + versionedInterfaceName + ' ABI in', numParts, 'part(s)...');
  for (let i = 0; i < numParts; ++i) {
    const start = i * abiPartLength;
    const end = start + abiPartLength;
    const part = JSON.stringify(_interfaceInstance.abi.slice(start, end), null, 0);
    await _storage.setString(web3Tools.hash(versionedInterfaceName + '_Abi_Part_' + i), part);
  }
  console.log('- saveInterfaceToStorage', versionedInterfaceName);
}