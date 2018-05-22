const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");
const ProposalManager = artifacts.require("AventusVote");
const AppsManager = artifacts.require("AppsManager");
const EventsManager = artifacts.require("EventsManager");

// Libraries
const LApps = artifacts.require("LApps");
const LAventusTime = artifacts.require("LAventusTime");
const LAventusTimeMock = artifacts.require("LAventusTimeMock");
const LChallengeWinnings = artifacts.require("LChallengeWinnings");
const LEvents = artifacts.require("LEvents");
const LLock = artifacts.require("LLock");
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
    return deployer.link(LAventusTime, [LProposal, LLock, LEvents, ProposalManager]);
  }).then(() => {
    return deployer.deploy([PProposal, PLock, PEvents, PApps]);
  }).then(() => {
    return deployer.deploy(LLock);
    LLock.address = PLock.address;
  }).then(() => {
    return deployer.link(LLock, [LProposal, LEvents, LApps]);
  }).then(() => {
    return deployer.deploy(LApps);
  }).then(() => {
    return deployer.link(LApps, LEvents);
  }).then(() => {
    return deployer.deploy([LEvents, LProposalForTesting]);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LLockInstance"), LLock.address));
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LEventsInstance"), LEvents.address));
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LAppsInstance"), LApps.address));
  }).then(() => {
    LEvents.address = PEvents.address;
    LApps.address = PApps.address;
    return deployer.link(LEvents, [LProposal, EventsManager, ProposalManager]);
  }).then(() => {
    return deployer.deploy(LChallengeWinnings);
  }).then(() => {
    return deployer.link(LChallengeWinnings, LProposal);
  }).then(() => {
    return deployer.deploy(LProposal);
  }).then(() => {
    return deployer.then(() => s.setAddress(web3.sha3("LProposalInstance"), LProposal.address));
  }).then(() => {
    LProposal.address = PProposal.address;
    return deployer.link(LProposal, ProposalManager);
  }).then(() => {
    return deployer.link(LApps, AppsManager);
  }).then(() => {
    return deployer.link(LLock, [ProposalManager, AppsManager]);
  });
}

function deployLAventusTime(_deployer, _network, _storage) {
  return _deployer.deploy([LAventusTime, LAventusTimeMock, PAventusTime]).then(() => {
    const timeAddress = _network === "development" ? LAventusTimeMock.address : LAventusTime.address;
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
