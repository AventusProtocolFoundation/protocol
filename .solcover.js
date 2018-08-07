module.exports = {
    port: 8555,
    norpc: true,
    skipFiles: [
      'libraries/LAventusTime.sol',
      'libraries/testing/LAventusTimeMock.sol',
      'libraries/testing/LProposalForTesting.sol',
      'testing/AventusStorageForTesting.sol'
    ]
};