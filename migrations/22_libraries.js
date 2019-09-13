const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const IAventusStorage = artifacts.require('IAventusStorage');
const EventsManager = artifacts.require('EventsManager');
const MerkleRootsManager = artifacts.require('MerkleRootsManager');
const MerkleLeafChallenges = artifacts.require('MerkleLeafChallenges');
const Versioned = artifacts.require('Versioned');

// Libraries
const LEventsRoles = artifacts.require('LEventsRoles');
const LEventsRules = artifacts.require('LEventsRules');
const LEventsEvents = artifacts.require('LEventsEvents');
const LEvents = artifacts.require('LEvents');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const LEventsStorage = artifacts.require('LEventsStorage');
const LMerkleRootsStorage = artifacts.require('LMerkleRootsStorage');
const LMerkleLeafChallenges = artifacts.require('LMerkleLeafChallenges');
const LMerkleLeafChecks = artifacts.require('LMerkleLeafChecks');
const LMerkleLeafRules = artifacts.require('LMerkleLeafRules');
const LzKSNARKVerifier = artifacts.require('zokrates/LzKSNARKVerifier');

// Proxies
const PEvents = artifacts.require('PEvents');
const PMerkleRoots = artifacts.require('PMerkleRoots');
const PMerkleLeafChallenges = artifacts.require('PMerkleLeafChallenges');

module.exports = async function(_deployer, _networkName, _accounts) {
  console.log('*** Deploying Libraries (Part C)...');
  await deployLibraries(_deployer, _networkName);
  console.log('*** LIBRARIES PART C DEPLOY COMPLETE');
};

let deployLEvents;
let deployLMerkleRoots;
let deployLMerkleLeafChallenges;
let version;

async function deployLibraries(_deployer, _networkName) {
  const developmentMode = common.isTestNetwork(_networkName);

  deployLEvents = developmentMode;
  deployLMerkleRoots = developmentMode;
  deployLMerkleLeafChallenges = developmentMode;

  version = await common.getVersion(Versioned);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _networkName);
  await doDeployLEvents(_deployer, storageContract);
  await doDeployLMerkleRoots(_deployer, storageContract);
  await doDeployLMerkleLeafChallenges(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LEvents) {
    await common.deploy(_deployer, LEventsStorage);
    await librariesCommon.linkMultiple(_deployer, LEventsStorage, [LEventsEvents, LEventsRoles]);
    await common.deploy(_deployer, LEventsEvents);
    await librariesCommon.linkMultiple(_deployer, LEventsEvents, [LEvents, LEventsRoles]);
    await common.deploy(_deployer, LEventsRules);
    await _deployer.link(LEventsRules, LEvents);
    await common.deploy(_deployer, LEventsRoles);
    await _deployer.link(LEventsRoles, LEvents)
  } else if (_library === LMerkleRoots) {
    await common.deploy(_deployer, LMerkleRootsStorage);
    await _deployer.link(LMerkleRootsStorage, LMerkleRoots);
  } else if (_library === LMerkleLeafChallenges) {
    await common.deploy(_deployer, LMerkleLeafRules);
    await _deployer.link(LMerkleLeafRules, LMerkleLeafChecks);
    await common.deploy(_deployer, LzKSNARKVerifier);
    await _deployer.link(LzKSNARKVerifier, LMerkleLeafChecks);
    await common.deploy(_deployer, LMerkleLeafChecks);
    await _deployer.link(LMerkleLeafChecks, LMerkleLeafChallenges);
  }
}

function doDeployLEvents(_deployer, _storage) {
  const libraryName = 'LEventsInstance';
  const proxyName = 'PEventsInstance';
  const library = LEvents;
  const proxy = PEvents;
  const deployLibraryAndProxy = deployLEvents;
  const dependents = [EventsManager, LMerkleRoots, LMerkleLeafChallenges, LMerkleLeafChecks];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLMerkleRoots(_deployer, _storage) {
  const libraryName = 'LMerkleRootsInstance';
  const proxyName = 'PMerkleRootsInstance';
  const library = LMerkleRoots;
  const proxy = PMerkleRoots;
  const deployLibraryAndProxy = deployLMerkleRoots;
  const dependents = [MerkleRootsManager, LMerkleLeafChallenges, LMerkleLeafChecks];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

async function doDeployLMerkleLeafChallenges(_deployer, _storage) {
  const libraryName = 'LMerkleLeafChallengesInstance';
  const proxyName = 'PMerkleLeafChallengesInstance';
  const library = LMerkleLeafChallenges;
  const proxy = PMerkleLeafChallenges;
  const deployLibraryAndProxy = deployLMerkleLeafChallenges;
  const dependents = [MerkleLeafChallenges, LzKSNARKVerifier];

  await librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);

  // Special case for direct call between libraries.
  const lMerkleLeafChecks = await LMerkleLeafChecks.deployed();
  if (lMerkleLeafChecks) {
    const lMerkleLeafChecksAddressKey = web3.utils.soliditySha3('LMerkleLeafChecksAddress');
    await _storage.setAddress(lMerkleLeafChecksAddressKey, lMerkleLeafChecks.address);
  } // else LMerkleLeafChecks was not deployed this time, keep the old address.
}