/* eslint no-console: "off" */

const addTimeInfoToTests = process.env.TEMP_PROFILE;

let originalIt, originalBeforeEach, originalAfterEach;

let stats = {};
let currentScope = {testId: 0};

function addTimeReports(_testContract) {
  if (!addTimeInfoToTests) return;

  originalIt = it;

  it = function(_title, _testFunction) { // eslint-disable-line no-global-assign
    let quotedTitle = `"${_testContract}-${_title}"`;
    let testFunctionWithStats = async function() {
      currentScope.testId++;
      let testStartTime =  new Date();
      resetStats();
      let promise = _testFunction.call(this);
      await promise;
      reportStats(currentScope.testId, quotedTitle);
      let testFinishTime =  new Date();
      console.error(`${currentScope.testId} - ${quotedTitle},Test total time,${testFinishTime - testStartTime}`);
      return promise;
    };

    originalIt.call(this, _title, (_testFunction === undefined) ? undefined : testFunctionWithStats.bind(this));
  };

  originalBeforeEach = beforeEach;
  beforeEach = function(_beforeFunction) { // eslint-disable-line no-global-assign
    let beforeFunctionWithStats = async function() {
      resetStats();
      let promise = _beforeFunction.call(this);
      await promise;
      reportStats(currentScope.testId + 1, '"beforeEach"');
      return promise;
    };

    originalBeforeEach.call(this, _beforeFunction === undefined ? undefined : beforeFunctionWithStats.bind(this));
  };

  originalAfterEach = afterEach;
  afterEach = function(_afterFunction) { // eslint-disable-line no-global-assign
    let afterFunctionWithStats = async function() {
      resetStats();
      let promise = _afterFunction.call(this);
      await promise;
      reportStats(currentScope.testId, '"afterEach"');
      return promise;
    };

    originalAfterEach.call(this, _afterFunction === undefined ? undefined : afterFunctionWithStats.bind(this));
  };
}

function profileContract(_contract, _contractName) {
  if (!addTimeInfoToTests) return _contract;

  let newContract = {};
  let members = Object.keys(_contract);
  let membersDictionary = members.map(m => ({name: m, obj: _contract[m]}));

  membersDictionary.forEach((item) => {
    if (typeof item.obj === 'function' && !item.name.startsWith('Log')) {
      newContract[item.name] = profileFunction(`${_contractName}.${item.name}`, item.obj);
    } else {
      newContract[item.name] = item.obj;
    }
  });
  return newContract;
}

function profileFunction(_name, _f) {
  if (!addTimeInfoToTests) return _f;

  return async function() {
    let startTime = new Date();
    let promise = _f.apply(this, arguments);
    await promise;
    let endTime = new Date();
    let diffTime = endTime - startTime;
    if (stats[_name] === undefined) {
      stats[_name] = {calls: 1, time: diffTime};
    } else {
      stats[_name].calls++;
      stats[_name].time += diffTime;
    }
    return promise;
  };
}

function reportStats(_testId, _context) {
  let totalTime = 0;
  let keys = Object.keys(stats);
  for (let i = 0; i < keys.length; i++) {
    let methodCalled = keys[i];
    let data = stats[methodCalled];
    console.error(`${_testId} - ${_context},${methodCalled},${data.calls},${data.time},${data.time/data.calls}`);
    totalTime   += data.time;
  }
  console.error(`${_testId} - ${_context},Sum of parts time,${totalTime}`);
  resetStats();
}

function resetStats() {
  stats = {};
}

// Keep exports alphabetical.
module.exports = {
  addTimeReports,
  profileContract,
  profileFunction,
  reportStats,
  resetStats,
};