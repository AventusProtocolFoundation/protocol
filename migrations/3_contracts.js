const eip55 = require('eip55');
const fs = require('fs');

const AventusStorage = artifacts.require("AventusStorage");
const ProposalManager = artifacts.require("AventusVote");
const AppsManager = artifacts.require("AppsManager");
const EventsManager = artifacts.require("EventsManager");
const ParameterRegistry = artifacts.require("ParameterRegistry");

module.exports = function(deployer, network, accounts) {
  return deployContracts(deployer, network).then(() => {
    console.log("*** CONTRACTS DEPLOY COMPLETE");
  });
};

function serializeObjectToJSON(fileName, object) {
  fs.writeFileSync(fileName, JSON.stringify(object, null, 4));
}

function deployContracts(deployer, network) {
  console.log("Deploying Contracts...");
  let s;
  return deployer.then(() => {
    return getAventusStorage(deployer, network);
  }).then((_s) => {
    s = _s;
    if (network != "development") {
        try {
          fs.statSync("./api/aventusvote.json");
          console.log("AventusVote.json already exists! Skipping contract deployment.");
          return deployer;
        } catch (error) {
          // Continue.
        }
    }

    const abiPartLength = 16;
    let numParts;
    return deployer.deploy([
      [ProposalManager, s.address],
      [AppsManager, s.address],
      [EventsManager, s.address],
      [ParameterRegistry, s.address]
    ]).then(() => {
      return s.setAddress(web3.sha3("ProposalsManager_Address"), eip55.encode(ProposalManager.address));
    }).then(() => {
      numParts = Math.ceil(ProposalManager.abi.length / abiPartLength);
      return s.setUInt(web3.sha3("ProposalsManager_Abi_NumParts"), numParts);
    }).then(() => {
      console.log("Splitting ProposalManager ABI into", numParts);
      let abiPromises = [];
      for (let i = 0; i < numParts; ++i) {
        const start = i * abiPartLength;
        const end = start + abiPartLength;
        const part = JSON.stringify(ProposalManager.abi.slice(start, end), null, 0);
        abiPromises.push(s.setString(web3.sha3("ProposalsManager_Abi_Part_" + i), part));
      }
      return Promise.all(abiPromises);
    }).then(() => {
      return deployer.then(() => s.allowAccess(ProposalManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(AppsManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(EventsManager.address));
    }).then(() => {
      return deployer.then(() => s.allowAccess(ParameterRegistry.address));
    }).then(() => {
      return ParameterRegistry.deployed();
    }).then((parameterRegistry) => {
      return deployer.then(() => parameterRegistry.setupDefaultParameters());
    });
  });
}

// TODO: This is used in the libraries migration file too. Share.
function getAventusStorage(deployer, network) {
  if (network === "development") {
    return AventusStorage.deployed();
  } else {
    const rawdata = fs.readFileSync("./api/storage.json");
    return deployer.then(() => AventusStorage.at(JSON.parse(rawdata).address));
  }
}
