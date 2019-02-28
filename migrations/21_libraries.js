const common = require('./common.js');
const librariesCommon = require('./librariesCommon.js');

const fs = require('fs');

const IAventusStorage = artifacts.require('IAventusStorage');
const ProposalsManager = artifacts.require('ProposalsManager');
const MembersManager = artifacts.require('MembersManager');
const Versioned = artifacts.require('Versioned');

// Libraries
const LAventities = artifacts.require('LAventities');
const LMembers = artifacts.require('LMembers');
const LAventitiesChallenges = artifacts.require('LAventitiesChallenges');
const LProposalsEnact = artifacts.require('LProposalsEnact');
const LEventsTickets = artifacts.require('LEventsTickets');
const LEventsEvents = artifacts.require('LEventsEvents');
const LEventsRoles = artifacts.require('LEventsRoles');
const LProposalsVoting = artifacts.require('LProposalsVoting');
const LProposals = artifacts.require('LProposals');
const LProposalForTesting = artifacts.require('LProposalForTesting');
const LMerkleRoots = artifacts.require('LMerkleRoots');
const LProposalsStorage = artifacts.require('LProposalsStorage');
const LAventitiesStorage = artifacts.require('LAventitiesStorage');
const LMembersStorage = artifacts.require('LMembersStorage');

// Proxies
const PAventities = artifacts.require('PAventities');
const PMembers = artifacts.require('PMembers');
const PProposals = artifacts.require('PProposals');

module.exports = async function(_deployer, _network, _accounts) {
    console.log('*** Deploying Libraries (Part B)...');
    await deployLibraries(_deployer, _network);
    console.log('*** LIBRARIES PART B DEPLOY COMPLETE');
};

let deployLAventities;
let deployLMembers;
let deployLProposals;
let deployLProposalForTesting;
let version;

async function deployLibraries(_deployer, _network) {
  const developmentMode = _network === 'development' || _network === 'coverage' || _network === 'rinkeby';

  deployLAventities = developmentMode;
  deployLMembers = developmentMode;
  deployLProposals = developmentMode;
  deployLProposalForTesting = developmentMode;

  version = await common.getVersion(Versioned);
  const storageContract = await common.getStorageContractFromJsonFile(IAventusStorage, _network);
  await doDeployLProposals(_deployer, storageContract);
  await doDeployLAventities(_deployer, storageContract);
  await doDeployLMembers(_deployer, storageContract);
}

async function deploySubLibraries(_deployer, _library) {
  if (_library === LProposals) {
    await _deployer.deploy(LProposalsStorage);
    await librariesCommon.linkMultiple(_deployer, LProposalsStorage, [LProposals, LProposalsEnact, LProposalsVoting]);
    await _deployer.deploy(LProposalsEnact);
    await librariesCommon.linkMultiple(_deployer, LProposalsEnact, [LProposals, LProposalsVoting]);
    await _deployer.deploy(LProposalsVoting);
    await _deployer.link(LProposalsVoting, LProposals);
  } else if (_library === LAventities) {
    await _deployer.deploy(LAventitiesStorage);
    await librariesCommon.linkMultiple(_deployer, LAventitiesStorage, [LAventities, LAventitiesChallenges]);
    await _deployer.deploy(LAventitiesChallenges);
    await _deployer.link(LAventitiesChallenges, LAventities);
  } else if (_library === LMembers) {
    await _deployer.deploy(LMembersStorage);
    await _deployer.link(LMembersStorage, LMembers);
  }
}

function doDeployLAventities(_deployer, _storage) {
  const libraryName = 'LAventitiesInstance';
  const proxyName = 'PAventitiesInstance';
  const library = LAventities;
  const proxy = PAventities;
  const deployLibraryAndProxy = deployLAventities;
  const dependents = [LMembers, ProposalsManager];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLMembers(_deployer, _storage) {
  const libraryName = 'LMembersInstance';
  const proxyName = 'PMembersInstance';
  const library = LMembers;
  const proxy = PMembers;
  const deployLibraryAndProxy = deployLMembers;
  const dependents = [LEventsEvents, LEventsTickets, LEventsRoles, MembersManager, LMerkleRoots];

  return librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName,
      proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

async function doDeployLProposals(_deployer, _storage) {
  const libraryName = 'LProposalsInstance';
  const proxyName = 'PProposalsInstance';
  const library = LProposals;
  const proxy = PProposals;
  const deployLibraryAndProxy = deployLProposals;
  const dependents = [ProposalsManager, LAventities, LMembers, LAventitiesChallenges];

  await librariesCommon.doDeployLibraryAndProxy(web3, version, deploySubLibraries, _deployer, _storage, libraryName, proxyName,
      library, proxy, deployLibraryAndProxy, dependents);
  if (deployLProposalForTesting) {
    await _deployer.deploy(LProposalForTesting);
  }
}