const helper = require('./helpers/profileLogsHelper');

function processLines(_database, _lines) {
  _lines.forEach(function(line) {
    doProcessLine(line, _database);
  });
}

function doProcessLine(_line, _database) {
  if (!_line) return;
  let id, context, restOfLine, data;
  [id, restOfLine] = helper.getIdFromLine(_line);
  [context, restOfLine] = helper.getContextfromLine(restOfLine);
  data = restOfLine.split(',');

  if (helper.isSummaryLine(data)) {
    processSummaryLine(_database, id, context, data);
  } else {
    processStatLine(_database, id, context, data);
  }

}

function processSummaryLine(_database, _id, _context, _data) {
  helper.registerTestIfNeeded(_database, _id);
  let test = helper.getTest(_database, _id);
  helper.addSummaryToTest(test, _context, _data);

  if (!helper.isBlockType(_context) && !test.test) {
    test.test = _context;
  }
}

function processStatLine(_database, _id, _context, _data) {
  let contract, method;
  let nCalls, totalTime, avgTime;
  [contract, method] = _data[0].split('.');
  [nCalls, totalTime, avgTime] = _data.slice(1);
  _database.stats.push([_id, _context, contract, method, nCalls, totalTime, avgTime]);
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


