const avtsaleJson = require('./AVTSale.json');
const common = require('./common.js');
const eip55 = require('eip55');
const binariesCheck = require('../tools/binariesCheck.js')

const Migrations = artifacts.require('Migrations');
const AventusStorage = artifacts.require('AventusStorage');

// ALWAYS deploy storage and AVT ERC20 contracts by default.
const forceDeployStorage = ((process.env.FORCE_DEPLOY_STORAGE || 1) == 1);
const forceDeployAvtErc20 = ((process.env.FORCE_DEPLOY_AVTERC20 || 1) == 1);

async function getExistingAVTContract(_storage) {
  console.log('Using existing AVT ERC20 contract.');
  const avtAddress = await _storage.getAddress(web3.utils.sha3('AVTERC20Instance'));
  if (avtAddress == 0) {
    throw '***ERROR*** can not re-use AVT ERC20 contract because it is not set in storage';
  }
}

async function initialDeploy(_deployer, _network, _accounts) {
  await _deployer.deploy(Migrations);
  const storage = await getStorageContract(_deployer, _network);
  if (forceDeployAvtErc20) {
    await createAVTContract(storage, _accounts);
  } else {
    await getExistingAVTContract(storage);
  }
  console.log('AVT ERC20 address:', storage.address);
}

// Deploy a new (or use the old) storage contract.
async function getStorageContract(_deployer, _network) {
  if (forceDeployStorage) {
    console.log('Deploying storage contract');
    await _deployer.deploy(AventusStorage);
    console.log('...saving storage contract for reuse.');
    common.saveStorageContractToJsonFile(AventusStorage, _network);
    return await AventusStorage.deployed();
  } else {
    console.log('Using existing storage contract');
    const storage = common.getStorageContractFromJsonFile(AventusStorage, _network);
    console.log('AventusStorage:', storage.address);
    return storage;
  }
}

function exitOnOversizeBinary() {
  let oversize = binariesCheck();
  if (oversize) {
    console.log('\n*BINARY OVERSIZE*', oversize, 'bytes\n');
    process.exit(1);
  }
}

module.exports = async function(_deployer, _network, _accounts) {
  if (_network !== 'coverage') exitOnOversizeBinary();

  if (_network === 'live') {
    console.log(`network ${_network} not supported by this migration script, skipping...`);
    return _deployer;
  }
  console.log(_network.toUpperCase() + ' NETWORK DEPLOYMENT');
  console.log('*** Version of web3: ', web3.version);
  console.log('*** Starting setup...');

  await initialDeploy(_deployer, _network, _accounts);
  console.log('*** SETUP COMPLETE');
};

async function createAVTContract(_storage, _accounts) {
  const account = _accounts[0];
  const block = await web3.eth.getBlock('latest');

  const ethereumOptions = {
    from: account,
    gas: 6514357 // This should match the value in docker/truffle.js (rinkeby)
  };

  // See https://github.com/AventusProtocolFoundation/token-sale/blob/master/src/AvtSale.sol for parameters.
  const deploy = new web3.eth.Contract(avtsaleJson.abi).deploy({
    data: avtsaleJson.bytecode,
    arguments: [block.timestamp, account, account, account]
  });

  const AVTContract = await deploy.send(ethereumOptions);
  const avtErc20Address = await AVTContract.methods.avt().call();
  await _storage.setAddress(web3.utils.sha3('AVTERC20Instance'), avtErc20Address);
  return avtErc20Address;
}