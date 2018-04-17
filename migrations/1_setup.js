const avtsaleJson = require('./AVTSale.json');
const eip55 = require('eip55');
const fs = require('fs');

const Migrations = artifacts.require("Migrations");
const AventusStorage = artifacts.require("AventusStorage");

const storageJsonFile = "./api/storage.json";

console.log("*** Version of web3: ", web3.version.api);

/**
 * @return Promise wrapping the address of the AVT contract.
 */
function getAVTContract(_deployer, _network, _storage) {
  if (_network === "development") {
    // Always recreate the AVT in development.
    return createAVTContract();
  }

  // Create the AVT only if it doesn't exist.
  let avtPromise = _storage.getAddress(web3.sha3("AVT"));
  return avtPromise.then((avtAddress) => {
    if (avtAddress) return avtPromise;
    return createAVTContract();
  });
}

function initialDeploy(_deployer, _network) {
  return _deployer.deploy(Migrations).then(() =>
    getStorageContract(_deployer, _network).then((s) => {
      console.log("Storage address:", s.address);
      return getAVTContract(_deployer, _network, s).then((avtAddress) => {
        console.log("AVT address:", avtAddress);
        return s.setAddress(web3.sha3("AVT"), avtAddress);
      })
    })
  );
}

// Deploy a new (or use the old) storage contract.
function getStorageContract(deployer, network) {
  if (network === "development") {
    // Always deploy a new one for dev.
    console.log("Deploying storage contract");
    return deployAndSaveStorageContract(deployer);
  } else {
    try {
      console.log("Getting existing storage contract");
      return getExistingStorageContract(deployer);
    } catch (error) {
      console.log("No existing storage contract");
      return deployAndSaveStorageContract(deployer);
    }
  }
}

function getExistingStorageContract(deployer) {
  const rawdata = fs.readFileSync(storageJsonFile);
  console.log("Using existing storage contract");
  return deployer.then(() => AventusStorage.at(JSON.parse(rawdata).address));
}

function deployAndSaveStorageContract(deployer) {
  console.log("Deploying storage contract...");
  return deployer.deploy(AventusStorage).then((s) => {
    console.log("...saving storage contract for reuse.");
    const sAddress = AventusStorage.address;
    const storageObject = { address: eip55.encode(sAddress), abi: AventusStorage.abi };
    fs.writeFileSync(storageJsonFile, JSON.stringify(storageObject, null, 4));
    return AventusStorage.deployed();
  });
}

module.exports = function(deployer, network, accounts) {
  console.log("*** Starting setup...")
  return initialDeploy(deployer, network).then(() => console.log("*** SETUP COMPLETE"));
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

