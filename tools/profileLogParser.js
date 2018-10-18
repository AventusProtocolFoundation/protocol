const helper = require('./helpers/profileLogsHelper');

function processLines(database, lines) {
  lines.forEach(function(line) {
    doProcessLine(line, database);
  });
}

function doProcessLine(line, database) {
  if (!line) return;
  let id, context, restOfLine, data;
  [id, restOfLine] = helper.getIdFromLine(line);
  [context, restOfLine] = helper.getContextfromLine(restOfLine);
  data = restOfLine.split(',');

  if (helper.isSummaryLine(data)) {
    processSummaryLine(database, id, context, data);
  } else {
    processStatLine(database, id, context, data);
  }

}

function processSummaryLine(database, id, context, data) {
  helper.registerTestIfNeeded(database, id);
  let test = helper.getTest(database, id);
  helper.addSummaryToTest(test, context, data);

  if (!helper.isBlockType(context) && !test.test) {
    test.test = context;
  }
}

function processStatLine(database, id, context, data) {
  let contract, method;
  let nCalls, totalTime, avgTime;
  [contract, method] = data[0].split('.');
  [nCalls, totalTime, avgTime] = data.slice(1);
  database.stats.push([id, context, contract, method, nCalls, totalTime, avgTime]);
}

let database = {
  tests: {},
  stats: []
};

let options = helper.processCommandLineArguments();
let lines = helper.readFile(options.filename).split('\n');

processLines(database, lines);
helper.dumpTests(database.tests, options.outPrefix);
helper.dumpStats(database.stats, options.outPrefix);


