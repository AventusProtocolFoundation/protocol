const common = require('./common.js');
const web3Tools = require('../utils/web3Tools.js');

function setProxiedLibraryAddress(_version, _storage, _libraryName, _libraryAddress) {
  const key = _libraryName + '-' + _version;
  console.log('Setting library hash of', key, 'to use address', _libraryAddress);
  return _storage.setAddress(web3Tools.hash(key), _libraryAddress);
}

async function doDeployLibraryAndProxy(_version, _deploySubLibrariesFunc, _deployer, _storage, _libraryName, _proxyName,
      _library, _proxy, _deployLibraryAndProxy, _dependents) {
  let proxyAddress = await _storage.getAddress(web3Tools.hash(_proxyName));
  if (_deployLibraryAndProxy) {
    await _deploySubLibrariesFunc(_deployer, _library);
    await common.deploy(_deployer, _library);
    await common.deploy(_deployer, _proxy);

    await setProxiedLibraryAddress(_version, _storage, _libraryName, _library.address);
    console.log('Using newly deployed', _proxyName, _proxy.address);
    await _storage.setAddress(web3Tools.hash(_proxyName), _proxy.address);
    proxyAddress = _proxy.address;
  } else if (proxyAddress == 0) {
    console.log('WARNING: DOES NOT EXIST:', _proxyName);
    return;
  } else {
    console.log('Using pre-existing', _proxyName, proxyAddress);
  }

  _library.address = proxyAddress;
  await linkMultiple(_deployer, _library, _dependents);
}

// This is a hack because truffle v5 currently deals very badly with linking multiple dependents at once
async function linkMultiple(_deployer, _contract, _dependents) {
  for (i = 0; i < _dependents.length; i++) {
    await _deployer.link(_contract, _dependents[i]);
  }
  return _deployer;
}

module.exports = {
  doDeployLibraryAndProxy,
  linkMultiple,
  setProxiedLibraryAddress
};