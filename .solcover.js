// See https://www.npmjs.com/package/solidity-coverage?activeTab=readme

module.exports = {
    skipFiles: [
      'libraries/LAventusTime.sol',
      'libraries/testing/LAventusTimeMock.sol',
      'libraries/testing/LProposalForTesting.sol',
      'testing/AVTContractForTesting.sol',
      'libraries/zokrates/LSigmaProofVerifier.sol',
      'testing/AventusStorageForTesting.sol'
    ]
};