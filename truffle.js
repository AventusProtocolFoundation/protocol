let walletProvider;

function getWalletProvider() {
  if (walletProvider) {
    return walletProvider;
  }

  const Web3Provider = require('./scripts/Web3Provider.js')
  walletProvider = Web3Provider.getWalletProvider();

  return walletProvider;
}

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 7000000, // This is the max gas estimateGas in the deployer will go up to
      gasPrice: 10e9
    },
    rinkeby: {
      provider: () => getWalletProvider(),
      network_id: 4,
      gas: 7000000, // See https://www.rinkeby.io/#stats to make sure this is not over the network limit
      gasPrice: 10e9 // see latest blocks on https://www.rinkeby.io/#stats for reasonable prices
    },
    mainnet: {
      provider: () => getWalletProvider(),
      network_id: 1,
      gas: 7000000, // See https://ethstats.net/ to make sure this is not over the network limit
      gasPrice: 10e9  // 10 GWEi: see https://ethgasstation.info/ for recommended prices
    },
    coverage: { // See https://www.npmjs.com/package/solidity-coverage?activeTab=readme
      host: "localhost",
      network_id: "*",
      port: 8555,         // If you change this, also set the port option in .solcover.js.
      gas: 0xfffffffffff, // <-- Use this high gas value
      gasPrice: 0x1       // <-- Use this low gas price
    }
  },
  compilers: {
    solc: {
      version: "0.5.2"
    }
  }
};
