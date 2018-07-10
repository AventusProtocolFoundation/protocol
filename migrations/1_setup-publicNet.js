const avtsaleJson = require('./AVTSale.json');
const eip55 = require('eip55');
const fs = require('fs');

const Migrations = artifacts.require("Migrations");
const AventusStorage = artifacts.require("AventusStorage");

const storageJsonFile = "./api/storage.json";


const rinkebyAvtAddress = "0xCD482900FF3089a2Dadc6f99092F57f91804d436";
const mainNetAvtAddress = "0x0d88ed6e74bbfd96b831231638b66c05571e824f";

module.exports = function(deployer, network, accounts) {
  if (network != "live" && network != "rinkeby") {
    return;
  }
  console.log("PUBLIC NETWORK DEPLOYMENT");
  console.log("*** Version of web3: ", web3.version.api);
  console.log("*** Starting setup of storage and AVT contracts...");

  return deployer.then(() => {
    console.log("Deploying Migrations");
    return deployer.deploy(Migrations);
  }).then(() => {
    console.log("Deploying storage contract");
    return deployer.deploy(AventusStorage)
  }).then(() => {
    console.log("Saving storage contract for reuse");
    const storageObject = {
      address: eip55.encode(AventusStorage.address),
      abi: AventusStorage.abi
    };
    fs.writeFileSync(storageJsonFile, JSON.stringify(storageObject, null, 4));
    return AventusStorage.deployed();
  }).then((storage) => {
    const avtAddress = network === "rinkeby" ? rinkebyAvtAddress : mainNetAvtAddress;
    console.log("Saving AVT address:", avtAddress);
    return storage.setAddress(web3.sha3("AVTERC20Instance"), eip55.encode(avtAddress));
  }).then(() => {
    console.log("*** SETUP COMPLETE");
  });
};
