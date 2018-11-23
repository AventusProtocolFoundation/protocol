const common = require('./common.js');
const fs = require('fs');

const IAventusStorage = artifacts.require("IAventusStorage");
const ProposalsManager = artifacts.require("ProposalsManager");
const MembersManager = artifacts.require("MembersManager");
const AVTManager = artifacts.require("AVTManager");
const EventsManager = artifacts.require("EventsManager");
const MerkleRootsManager = artifacts.require("MerkleRootsManager");
const Versioned = artifacts.require("Versioned");

// Libraries
const LAventities = artifacts.require("LAventities");
const LMembers = artifacts.require("LMembers");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const LAventitiesChallenges = artifacts.require("LAventitiesChallenges");
const LProposalsEnact = artifacts.require("LProposalsEnact");
const LEventsCommon = artifacts.require("LEventsCommon");
const LEventsEnact = artifacts.require("LEventsEnact");
const LEventsTickets = artifacts.require("LEventsTickets");
const LEvents = artifacts.require("LEvents");
const LAVTManager = artifacts.require("LAVTManager");
const LProposalsVoting = artifacts.require("LProposalsVoting");
const LProposals = artifacts.require("LProposals");
const LProposalForTesting = artifacts.require("LProposalForTesting");
const LMerkleRoots = artifacts.require("LMerkleRoots");
const LProposalsStorage = artifacts.require("LProposalsStorage");
const LEventsStorage = artifacts.require("LEventsStorage");
const LAventitiesStorage = artifacts.require("LAventitiesStorage");
const LMembersStorage = artifacts.require("LMembersStorage");
const LMerkleRootsStorage = artifacts.require("LMerkleRootsStorage");
const LAVTStorage = artifacts.require("LAVTStorage");

// Proxies
const PAventities = artifacts.require("PAventities");
const PMembers = artifacts.require("PMembers");
const PAventusTime = artifacts.require("PAventusTime");
const PEvents = artifacts.require("PEvents");
const PAVTManager = artifacts.require("PAVTManager");
const PProposals = artifacts.require("PProposals");
const PMerkleRoots = artifacts.require("PMerkleRoots");

module.exports = function(_deployer, _network, _accounts) {
    console.log("*** Deploying Libraries...");
    return deployLibraries(_deployer, _network)
    .then(() => console.log("*** LIBRARIES DEPLOY COMPLETE"));
};

let deployLAventusTime;
let deployLAVTManager;
let deployLAventities;
let deployLMembers;
let deployLEvents;
let deployLProposals;
let deployLProposalForTesting;
let deployLMerkleRoots;
let deployLAventusTimeMock;
let version;

