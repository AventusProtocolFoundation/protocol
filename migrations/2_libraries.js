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

// TODO: Write another version of this that handles partial redeploying when
// necessary, eg for Live network.
function deployLibraries(deployer, network) {
  let s;
  return deployer.then(() => {
    return getAventusStorage(deployer, network);
  }).then((storageContract) => {
    s = storageContract;
    return deployLAventusTime(deployer, network, s);
  }).then(() => {
    return deployer.link(LAventusTime, [LProposal, LLock, LEvents, LEventsEnact, ProposalManager]);
  }).then(() => {
    return deployer.deploy([PProposal, PLock, PEvents, PApps]);
  }).then(() => {
    return deployer.deploy(LLock);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LLockInstance"), LLock.address));
  }).then(() => {
    LLock.address = PLock.address;
    return deployer.link(LLock, [LProposal, LEventsCommon, LApps, ProposalManager, AppsManager]);
  }).then(() => {
    return deployer.deploy(LApps);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LAppsInstance"), LApps.address));
  }).then(() => {
    LApps.address = PApps.address;
    return deployer.link(LApps, [LEvents, LEventsCommon, LEventsEnact, AppsManager]);
  }).then(() => {
    return deployer.deploy(LEventsCommon);
  }).then(() => {
    return deployer.link(LEventsCommon, [LEvents, LEventsEnact]);
  }).then(() => {
    return deployer.deploy(LEventsEnact);
  }).then(() => {
    return deployer.link(LEventsEnact, LEvents);
  }).then(() => {
    return deployer.deploy(LEvents);
  }).then(() => {
    return network === "live" ? deployer : deployer.deploy(LProposalForTesting);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LEventsInstance"), LEvents.address));
  }).then(() => {
    LEvents.address = PEvents.address;
    return deployer.link(LEvents, [LProposal, EventsManager, ProposalManager]);
  }).then(() => {
    return deployer.deploy(LProposalWinnings);
  }).then(() => {
    return deployer.link(LProposalWinnings, LProposal);
  }).then(() => {
    return deployer.deploy(LProposalVoting);
  }).then(() => {
    return deployer.link(LProposalVoting, LProposal);
  }).then(() => {
    return deployer.deploy(LProposal);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LProposalInstance"), LProposal.address));
  }).then(() => {
    LProposal.address = PProposal.address;
    return deployer.link(LProposal, ProposalManager);
  });
}

function deployLAventusTime(_deployer, _network, _storage) {
  return _deployer.deploy([LAventusTime, PAventusTime]).then(() => {
    return _network === "live" ? _deployer : _deployer.deploy(LAventusTimeMock);
  }).then(() => {
    const timeAddress = _network === "live" ? LAventusTime.address : LAventusTimeMock.address;
    LAventusTime.address = PAventusTime.address;
    return _deployer.then(() => _storage.setAddress(web3.sha3("LAventusTimeInstance"), timeAddress));
  });
}

// TODO: This is used in the contracts migration file too. Share.
function getAventusStorage(deployer, network) {
  if (network === "development") {
    return AventusStorage.deployed();
  } else {
    const rawdata = fs.readFileSync("./api/storage.json");
    return deployer.then(() => AventusStorage.at(JSON.parse(rawdata).address));
  }
}
