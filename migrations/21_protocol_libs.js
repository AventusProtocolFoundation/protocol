const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');
const web3Tools = require('../utils/web3Tools.js');

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

const proposalsOn = false; // See scripts/SwitchProposalsMode.js

module.exports = async function(_deployer, _networkName, _accounts) {
  global.web3 = web3; // make web3Tools work for truffle migrate without --reset
  console.log('*** Deploying Libraries (Part B)...');
  await deployLibraries(_deployer, _networkName);
  console.log('*** LIBRARIES PART B DEPLOY COMPLETE');
};

let deployLValidators;
let deployLProposals;
let deployLProposalForTesting;
let version;

async function deployLibraries(_deployer, _networkName) {
  const deployAll = common.deployAll(_networkName);

  deployLValidators = deployAll;
  deployLProposals = proposalsOn && deployAll;
  deployLProposalForTesting = proposalsOn && deployAll;

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
    if (proposalsOn) {
      await common.deploy(_deployer, LValidatorsChallenges);
      await _deployer.link(LValidatorsChallenges, LValidators);
    }
  }
}

function doDeployLValidators(_deployer, _storage) {
  const libraryName = 'LValidatorsInstance';
  const proxyName = 'PValidatorsInstance';
  const library = LValidators;
  const proxy = PValidators;
  const deployLibraryAndProxy = deployLValidators;
  const dependents = [LEventsEvents, LEventsRoles, ValidatorsManager, LMerkleRoots, ProposalsManager];

  return librariesCommon.doDeployLibraryAndProxy(version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

async function doDeployLProposals(_deployer, _storage) {
  const libraryName = 'LProposalsInstance';
  const proxyName = 'PProposalsInstance';
  const library = LProposals;
  const proxy = PProposals;
  const deployLibraryAndProxy = deployLProposals;
  const dependents = [ProposalsManager, LValidators, LValidatorsChallenges];

  await librariesCommon.doDeployLibraryAndProxy(version, deploySubLibraries, _deployer, _storage, libraryName, proxyName,
      library, proxy, deployLibraryAndProxy, dependents);
  if (deployLProposalForTesting) {
    await common.deploy(_deployer, LProposalForTesting);
  }
  if (deployLProposals) {
    // Special case for direct call between libraries.
    const lProposalsEnact = await LProposalsEnact.deployed();
    const lProposalsEnactAddressKey = web3Tools.hash('LProposalsEnactAddress');
    await _storage.setAddress(lProposalsEnactAddressKey, lProposalsEnact.address);
  }
}