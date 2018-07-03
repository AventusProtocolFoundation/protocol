const common = require('./common.js');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");
const ProposalManager = artifacts.require("AventusVote");
const AppsManager = artifacts.require("AppsManager");
const EventsManager = artifacts.require("EventsManager");

// Libraries
const LApps = artifacts.require("LApps");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const LProposalWinnings = artifacts.require("LProposalWinnings");
const LEventsCommon = artifacts.require("LEventsCommon");
const LEventsEnact = artifacts.require("LEventsEnact");
const LEvents = artifacts.require("LEvents");
const LLock = artifacts.require("LLock");
const LProposalVoting = artifacts.require("LProposalVoting");
const LProposal = artifacts.require("LProposal");
const LProposalForTesting = artifacts.require("LProposalForTesting");

// Proxies
const PApps = artifacts.require("PApps");
const PAventusTime = artifacts.require("PAventusTime");
const PEvents = artifacts.require("PEvents");
const PLock = artifacts.require("PLock");
const PProposal = artifacts.require("PProposal");

module.exports = function(deployer, network, accounts) {
    console.log("*** Deploying Libraries...");
    return deployLibraries(deployer, network).then(() => console.log("*** LIBRARIES DEPLOY COMPLETE"));
};

let deployLAventusTime;
let deployLLock;
let deployLApps;
let deployLEvents;
let deployLProposal;
let deployLProposalForTesting;
let deployLAventusTimeMock;

function deployLibraries(deployer, network) {
  const developmentMode = network === "development";
  const notLiveMode = network != "live";

  deployLAventusTime = developmentMode;
  deployLLock = developmentMode;
  deployLApps = developmentMode;
  deployLEvents = developmentMode;
  deployLProposal = developmentMode;
  deployLProposalForTesting = developmentMode;
  deployLAventusTimeMock = notLiveMode;

  let s;
  return deployer.then(() => {
    return common.getStorageContractFromJsonFile(deployer, AventusStorage)
  }).then((storageContract) => {
    s = storageContract;
    return doDeployLAventusTime(deployer, s);
  }).then(() => {
    return doDeployLLock(deployer, s);
  }).then(() => {
    return doDeployLApps(deployer, s);
  }).then(() => {
    return doDeployLEvents(deployer, s);
  }).then(() => {
    return doDeployLProposal(deployer, s);
  });
}

function doDeployLAventusTime(_deployer, _storage) {
  const libraryName = "LAventusTimeInstance";
  const proxyName = "PAventusTimeInstance";
  const library = LAventusTime;
  const proxy = PAventusTime;
  const deployLibrary = deployLAventusTime;
  const dependents = [LProposal, LLock, LEvents, LEventsEnact, LEventsCommon, ProposalManager];

  return doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents)
  .then(() => {
    if (deployLAventusTimeMock) {
      return _deployer.deploy(LAventusTimeMock)
      .then(() => setProxiedLibraryAddress(_storage, libraryName, proxy, LAventusTimeMock));
    } else {
      return _deployer;
    }
  });
}

function doDeployLLock(_deployer, _storage) {
  const libraryName = "LLockInstance";
  const proxyName = "PLockInstance";
  const library = LLock;
  const proxy = PLock;
  const deployLibrary = deployLLock;
  const dependents = [LProposal, LProposalWinnings, LProposalVoting, LEventsCommon, LEventsEnact, LApps, ProposalManager, AppsManager];

  return doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents);
}

function doDeployLApps(_deployer, _storage) {
  const libraryName = "LAppsInstance";
  const proxyName = "PAppsInstance";
  const library = LApps;
  const proxy = PApps;
  const deployLibrary = deployLApps;
  const dependents = [LEvents, LEventsCommon, LEventsEnact, AppsManager];

  return doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents);
}

function doDeployLEvents(_deployer, _storage) {
  const libraryName = "LEventsInstance";
  const proxyName = "PEventsInstance";
  const library = LEvents;
  const proxy = PEvents;
  const deployLibrary = deployLEvents;
  const dependents = [LProposal, EventsManager, ProposalManager];

  return doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents);
}

function doDeployLProposal(_deployer, _storage) {
  const libraryName = "LProposalInstance";
  const proxyName = "PProposalInstance";
  const library = LProposal;
  const proxy = PProposal;
  const deployLibrary = deployLProposal;
  const dependents = ProposalManager;

  return doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents)
    .then(() => deployLProposalForTesting ? _deployer.deploy(LProposalForTesting) : _deployer);
}

function doDeployLibrary(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibrary, dependents) {
  return _storage.getAddress(web3.sha3(proxyName)
  ).then((address) => {
    if (address == 0 || deployLibrary) {
      return doDeploySubLibraries(_deployer, library)
      .then(() => _deployer.deploy([library, proxy])
      ).then(() => setProxiedLibraryAddress(_storage, libraryName, proxy, library)
      ).then(() => {
        console.log("Using newly deployed", proxyName, proxy.address);
        return _storage.setAddress(web3.sha3(proxyName), proxy.address);
      });
    } else {
      console.log("Using pre-existing", proxyName, address);
      return _deployer;
    }
  }).then(() => _storage.getAddress(web3.sha3(proxyName))
  ).then((proxyAddress) => {
    library.address = proxyAddress;
    return _deployer.link(library, dependents);
  });
}

function doDeploySubLibraries(_deployer, library) {
  if (library === LProposal) {
    return _deployer.deploy(LProposalWinnings).then(
      () => _deployer.link(LProposalWinnings, LProposal)).then(
      () => _deployer.deploy(LProposalVoting)).then(
      () => _deployer.link(LProposalVoting, LProposal));
  } else if (library === LEvents) {
    return _deployer.deploy(LEventsCommon).then(
      () => _deployer.link(LEventsCommon, [LEvents, LEventsEnact])).then(
      () => _deployer.deploy(LEventsEnact)).then(
      () => _deployer.link(LEventsEnact, LEvents));
  }
  return _deployer;
}

function setProxiedLibraryAddress(_storage, _libraryName, _proxy, _library) {
  // TODO: add version number to key name.
  const key = _libraryName;
  console.log("Setting library hash of", key, "to use address", _library.address);
  return _storage.setAddress(web3.sha3(key), _library.address);
}
