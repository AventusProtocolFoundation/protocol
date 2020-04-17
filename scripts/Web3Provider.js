function error(errorMsg) {
  console.log('\nERROR:', errorMsg);
  process.exit(1);
}

function getWalletProvider() {
  const HdWalletProvider = require('@truffle/hdwallet-provider');

  const walletProviderURI = process.env.ETH_walletProvider_URI;
  if (walletProviderURI == null || walletProviderURI == '') {
    error('must set environment variable ETH_walletProvider_URI, eg:' +
        '\n - Parity node: "http://34.231.21.97:8545"' +
        '\n - Infura node: "https://rinkeby.infura.io/v3/a901223ff1ab4362912fccd5f54a8c17"');
  }

  let security = process.env.ETH_walletProvider_security;
  let numAccounts = 10;
  if (security == 'random') {
    const bip39 = require('bip39');
    security = bip39.generateMnemonic();
  } else if (security == null || security == '') {
    error('must set environment variable ETH_walletProvider_security to one of:' +
        '\n - your bip39 mnemonic phrase' +
        '\n - "random": to use a random bip39 mnemonic for readonly access');
  }

  console.log('Creating wallet provider using address:', walletProviderURI);
  return new HdWalletProvider(security, walletProviderURI, 0, numAccounts);
}

module.exports = {
  getWalletProvider
}