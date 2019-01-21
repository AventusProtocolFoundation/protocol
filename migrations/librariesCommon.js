function setProxiedLibraryAddress(_web3, _version, _storage, _libraryName, _libraryAddress) {
  const key = _libraryName + '-' + _version;
  console.log('Setting library hash of', key, 'to use address', _libraryAddress);
  return _storage.setAddress(_web3.utils.sha3(key), _libraryAddress);
}

async function doDeployLibraryAndProxy(_web3, _version, _deploySubLibrariesFunc, _deployer, _storage, _libraryName, _proxyName,
      _library, _proxy, _deployLibraryAndProxy, _dependents) {
  let proxyAddress = await _storage.getAddress(_web3.utils.sha3(_proxyName));
  if (proxyAddress == 0 || _deployLibraryAndProxy) {
    await _deploySubLibrariesFunc(_deployer, _library);
    await _deployer.deploy(_library);
    await _deployer.deploy(_proxy);
    await setProxiedLibraryAddress(_web3, _version, _storage, _libraryName, _library.address);
    console.log('Using newly deployed', _proxyName, _proxy.address);
    await _storage.setAddress(_web3.utils.sha3(_proxyName), _proxy.address);
    proxyAddress = _proxy.address;
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
