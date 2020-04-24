const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const IAventusStorage = artifacts.require('IAventusStorage');
const ProposalsManager = artifacts.require('ProposalsManager');
const AVTManager = artifacts.require('AVTManager');
const Versioned = artifacts.require('Versioned');

// Libraries
const LValidators = artifacts.require('LValidators');
const LProtocolTime = artifacts.require('LProtocolTime');
const LProtocolTimeMock = artifacts.require('LProtocolTimeMock');
const LValidatorsChallenges = artifacts.require('LValidatorsChallenges');
const LProposalsEnact = artifacts.require('LProposalsEnact');
const LEvents = artifacts.require('LEvents');
const LAVTManager = artifacts.require('LAVTManager');
const LProposalsVoting = artifacts.require('LProposalsVoting');
const LProposals = artifacts.require('LProposals');
const LEventsStorage = artifacts.require('LEventsStorage');
const LEventsEvents = artifacts.require('LEventsEvents');
const LValidatorsStorage = artifacts.require('LValidatorsStorage');
const LAVTStorage = artifacts.require('LAVTStorage');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const TimeMachine = artifacts.require('TimeMachine');

// Proxies
const PProtocolTime = artifacts.require('PProtocolTime');
const PAVTManager = artifacts.require('PAVTManager');

module.exports = async function(_deployer, _networkName, _accounts) {
  global.web3 = web3; // make web3Tools work for truffle migrate without --reset
  console.log('*** Deploying Libraries (Part A)...');
  await deployLibraries(_deployer, _networkName);
  console.log('*** LIBRARIES PART A DEPLOY COMPLETE');
};

let deployLProtocolTime;
let deployLAVTManager;
let deployLProtocolTimeMock;
let version;

async function deployLibraries(_deployer, _networkName) {
  const deployAll = common.deployAll(_networkName);

  deployLProtocolTime = deployAll;
  deployLAVTManager = deployAll;
  deployLProtocolTimeMock = common.mockTime(_networkName) && deployAll;

  await doDeployVersion(_deployer);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _networkName);
  await doDeployLProtocolTime(_deployer, storageContract);
  await doDeployLAVTManager(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LAVTManager) {
    await common.deploy(_deployer, LAVTStorage);
    await _deployer.link(LAVTStorage, LAVTManager);
  }
}

async function doDeployVersion(_deployer) {
  await common.deploy(_deployer, Versioned);
  version = await common.getVersion(Versioned);
}

async function doDeployLProtocolTime(_deployer, _storage) {
  const libraryName = 'LProtocolTimeInstance';
  const proxyName = 'PProtocolTimeInstance';
  const library = LProtocolTime;
  const proxy = PProtocolTime;
  const deployLibraryAndProxy = deployLProtocolTime;
  const dependents = [LAVTStorage, LEventsEvents, LEvents, LEventsStorage, LValidators, LMerkleRoots, LProposalsEnact, LProposals];

  await librariesCommon.doDeployLibraryAndProxy(version, deploySubLibraries, _deployer, _storage, libraryName, proxyName,
      library, proxy, deployLibraryAndProxy, dependents);
  if (deployLProtocolTimeMock) {
    await common.deploy(_deployer, LProtocolTimeMock);
    await _deployer.link(LProtocolTimeMock, TimeMachine);
    await librariesCommon.setProxiedLibraryAddress(version, _storage, libraryName, LProtocolTimeMock.address);
  }
}

function doDeployLAVTManager(_deployer, _storage) {
  const libraryName = 'LAVTManagerInstance';
  const proxyName = 'PAVTManagerInstance';
  const library = LAVTManager;
  const proxy = PAVTManager;
  const deployLibraryAndProxy = deployLAVTManager;
  const dependents = [LValidatorsChallenges, LProposalsVoting, LValidators, AVTManager, LProposalsEnact, LMerkleRoots];

  return librariesCommon.doDeployLibraryAndProxy(version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}