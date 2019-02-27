const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const IAventusStorage = artifacts.require('IAventusStorage');
const ProposalsManager = artifacts.require('ProposalsManager');
const AVTManager = artifacts.require('AVTManager');
const Versioned = artifacts.require('Versioned');

// Libraries
const LAventities = artifacts.require('LAventities');
const LMembers = artifacts.require('LMembers');
const LAventusTime = artifacts.require('LAventusTime');
const LAventusDLL = artifacts.require('LAventusDLL');
const LAventusDLLStorage = artifacts.require('LAventusDLLStorage');
const LAventusTimeMock = artifacts.require('LAventusTimeMock');
const LAventitiesChallenges = artifacts.require('LAventitiesChallenges');
const LProposalsEnact = artifacts.require('LProposalsEnact');
const LEventsTickets = artifacts.require('LEventsTickets');
const LEvents = artifacts.require('LEvents');
const LAVTManager = artifacts.require('LAVTManager');
const LProposalsVoting = artifacts.require('LProposalsVoting');
const LProposals = artifacts.require('LProposals');
const LEventsStorage = artifacts.require('LEventsStorage');
const LEventsEvents = artifacts.require('LEventsEvents');
const LMembersStorage = artifacts.require('LMembersStorage');
const LAVTStorage = artifacts.require('LAVTStorage');
const LMerkleRoots = artifacts.require('LMerkleRoots');

// Proxies
const PAventusTime = artifacts.require('PAventusTime');
const PAventusDLL = artifacts.require('PAventusDLL');
const PAVTManager = artifacts.require('PAVTManager');

module.exports = async function(_deployer, _network, _accounts) {
    console.log('*** Deploying Libraries (Part A)...');
    await deployLibraries(_deployer, _network);
    console.log('*** LIBRARIES PART A DEPLOY COMPLETE');
};

let deployLAventusTime;
let deployLAventusDLL;
let deployLAVTManager;
let deployLAventusTimeMock;
let version;

async function deployLibraries(_deployer, _network) {
  const developmentMode = _network === 'development' || _network === 'coverage' || _network === 'rinkeby';
  const notLiveMode = _network != 'live';

  deployLAventusTime = developmentMode;
  deployLAventusDLL = developmentMode;
  deployLAVTManager = developmentMode;
  deployLAventusTimeMock = notLiveMode;

  await doDeployVersion(_deployer);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _network);
  await doDeployLAventusTime(_deployer, storageContract);
  await doDeployLAventusDLL(_deployer, storageContract);
  await doDeployLAVTManager(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LAVTManager) {
    await _deployer.deploy(LAVTStorage);
    await _deployer.link(LAVTStorage, LAVTManager);
  }
  if (_library === LAventusDLL) {
    await _deployer.deploy(LAventusDLLStorage);
    await _deployer.link(LAventusDLLStorage, LAventusDLL);
  }
}

async function doDeployVersion(_deployer) {
  await _deployer.deploy(Versioned);
  version = await common.getVersion(Versioned);
}

async function doDeployLAventusTime(_deployer, _storage) {
  const libraryName = 'LAventusTimeInstance';
  const proxyName = 'PAventusTimeInstance';
  const library = LAventusTime;
  const proxy = PAventusTime;
  const deployLibraryAndProxy = deployLAventusTime;
  const dependents = [LProposals, LAVTManager, LEvents, LEventsTickets, ProposalsManager, LProposalsEnact, LMembers,
      LMembersStorage, LEventsStorage, LEventsEvents, LMerkleRoots];

  await librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName, proxyName,
      library, proxy, deployLibraryAndProxy, dependents);
  if (deployLAventusTimeMock) {
    await _deployer.deploy(LAventusTimeMock);
    await librariesCommon.setProxiedLibraryAddress(web3, version, _storage, libraryName, LAventusTimeMock.address);
  }
}

function doDeployLAventusDLL(_deployer, _storage) {
  const libraryName = 'LAventusDLLInstance';
  const proxyName = 'PAventusDLLInstance';
  const library = LAventusDLL;
  const proxy = PAventusDLL;
  const deployLibraryAndProxy = deployLAVTManager;
  const dependents = [LProposalsVoting, LAVTManager];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLAVTManager(_deployer, _storage) {
  const libraryName = 'LAVTManagerInstance';
  const proxyName = 'PAVTManagerInstance';
  const library = LAVTManager;
  const proxy = PAVTManager;
  const deployLibraryAndProxy = deployLAVTManager;
  const dependents = [LAventitiesChallenges, LProposalsVoting, LAventities, AVTManager, LProposalsEnact, LMerkleRoots];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}