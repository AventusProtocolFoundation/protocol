/* eslint no-console: "off" */

const addTimeInfoToTests = process.env.TEMP_PROFILE;

let originalIt, originalBeforeEach, originalAfterEach;

let stats = {};
let currentScope = {testId: 0};

function addTimeReports(testContract) {
  if (!addTimeInfoToTests) return;

  originalIt = it;

  it = function(title, testFunction) { // eslint-disable-line no-global-assign
    let quotedTitle = `"${testContract}-${title}"`;
    let testFunctionWithStats = async function() {
      currentScope.testId++;
      let testStartTime =  new Date();
      resetStats();
      let promise = testFunction.call(this);
      await promise;
      reportStats(currentScope.testId, quotedTitle);
      let testFinishTime =  new Date();
      console.error(`${currentScope.testId} - ${quotedTitle},Test total time,${testFinishTime - testStartTime}`);
      return promise;
    };

    originalIt.call(this,title, (testFunction === undefined) ? undefined : testFunctionWithStats.bind(this));
  };

  originalBeforeEach = beforeEach;
  beforeEach = function(beforeFunction) { // eslint-disable-line no-global-assign
    let beforeFunctionWithStats = async function() {
      resetStats();
      let promise = beforeFunction.call(this);
      await promise;
      reportStats(currentScope.testId + 1, '"beforeEach"');
      return promise;
    };

    originalBeforeEach.call(this, beforeFunction === undefined ? undefined : beforeFunctionWithStats.bind(this));
  };

  originalAfterEach = afterEach;
  afterEach = function(afterFunction) { // eslint-disable-line no-global-assign
    let afterFunctionWithStats = async function() {
      resetStats();
      let promise = afterFunction.call(this);
      await promise;
      reportStats(currentScope.testId, '"afterEach"');
      return promise;
    };

    originalAfterEach.call(this, afterFunction === undefined ? undefined : afterFunctionWithStats.bind(this));
  };
}

function profileContract(contract, contractName) {
  if (!addTimeInfoToTests) return contract;

  let newContract = {};
  let members = Object.keys(contract);
  let membersDictionary = members.map(m => ({name: m, obj: contract[m]}));

  membersDictionary.forEach((item) => {
    if (typeof item.obj === 'function' && !item.name.startsWith('Log')) {
      newContract[item.name] = profileFunction(`${contractName}.${item.name}`, item.obj);
    } else {
      newContract[item.name] = item.obj;
    }
  });
  return newContract;
}

function profileFunction(name, f) {
  if (!addTimeInfoToTests) return f;

  return async function() {
    let startTime = new Date();
    let promise = f.apply(this, arguments);
    await promise;
    let endTime = new Date();
    let diffTime = endTime - startTime;
    if (stats[name] === undefined) {
      stats[name] = {calls: 1, time: diffTime};
    } else {
      stats[name].calls++;
      stats[name].time += diffTime;
    }
    return promise;
  };
}

function reportStats(testId, context) {
  let totalTime = 0;
  let keys = Object.keys(stats);
  for (let i = 0; i < keys.length; i++) {
    let methodCalled = keys[i];
    let data = stats[methodCalled];
    console.error(`${testId} - ${context},${methodCalled},${data.calls},${data.time},${data.time/data.calls}`);
    totalTime   += data.time;
  }
  console.error(`${testId} - ${context},Sum of parts time,${totalTime}`);
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