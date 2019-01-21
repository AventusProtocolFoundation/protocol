const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const IAventusStorage = artifacts.require('IAventusStorage');
const ProposalsManager = artifacts.require('ProposalsManager');
const EventsManager = artifacts.require('EventsManager');
const MerkleRootsManager = artifacts.require('MerkleRootsManager');
const Versioned = artifacts.require('Versioned');

// Libraries
const LEventsRoles = artifacts.require('LEventsRoles');
const LEventsEvents = artifacts.require('LEventsEvents');
const LEventsTickets = artifacts.require('LEventsTickets');
const LEvents = artifacts.require('LEvents');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const LEventsStorage = artifacts.require('LEventsStorage');
const LMerkleRootsStorage = artifacts.require('LMerkleRootsStorage');

// Proxies
const PEvents = artifacts.require('PEvents');
const PMerkleRoots = artifacts.require('PMerkleRoots');

module.exports = async function(_deployer, _network, _accounts) {
  console.log('*** Deploying Libraries (Part C)...');
  await deployLibraries(_deployer, _network);
  console.log('*** LIBRARIES PART C DEPLOY COMPLETE');
};

let deployLEvents;
let deployLMerkleRoots;
let version;

async function deployLibraries(_deployer, _network) {
  const developmentMode = _network === 'development' || _network === 'coverage' || _network === 'rinkeby';

  deployLEvents = developmentMode;
  deployLMerkleRoots = developmentMode;

  version = await common.getVersion(Versioned);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _network);
  await doDeployLMerkleRoots(_deployer, storageContract);
  await doDeployLEvents(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LEvents) {
    await _deployer.deploy(LEventsStorage);
    await librariesCommon.linkMultiple(_deployer, LEventsStorage, [LEvents, LEventsEvents, LEventsRoles, LEventsTickets]);
    await _deployer.deploy(LEventsRoles);
    await librariesCommon.linkMultiple(_deployer, LEventsRoles, [LEvents, LEventsTickets]);
    await _deployer.deploy(LEventsEvents);
    await _deployer.link(LEventsEvents, LEvents);
    await _deployer.deploy(LEventsTickets);
    await _deployer.link(LEventsTickets, LEvents);
  } else if (_library === LMerkleRoots) {
    await _deployer.deploy(LMerkleRootsStorage);
    await _deployer.link(LMerkleRootsStorage, LMerkleRoots);
  }
}

function doDeployLEvents(_deployer, _storage) {
  const libraryName = 'LEventsInstance';
  const proxyName = 'PEventsInstance';
  const library = LEvents;
  const proxy = PEvents;
  const deployLibraryAndProxy = deployLEvents;
  const dependents = [EventsManager, ProposalsManager];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLMerkleRoots(_deployer, _storage) {
  const libraryName = 'LMerkleRootsInstance';
  const proxyName = 'PMerkleRootsInstance';
  const library = LMerkleRoots;
  const proxy = PMerkleRoots;
  const deployLibraryAndProxy = deployLMerkleRoots;
  const dependents = [MerkleRootsManager, LEvents];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}