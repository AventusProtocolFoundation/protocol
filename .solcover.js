// See https://www.npmjs.com/package/solidity-coverage?activeTab=readme

// If you change this, also set the port option in truffle.js.
const port = 8555;

// NOTE: norpc MUST be true for Windows:
// - see https://github.com/sc-forks/solidity-coverage/blob/master/docs/faq.md#running-on-windows
// Default to true unless an environment variable flag says otherwise.
// TODO: Reverse this: set the flag in the Windows one only if this works.
const norpc = process.env.SOLIDITY_COVERAGE_USE_RPC === undefined || process.env.SOLIDITY_COVERAGE_USE_RPC == 0;

module.exports = {
    port,
    norpc,
    skipFiles: [
      'libraries/LAventusTime.sol',
      'libraries/testing/LAventusTimeMock.sol',
      'libraries/testing/LProposalForTesting.sol',
      'testing/AVTContractForTesting.sol',
      'libraries/zokrates/LzKSNARKVerifier.sol',
      'testing/AventusStorageForTesting.sol'
    ]
};