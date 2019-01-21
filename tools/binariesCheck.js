const fs = require('fs');
const c_path = __dirname+'/../build/contracts';
const MAXBYTES = 24576;

function sizeCheck(_verbose) {
  let oversize = '';
  let data = [];
  let latest = {};
  // create array of built contracts and their bytecode sizes
  fs.readdirSync(c_path).forEach(contract => {
    let contents = JSON.parse(fs.readFileSync(c_path+'/'+contract, 'utf8'));
    data.push({contract: contract.substring(0, contract.indexOf('.')), bsize: Math.round(contents.bytecode.length/2)});
  });
  // sort the array by descending bytecode size
  data.sort((x,y) => (y.bsize - x.bsize));
  // add column headers to table when printing to console
  if (_verbose) console.log("\nLIBRARY\t\t\t\tBYTECODE\n");
  // loop through data, format and print to console if required
  // also search for first contract that is larger than largest deployable bytecode size
  data.forEach(d => {
    let pad = new Array(33 - d.contract.length).join(' ');
    let line = d.contract+pad+[d.bsize];
    latest[d.contract] = d.bsize;
    if (!oversize && latest[d.contract] > MAXBYTES) oversize = d.contract + ' ' + latest[d.contract];
    if (_verbose) console.log(line);
  });
  // return first oversized contract to migrations if any were found
  return oversize;
}
// for running from and printing to console
if (require.main === module) sizeCheck(true);

module.exports = function () {
  return sizeCheck(false);
}