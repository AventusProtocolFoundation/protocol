module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 7554321 // Match the lower of the mainnet/rinkeby values where possible
    },
    rinkeby: {
      host: "localhost",
      port: 8546,
      network_id: 4,
      gas: 7554321, // See https://www.rinkeby.io/#stats to make sure this is not over the network limit
      gasPrice: 10e9  // 10 GWEi
    },
    live: {
      host: "localhost",
      port: 8547,
      network_id: 1,
      from: "0x5126f4c7d6f6436a5a789e939634d5fe7c92fa4b",
      gas: 7654321, // See https://ethstats.net/ to make sure this is not over the network limit
      gasPrice: 10e9  // 10 GWEi: see https://ethgasstation.info/ for recommended prices
    },
  }
};
