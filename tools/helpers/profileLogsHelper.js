var fs = require('fs');

const partsTime = 'Sum of parts time';
const totalTime = 'Test total time';
const afterEach = 'afterEach';
const beforeEach = 'beforeEach';

function processCommandLineArguments() {
  if (process.argv.length <= 2) {
    console.error('Not enough arguments. Usage: node dataParser.js <file to read> [<prefix of output files>]');
    process.exit(1);
  }

  let options = {};
  options.filename = process.argv[2];
  options.outPrefix = process.argv[3] || '';
  return options;
}

function readFile(filename) {
  var data = fs.readFileSync(filename, 'utf8');
  return data;
}

function getIdFromLine(line) {
  let sep = ' - "';
  let firstDash = line.indexOf(sep);
  let head = line.slice(0, firstDash);
  let tail = line.slice(firstDash + sep.length);
  return [head, tail];
}

function getContextfromLine(line) {
  let sep = '",';
  let firstDash = line.indexOf(sep);
  let head = line.slice(0, firstDash);
  let tail = line.slice(firstDash + sep.length);
  return [head, tail];
}

function registerTestIfNeeded(database, id) {
  if (!(id in database.tests)) {
    database.tests[id] = {};
  }
}

function isBlockType(name) {
  if (name === afterEach) return true;
  if (name === beforeEach) return true;
  return false;
}

function getTest(database, id) {
  return database.tests[id];
}

function isSummaryLine(parts) {
  if (parts[0] === partsTime) return true;
  if (parts[0] === totalTime) return true;
  return false;
}

function addSummaryToTest(test, context, data) {
  let time = parseInt(data[1]);

  if (context === afterEach && data[0] === partsTime) {
    test.afterEachTime = time;
    return;
  }

  if (context === beforeEach && data[0] === partsTime) {
    test.beforeEachTime = time;
    return;
  }

  if (data[0] === partsTime) {
    test.partsTime = time;
    return;
  }

  if (data[0] === totalTime) {
    test.totalTime = time;
    return;
  }
}

function getOutFilename(prefix, basename) {
  return `${prefix}_${basename}.txt`;
}

function getLogger(prefix, tableName) {
  let filename;
  let logger;
  if (prefix) {
    filename = getOutFilename(prefix, tableName);
    logger = fs.createWriteStream(filename, {flags: 'w'});
  }
  return logger;
}

function doWrite(dataString, logger) {
  if (logger) {
    logger.write(dataString);
    logger.write('\n');
  } else {
    console.log(dataString);
  }
}

function dumpTests(table, prefix) {
  let logger = getLogger(prefix, 'Tests');

  Object.keys(table).forEach(function(key) {
    let test = table[key];
    let data = [key, test.test, test.totalTime, test.partsTime, test.beforeEachTime, test.afterEachTime];
    let dataString = data.map(value => (value === undefined ? '0.0' : value)).join('\t');
    doWrite(dataString, logger);
  });

  if (logger) logger.end();
}

function dumpStats(table, prefix) {
  let logger = getLogger(prefix, 'Stats');

  table.forEach(function(stats) {
    let dataString = stats.map(value => (value === undefined ? '0.0' : value)).join('\t');
    doWrite(dataString, logger);
  });

  if (logger) logger.end();
}

module.exports = {
  processCommandLineArguments,
  readFile,
  getIdFromLine,
  getContextfromLine,
  isSummaryLine,
  getTest,
  addSummaryToTest,
  registerTestIfNeeded,
  isBlockType,
  dumpTests,
  dumpStats,
};
