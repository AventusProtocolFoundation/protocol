// TODO: Change all uses of web3 in our codebase to use these methods instead.
/**
 * TODO: All other calls to web3 in our codebase not handled here yet.
  - web3.eth.abi.encodeFunctionCall
  - web3.eth.Contract
  - web3.eth.getBalance
  - web3.eth.getTransactionCount
  - web3.eth.getGasPrice
  - web3.eth.sendTransaction
  - web3.utils.fromWei
  - web3.utils.toWei
  - web3.utils.sha3
  - web3.utils.toChecksumAddress
  - web3.versioned
*/

/**
 * Big Numbers
 */

function toBN(_number) {
  return web3.utils.toBN(_number);
}

function isBN(_number) {
  return web3.utils.isBN(_number);
}

/**
 * Hashing, signing, encoding of _data
 */

function encodeParams(typesArr, argsArr) {
  return web3.eth.abi.encodeParameters(typesArr, argsArr);
}

function hash() {
  return web3.utils.soliditySha3(...arguments);
}

function randomBytes32() {
  return web3.utils.randomHex(32);
}

function sign(_data, _signer) {
  return web3.eth.sign(_data, _signer);
}

/**
 * Network
 */
function getNetworkType() {
  return web3.eth.net.getNetworkType();
}

function getAccounts() {
  return web3.eth.getAccounts();
}

function version() {
  return web3.version;
}

// Keep exports alphabetical.
module.exports = {
  BN: () => web3.utils.BN,
  encodeParams,
  getAccounts,
  getNetworkType,
  hash,
  isBN,
  randomBytes32,
  sign,
  toBN,
  version
};