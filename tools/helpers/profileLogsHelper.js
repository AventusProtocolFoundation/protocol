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

function readFile(_filename) {
  var data = fs.readFileSync(_filename, 'utf8');
  return data;
}

function getIdFromLine(_line) {
  let sep = ' - "';
  let firstDash = _line.indexOf(sep);
  let head = _line.slice(0, firstDash);
  let tail = _line.slice(firstDash + sep.length);
  return [head, tail];
}

function getContextfromLine(_line) {
  let sep = '",';
  let firstDash = _line.indexOf(sep);
  let head = _line.slice(0, firstDash);
  let tail = _line.slice(firstDash + sep.length);
  return [head, tail];
}

function registerTestIfNeeded(_database, _id) {
  if (!(_id in _database.tests)) {
    _database.tests[_id] = {};
  }
}

function isBlockType(_name) {
  if (_name === afterEach) return true;
  if (_name === beforeEach) return true;
  return false;
}

function getTest(_database, _id) {
  return _database.tests[_id];
}

function isSummaryLine(_parts) {
  if (_parts[0] === partsTime) return true;
  if (_parts[0] === totalTime) return true;
  return false;
}

function addSummaryToTest(_test, _context, _data) {
  let time = parseInt(_data[1]);

  if (_context === afterEach && _data[0] === partsTime) {
    _test.afterEachTime = time;
    return;
  }

  if (_context === beforeEach && _data[0] === partsTime) {
    _test.beforeEachTime = time;
    return;
  }

  if (_data[0] === partsTime) {
    _test.partsTime = time;
    return;
  }

  if (_data[0] === totalTime) {
    _test.totalTime = time;
    return;
  }
}

function getOutFilename(_prefix, _basename) {
  return `${_prefix}_${_basename}.txt`;
}

function getLogger(_prefix, _tableName) {
  let filename;
  let logger;
  if (_prefix) {
    filename = getOutFilename(_prefix, _tableName);
    logger = fs.createWriteStream(filename, {flags: 'w'});
  }
  return logger;
}

function doWrite(_dataString, _logger) {
  if (_logger) {
    logger.write(_dataString);
    logger.write('\n');
  } else {
    console.log(_dataString);
  }
}

function dumpTests(_table, _prefix) {
  let logger = getLogger(_prefix, 'Tests');

  Object.keys(_table).forEach(function(key) {
    let test = _table[key];
    let data = [key, test.test, test.totalTime, test.partsTime, test.beforeEachTime, test.afterEachTime];
    let dataString = data.map(value => (value === undefined ? '0.0' : value)).join('\t');
    doWrite(dataString, logger);
  });

  if (logger) logger.end();
}

function dumpStats(_table, _prefix) {
  let logger = getLogger(_prefix, 'Stats');

  _table.forEach(function(stats) {
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