function deployLibraries(_deployer, _network) {
  const developmentMode = _network === "development" || _network === "coverage";
  const notLiveMode = _network != "live";

  deployLAventusTime = developmentMode;
  deployLAVTManager = developmentMode;
  deployLAventities = developmentMode;
  deployLMembers = developmentMode;
  deployLEvents = developmentMode;
  deployLProposals = developmentMode;
  deployLProposalForTesting = developmentMode;
  deployLMerkleRoots = developmentMode;
  deployLAventusTimeMock = notLiveMode;

  let s;
  return doDeployVersion(_deployer)
  .then(() => common.getStorageContractFromJsonFile(IAventusStorage))
  .then(storageContract => {
    s = storageContract;
    return doDeployLAventusTime(_deployer, s);
  })
  .then(() => doDeployLAVTManager(_deployer, s))
  .then(() => doDeployLProposals(_deployer, s))
  .then(() => doDeployLAventities(_deployer, s))
  .then(() => doDeployLMembers(_deployer, s))
  .then(() => doDeployLMerkleRoots(_deployer, s))
  .then(() => doDeployLEvents(_deployer, s));
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
  const dependents = [LProposals, LAVTManager, LEvents, LEventsEnact, LEventsCommon, LEventsTickets, ProposalsManager, LProposalsEnact, LMembers, LMembersStorage, LEventsStorage];

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
  const dependents = [LProposals, LAventitiesChallenges, LProposalsVoting, LEventsCommon, LEventsEnact, LAventities, LMembers, AVTManager, LProposalsEnact, LMerkleRoots];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLAventities(_deployer, _storage) {
  const libraryName = "LAventitiesInstance";
  const proxyName = "PAventitiesInstance";
  const library = LAventities;
  const proxy = PAventities;
  const deployLibraryAndProxy = deployLAventities;
  const dependents = [LEventsCommon, LEventsEnact, LMembers, ProposalsManager, LEvents];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLMembers(_deployer, _storage) {
  const libraryName = "LMembersInstance";
  const proxyName = "PMembersInstance";
  const library = LMembers;
  const proxy = PMembers;
  const deployLibraryAndProxy = deployLMembers;
  const dependents = [LEventsCommon, MembersManager, LMerkleRoots];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLEvents(_deployer, _storage) {
  const libraryName = "LEventsInstance";
  const proxyName = "PEventsInstance";
  const library = LEvents;
  const proxy = PEvents;
  const deployLibraryAndProxy = deployLEvents;
  const dependents = [EventsManager, ProposalsManager];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLProposals(_deployer, _storage) {
  const libraryName = "LProposalsInstance";
  const proxyName = "PProposalsInstance";
  const library = LProposals;
  const proxy = PProposals;
  const deployLibraryAndProxy = deployLProposals;
  const dependents = [ProposalsManager, LAventities, LMembers, LAventitiesChallenges];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents)
    .then(() => deployLProposalForTesting ? _deployer.deploy(LProposalForTesting) : _deployer);
}

function doDeployLMerkleRoots(_deployer, _storage) {
  const libraryName = "LMerkleRootsInstance";
  const proxyName = "PMerkleRootsInstance";
  const library = LMerkleRoots;
  const proxy = PMerkleRoots;
  const deployLibraryAndProxy = deployLMerkleRoots;
  const dependents = [MerkleRootsManager, LEvents];

  return doDeployLibraryAndProxy(_deployer, _storage, libraryName, proxyName, library, proxy, deployLibraryAndProxy, dependents);
}

function doDeployLibraryAndProxy(_deployer, _storage, _libraryName, _proxyName, _library, _proxy, _deployLibraryAndProxy,
    _dependents) {
  return _storage.getAddress(web3.sha3(_proxyName))
  .then(address => {
    if (address == 0 || _deployLibraryAndProxy) {
      return doDeploySubLibraries(_deployer, _library)
      .then(() => _deployer.deploy([_library, _proxy]))
      .then(() => setProxiedLibraryAddress(_storage, _libraryName, _proxy, _library))
      .then(() => {
        console.log("Using newly deployed", _proxyName, _proxy.address);
        return _storage.setAddress(web3.sha3(_proxyName), _proxy.address);
      });
    } else {
      console.log("Using pre-existing", _proxyName, address);
      return _deployer;
    }
  })
  .then(() => _storage.getAddress(web3.sha3(_proxyName)))
  .then(proxyAddress => {
    _library.address = proxyAddress;
    return _deployer.link(_library, _dependents);
  });
}

function doDeploySubLibraries(_deployer, _library) {
  if (_library === LProposals) {
    return _deployer.deploy(LProposalsStorage)
    .then(() => _deployer.link(LProposalsStorage, [LProposals, LProposalsEnact, LProposalsVoting]))
    .then(() => _deployer.deploy(LProposalsEnact))
    .then(() => _deployer.link(LProposalsEnact, [LProposals, LProposalsVoting]))
    .then(() => _deployer.deploy(LProposalsVoting))
    .then(() => _deployer.link(LProposalsVoting, LProposals));
  } else if (_library === LEvents) {
    return _deployer.deploy(LEventsStorage)
    .then(() => _deployer.link(LEventsStorage, [LEvents, LEventsCommon, LEventsEnact, LEventsTickets]))
    .then(() => _deployer.deploy(LEventsCommon))
    .then(() => _deployer.link(LEventsCommon, [LEvents, LEventsEnact, LEventsTickets]))
    .then(() => _deployer.deploy(LEventsEnact))
    .then(() => _deployer.link(LEventsEnact, LEvents))
    .then(() => _deployer.deploy(LEventsTickets))
    .then(() => _deployer.link(LEventsTickets, LEvents));
  } else if (_library === LAventities) {
    return _deployer.deploy(LAventitiesStorage)
    .then(() => _deployer.link(LAventitiesStorage, [LAventities, LAventitiesChallenges]))
    .then(() => _deployer.deploy(LAventitiesChallenges))
    .then(() => _deployer.link(LAventitiesChallenges, LAventities));
  } else if (_library === LMembers) {
    return _deployer.deploy(LMembersStorage)
    .then(() => _deployer.link(LMembersStorage, LMembers));
  } else if (_library === LMerkleRoots) {
    return _deployer.deploy(LMerkleRootsStorage)
    .then(() => _deployer.link(LMerkleRootsStorage, LMerkleRoots));
  } else if (_library === LAVTManager) {
    return _deployer.deploy(LAVTStorage)
    .then(() => _deployer.link(LAVTStorage, LAVTManager));
  }
  return _deployer;
}

function setProxiedLibraryAddress(_storage, _libraryName, _proxy, _library) {
  const key = _libraryName + "-" + version;
  console.log("Setting library hash of", key, "to use address", _library.address);
  return _storage.setAddress(web3.sha3(key), _library.address);
}