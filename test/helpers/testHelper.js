const AventusStorage = artifacts.require('AventusStorage');
const Versioned = artifacts.require('Versioned');
const ProposalsManager = artifacts.require('ProposalsManager');
const AVTManager = artifacts.require('AVTManager');
const ValidatorsManager = artifacts.require('ValidatorsManager');
const MerkleLeafChallenges = artifacts.require('MerkleLeafChallenges');
const MerkleRootsManager = artifacts.require('MerkleRootsManager');
const EventsManager = artifacts.require('EventsManager');
const IERC20 = artifacts.require('IERC20');
const profilingHelper = require('./profilingHelper');
const web3Tools = require('../../utils/web3Tools.js');

let accounts;
const validEvidenceURL = 'http://www.example.com/validators?validatorid=1111';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const BN_ZERO = new web3.utils.BN(0);
const BN_ONE = new web3.utils.BN(1);

let aventusStorage, versioned, proposalsManager, validatorsManager, avtManager, merkleRootsManager, eventsManager, avtIERC20;
let merkleLeafChallenges;
let profiledLogArgs = profilingHelper.profileFunction('TestHelper.getLogArgs', getLogArgs);
let lastEventBlockNumber = -1;

async function init() {
  avtManager = await AVTManager.deployed();
  avtManager = profilingHelper.profileContract(avtManager, 'avtManager');
  aventusStorage = await AventusStorage.deployed();
  aventusStorage = profilingHelper.profileContract(aventusStorage, 'aventusStorage');
  eventsManager = await EventsManager.deployed();
  eventsManager = profilingHelper.profileContract(eventsManager, 'eventsManager');
  avtIERC20 = await IERC20.at(await aventusStorage.getAddress(hash('AVTERC20Instance')));
  validatorsManager = await ValidatorsManager.deployed();
  validatorsManager = profilingHelper.profileContract(validatorsManager, 'validatorsManager');
  merkleLeafChallenges = await MerkleLeafChallenges.deployed();
  merkleLeafChallenges = profilingHelper.profileContract(merkleLeafChallenges, 'merkleLeafChallenges');
  merkleRootsManager = await MerkleRootsManager.deployed();
  merkleRootsManager = profilingHelper.profileContract(merkleRootsManager, 'merkleRootsManager');
  proposalsManager = await ProposalsManager.deployed();
  proposalsManager = profilingHelper.profileContract(proposalsManager, 'proposalsManager');
  versioned = await Versioned.deployed();
  versioned = profilingHelper.profileContract(versioned, 'versioned');
  lastEventBlockNumber = -1;

  accounts = await web3.eth.getAccounts();
}

async function expectRevert(_myFunc, _expectedError) {
  const ganacheRevert = 'VM Exception while processing transaction: revert';
  try {
    await _myFunc();
    assert(false, 'Test did not revert as expected');
  } catch (error) {
    assert(error.toString().includes(ganacheRevert), 'Did not get a ganache revert: ' + error.toString());
    if (process.env.SKIP_REVERT_ERR === undefined || process.env.SKIP_REVERT_ERR == 0) {
      assert(error.toString().includes(_expectedError), 'Expected error: ' + _expectedError + ' but got: ' + error.toString());
    }
  }
}

function hash() {
  return web3.utils.soliditySha3(...arguments);
}

async function sign(_signer, _plainData) {
  return web3.eth.sign( _plainData, _signer);
}

function getLogArgs(_contract, _event) {
  return new Promise(async (resolve, reject) => {
    const log = await _contract.getPastEvents(_event, {fromBlock: lastEventBlockNumber + 1})
    if (log.length == 0) {
      reject(new Error('No events found'));
    } else {
      const event = log[log.length - 1];
      lastEventBlockNumber = event.blockNumber;
      resolve(event.args);
    }
  });
}

function getAccounts() {
  if (arguments.length === 0) throw new Error('At least 1 account name must be specified');
  let accountNames = [...new Set(arguments)]; // ensure uniqueness of account names
  if (accountNames.length > 10) throw new Error('No more than 10 account names can be specified');
  let accountMap = {};
  for (let i = 0; i < accountNames.length; i++) {
    accountMap[accountNames[i]] = accounts[i];
  }
  return accountMap;
}

async function getVersion() {
  return await versioned.getVersion();
}

async function getVersionMajorMinor() {
  return await versioned.getVersionMajorMinor();
}

function assertBNEquals(_actual, _expected, _msg) {
  assert(web3.utils.isBN(_actual), "_actual must be a BN");
  assert(web3.utils.isBN(_expected), "_expected must be a BN");
  const msg = _msg || `Expected ${_expected} to equal ${_actual}`;
  assert(_actual.eq(_expected), msg);
}

function assertBNNotEquals(_actual, _expected, _msg){
  assert(web3.utils.isBN(_actual), "_actual must be a BN");
  assert(web3.utils.isBN(_expected), "_expected must be a BN");
  const msg = _msg || `Expected ${_expected} not to equal ${_actual}`;
  assert(!_actual.eq(_expected), msg);
}

function assertBNZero(_actual, _msg) {
  assertBNEquals(_actual, BN_ZERO, _msg);
}

function toBN(_number) {
  return web3.utils.toBN(_number);
}

// TODO: Use web3Tools directly in test code.
function encodeParams(typesArr, argsArr) {
  return web3Tools.encodeParams(typesArr, argsArr);
}

// Keep exports alphabetical.
module.exports = {
  assertBNEquals,
  assertBNNotEquals,
  assertBNZero,
  BN: web3.utils.BN,
  BN_ONE,
  BN_ZERO,
  encodeParams,
  expectRevert,
  getAccounts,
  getAventusStorage: () => aventusStorage,
  getAVTIERC20: () => avtIERC20,
  getAVTManager: () => avtManager,
  getEventsManager: () => eventsManager,
  getLogArgs: profiledLogArgs,
  getValidatorsManager: () => validatorsManager,
  getMerkleLeafChallenges: () => merkleLeafChallenges,
  getMerkleRootsManager: () => merkleRootsManager,
  getProposalsManager: () => proposalsManager,
  getVersion,
  getVersionMajorMinor,
  hash,
  init,
  profilingHelper,
  randomBytes32: () => web3.utils.randomHex(32),
  sign,
  toBN,
  validEvidenceURL,
  zeroAddress
};
