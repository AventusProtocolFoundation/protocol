module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      host: "localhost",
      port: 8546,
      from: "0xa142e70ea708ef475efd00a82f028fe2de5550f4", // default address to use for any transaction Truffle makes during migrations
      network_id: 4,
      gas: 7654321 // Gas limit used for deploys
    },
    live: {
      host: "localhost",
      port: 8547,
      network_id: 1,
      from: "0x89826e7D8F1202A473a49bA149B57b66bD9885b3",
      gas: 7654321
    }
  }
};
