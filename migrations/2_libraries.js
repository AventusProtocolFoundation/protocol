const common = require('./common.js');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");
const ProposalsManager = artifacts.require("ProposalsManager");
const AppsManager = artifacts.require("AppsManager");
const AVTManager = artifacts.require("AVTManager");
const EventsManager = artifacts.require("EventsManager");
const Versioned = artifacts.require("Versioned");

// Libraries
const LApps = artifacts.require("LApps");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const LProposalWinnings = artifacts.require("LProposalWinnings");
const LEventsCommon = artifacts.require("LEventsCommon");
const LEventsEnact = artifacts.require("LEventsEnact");
const LEvents = artifacts.require("LEvents");
const LAVTManager = artifacts.require("LAVTManager");
const LProposalVoting = artifacts.require("LProposalVoting");
const LProposal = artifacts.require("LProposal");
const LProposalForTesting = artifacts.require("LProposalForTesting");

// Proxies
const PApps = artifacts.require("PApps");
const PAventusTime = artifacts.require("PAventusTime");
const PEvents = artifacts.require("PEvents");
const PAVTManager = artifacts.require("PAVTManager");
const PProposal = artifacts.require("PProposal");

module.exports = function(deployer, network, accounts) {
    console.log("*** Deploying Libraries...");
    return deployLibraries(deployer, network)
    .then(() => console.log("*** LIBRARIES DEPLOY COMPLETE"));
};

let deployLAventusTime;
let deployLAVTManager;
let deployLApps;
let deployLEvents;
let deployLProposal;
let deployLProposalForTesting;
let deployLAventusTimeMock;
let version;

function deployLibraries(deployer, network) {
  const developmentMode = network === "development" || network === "coverage";
  const notLiveMode = network != "live";

  deployLAventusTime = developmentMode;
  deployLAVTManager = developmentMode;
  deployLApps = developmentMode;
  deployLEvents = developmentMode;
  deployLProposal = developmentMode;
  deployLProposalForTesting = developmentMode;
  deployLAventusTimeMock = notLiveMode;

  let s;
  return doDeployVersion(deployer)
  .then(() => common.getStorageContractFromJsonFile(deployer, AventusStorage))
  .then(storageContract => {
    s = storageContract;
    return doDeployLAventusTime(deployer, s);
  })
  .then(() => doDeployLAVTManager(deployer, s))
  .then(() => doDeployLApps(deployer, s))
  .then(() => doDeployLEvents(deployer, s))
  .then(() => doDeployLProposal(deployer, s));
}

function doDeployVersion(_deployer) {
  return _deployer.deploy(Versioned)
  .then(() => Versioned.deployed())
  .then(versioned => versioned.getVersionMajorMinor())
  .then(v => {
    version = v;
    console.log("Deploying libraries and proxies with version", version);
    return _deployer;
  });
}

function doDeployLAventusTime(_deployer, _storage) {
  const libraryName = "LAventusTimeInstance";
  const proxyName = "PAventusTimeInstance";
  const library = LAventusTime;
  const proxy = PAventusTime;
  const deployLibraryAndProxy = deployLAventusTime;
  const dependents = [LProposal, LAVTManager, LEvents, LEventsEnact, LEventsCommon, ProposalsManager];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents)
  .then(() => {
    if (deployLAventusTimeMock) {
      return _deployer.deploy(LAventusTimeMock)
      .then(() => setProxiedLibraryAddress(_storage, libraryName, proxy, LAventusTimeMock));
    } else {
      return _deployer;
    }
  });
}

function doDeployLAVTManager(_deployer, _storage) {
  const libraryName = "LAVTManagerInstance";
  const proxyName = "PAVTManagerInstance";
  const library = LAVTManager;
  const proxy = PAVTManager;
  const deployLibraryAndProxy = deployLAVTManager;
  const dependents = [LProposal, LProposalWinnings, LProposalVoting, LEventsCommon, LEventsEnact, LApps, AVTManager];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLApps(_deployer, _storage) {
  const libraryName = "LAppsInstance";
  const proxyName = "PAppsInstance";
  const library = LApps;
  const proxy = PApps;
  const deployLibraryAndProxy = deployLApps;
  const dependents = [LEvents, LEventsCommon, LEventsEnact, AppsManager];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLEvents(_deployer, _storage) {
  const libraryName = "LEventsInstance";
  const proxyName = "PEventsInstance";
  const library = LEvents;
  const proxy = PEvents;
  const deployLibraryAndProxy = deployLEvents;
  const dependents = [LProposal, EventsManager, ProposalsManager];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLProposal(_deployer, _storage) {
  const libraryName = "LProposalInstance";
  const proxyName = "PProposalInstance";
  const library = LProposal;
  const proxy = PProposal;
  const deployLibraryAndProxy = deployLProposal;
  const dependents = ProposalsManager;

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents)
    .then(() => deployLProposalForTesting ? _deployer.deploy(LProposalForTesting) : _deployer);
}

function doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents) {
  return _storage.getAddress(web3.sha3(proxyName))
  .then(address => {
    if (address == 0 || deployLibraryAndProxy) {
      return doDeploySubLibraries(_deployer, library)
      .then(() => _deployer.deploy([library, proxy]))
      .then(() => setProxiedLibraryAddress(_storage, libraryName, proxy, library))
      .then(() => {
        console.log("Using newly deployed", proxyName, proxy.address);
        return _storage.setAddress(web3.sha3(proxyName), proxy.address);
      });
    } else {
      console.log("Using pre-existing", proxyName, address);
      return _deployer;
    }
  })
  .then(() => _storage.getAddress(web3.sha3(proxyName)))
  .then(proxyAddress => {
    library.address = proxyAddress;
    return _deployer.link(library, dependents);
  });
}

function doDeploySubLibraries(_deployer, library) {
  if (library === LProposal) {
    return _deployer.deploy(LProposalWinnings)
    .then(() => _deployer.link(LProposalWinnings, LProposal))
    .then(() => _deployer.deploy(LProposalVoting))
    .then(() => _deployer.link(LProposalVoting, LProposal));
  } else if (library === LEvents) {
    return _deployer.deploy(LEventsCommon)
    .then(() => _deployer.link(LEventsCommon, [LEvents, LEventsEnact]))
    .then(() => _deployer.deploy(LEventsEnact))
    .then(() => _deployer.link(LEventsEnact, LEvents));
  }
  return _deployer;
}

function setProxiedLibraryAddress(_storage, _libraryName, _proxy, _library) {
  const key = _libraryName + "-" + version;
  console.log("Setting library hash of", key, "to use address", _library.address);
  return _storage.setAddress(web3.sha3(key), _library.address);
}
