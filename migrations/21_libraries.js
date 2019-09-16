const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const fs = require('fs');

const IAventusStorage = artifacts.require('IAventusStorage');
const ProposalsManager = artifacts.require('ProposalsManager');
const ValidatorsManager = artifacts.require('ValidatorsManager');
const Versioned = artifacts.require('Versioned');

// Libraries
const LValidators = artifacts.require('LValidators');
const LValidatorsChallenges = artifacts.require('LValidatorsChallenges');
const LProposalsEnact = artifacts.require('LProposalsEnact');
const LEventsEvents = artifacts.require('LEventsEvents');
const LEventsRoles = artifacts.require('LEventsRoles');
const LProposalsVoting = artifacts.require('LProposalsVoting');
const LProposals = artifacts.require('LProposals');
const LProposalForTesting = artifacts.require('LProposalForTesting');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const LProposalsStorage = artifacts.require('LProposalsStorage');
const LValidatorsStorage = artifacts.require('LValidatorsStorage');

// Proxies
const PValidators = artifacts.require('PValidators');
const PProposals = artifacts.require('PProposals');

module.exports = async function(_deployer, _networkName, _accounts) {
    console.log('*** Deploying Libraries (Part B)...');
    await deployLibraries(_deployer, _networkName);
    console.log('*** LIBRARIES PART B DEPLOY COMPLETE');
};

let deployLValidators;
let deployLProposals;
let deployLProposalForTesting;
let version;

async function deployLibraries(_deployer, _networkName) {
  const developmentMode = common.isTestNetwork(_networkName);

  deployLValidators = developmentMode;
  deployLProposals = developmentMode;
  deployLProposalForTesting = developmentMode;

  version = await common.getVersion(Versioned);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _networkName);
  await doDeployLProposals(_deployer, storageContract);
  await doDeployLValidators(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LProposals) {
    await common.deploy(_deployer, LProposalsStorage);
    await librariesCommon.linkMultiple(_deployer, LProposalsStorage, [LProposals, LProposalsEnact, LProposalsVoting]);
    await common.deploy(_deployer, LProposalsEnact);
    await librariesCommon.linkMultiple(_deployer, LProposalsEnact, [LProposals, LProposalsVoting]);
    await common.deploy(_deployer, LProposalsVoting);
    await _deployer.link(LProposalsVoting, LProposals);
  } else if (_library === LValidators) {
    await common.deploy(_deployer, LValidatorsStorage);
    await librariesCommon.linkMultiple(_deployer, LValidatorsStorage, [LValidators, LValidatorsChallenges]);
    await common.deploy(_deployer, LValidatorsChallenges);
    await _deployer.link(LValidatorsChallenges, LValidators);
  }
}

function doDeployLValidators(_deployer, _storage) {
  const libraryName = 'LValidatorsInstance';
  const proxyName = 'PValidatorsInstance';
  const library = LValidators;
  const proxy = PValidators;
  const deployLibraryAndProxy = deployLValidators;
  const dependents = [LEventsEvents, LEventsRoles, ValidatorsManager, LMerkleRoots, ProposalsManager];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

async function doDeployLProposals(_deployer, _storage) {
  const libraryName = 'LProposalsInstance';
  const proxyName = 'PProposalsInstance';
  const library = LProposals;
  const proxy = PProposals;
  const deployLibraryAndProxy = deployLProposals;
  const dependents = [ProposalsManager, LValidators, LValidatorsChallenges];

  await librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName, proxyName,
      library, proxy, deployLibraryAndProxy, dependents);
  if (deployLProposalForTesting) {
    await common.deploy(_deployer, LProposalForTesting);
  }
  // Special case for direct call between libraries.
  const lProposalsEnact = await LProposalsEnact.deployed();
  if (lProposalsEnact) {
    const lProposalsEnactAddressKey = web3.utils.soliditySha3('LProposalsEnactAddress');
    await _storage.setAddress(lProposalsEnactAddressKey, lProposalsEnact.address);
  } // else LProposalsEnact was not deployed this time, keep the old address.
}