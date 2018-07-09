const avtsaleJson = require('./AVTSale.json');
const common = require('./common.js');
const eip55 = require('eip55');
const fs = require('fs');
const binariesCheck = require('../tools/binariesCheck.js')

const Migrations = artifacts.require("Migrations");
const AventusStorage = artifacts.require("AventusStorage");

// ALWAYS deploy storage unless we want to emulate an existing storage contract.
let forceDeployStorage = true;

/**
 * @return Promise wrapping the address of the AVT contract.
 */
function getAVTContract(_deployer, _network, _storage) {
  // Create the AVT only if it doesn't exist.
  let avtPromise = _storage.getAddress(web3.sha3("AVTERC20Instance"));
  return avtPromise
  .then(avtAddress => {
    if (avtAddress != 0) {
      console.log("AVT address exists:", avtAddress);
      return avtPromise;
    }
    console.log("AVT address does not exist. Creating now");
    return createAVTContract();
  });
}

function initialDeploy(_deployer, _network) {
  let storage;
  return _deployer.deploy(Migrations)
  .then(() => getStorageContract(_deployer, _network))
  .then(arg => {
    storage = arg;
    console.log("Storage address:", storage.address);
    return getAVTContract(_deployer, _network, storage);
  })
  .then(arg => {
    console.log("AVT ERC20 address:", arg);
    return storage.setAddress(web3.sha3("AVTERC20Instance"), arg);
  });
}

// Deploy a new (or use the old) storage contract.
function getStorageContract(deployer, network) {
  if (forceDeployStorage) {
    console.log("Deploying storage contract");
    return deployAndSaveStorageContract(deployer);
  } else {
    console.log("Using existing storage contract");
    // This weird way of error handling is because the truffleContract is thenable but not a proper
    // promise. See https://github.com/trufflesuite/truffle-contract/blob/develop/contract.js.
    const truffleContract = common.getStorageContractFromJsonFile(deployer, AventusStorage);
    return truffleContract
    .then(() => truffleContract).catch(e => {
      console.log("No existing storage contract");
      return deployAndSaveStorageContract(deployer);
    });
  }
}

function deployAndSaveStorageContract(deployer) {
  console.log("Deploying storage contract...");
  return deployer.deploy(AventusStorage)
  .then(storage => {
    console.log("...saving storage contract for reuse.");
    common.saveStorageContractToJsonFile(AventusStorage);
    return AventusStorage.deployed();
  });
}

function exitOnOversizeBinary() {
  let oversize = binariesCheck();
  if (oversize) {
    console.log('\n*BINARY OVERSIZE*', oversize, 'bytes\n');
    process.exit(1);
  }
}

module.exports = function(deployer, network, accounts) {
  exitOnOversizeBinary();

  if (network === "live" || network === "rinkeby") {
    return deployer;
  }
  console.log("PRIVATE NETWORK DEPLOYMENT");
  console.log("*** Version of web3: ", web3.version.api);
  console.log("*** Starting setup...");

  return initialDeploy(deployer, network)
  .then(() => console.log("*** SETUP COMPLETE"));
};

function createAVTContract() {
  const account =  web3.eth.accounts[0];
  const start = web3.eth.getBlock('latest').timestamp;

  const ethereumOptions = {
    from: account,
    data: avtsaleJson.bytecode,
    gas: 4000000
  };
  // See https://github.com/AventusProtocolFoundation/token-sale/blob/master/src/AvtSale.sol for parameters.
  return new Promise((resolve, reject) => {
    web3.eth.contract(avtsaleJson.abi).new(start, account, account, account, ethereumOptions,
      (err, result) => {
        if (err) {
          reject(err);
        } else if (result.address) {
          // Callback is called twice, wait for the one with a valid address.
          resolve(eip55.encode(result.avt()));
        }
      });
    });
}
