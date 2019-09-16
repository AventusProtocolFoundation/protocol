const fs = require('fs');
const contractsPath = __dirname+'/../build/contracts';

function getBinariesSizes() {
  let binariesSizes = [];
  // create array of built contracts and their bytecode sizes
  fs.readdirSync(contractsPath).forEach(contract => {
    let contents = JSON.parse(fs.readFileSync(contractsPath + '/' + contract, 'utf8'));
    binariesSizes.push({
      contractName: contract.substring(0, contract.indexOf('.')),
      binarySize: Math.round(contents.bytecode.length/2)
    });
  });

  // sort the array by descending bytecode size
  return binariesSizes.sort((x,y) => (y.binarySize - x.binarySize));
}

function checkBinariesSizes(_logToConsole) {
  const MAX_BYTES = 24576;
  let result = true;
  let latest = {};
  let binariesSizes = getBinariesSizes();

  if (_logToConsole) console.log("\nLIBRARY\t\t\t\tBYTECODE\n");

  binariesSizes.forEach(binary => {
    let pad = new Array(33 - binary.contractName.length).join(' ');
    let line = binary.contractName + pad + [binary.binarySize];
    if (_logToConsole) console.log(line);
    if (binary.binarySize > MAX_BYTES) {
      console.log(binary.contractName, 'over max binary size ('+MAX_BYTES+') by', binary.binarySize - MAX_BYTES, 'bytes');
      result = false;
    }
  });
  return result;
}

// for running from and printing to console
if (require.main === module) checkBinariesSizes(true);

module.exports = () => checkBinariesSizes();