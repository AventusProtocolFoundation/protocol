const fs = require('fs');
const c_path = __dirname+'/../build/contracts';
const p_path = __dirname+'/previousBinarySizes.json';
const MAXBYTES = 24576;

function sizeCheck(verbose) {
  // get data from previous run if it exists
  const previous = fs.existsSync(p_path) ? JSON.parse(fs.readFileSync(p_path, 'utf8')) : {};
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
  if (verbose) {
    (Object.keys(previous).length == 0) ?
    console.log("\nLIBRARY\t\t\tBYTECODE") :
    console.log("\nLIBRARY\t\t\tBYTECODE\tPREVIOUS");
  }
  // loop through data, format and print to console if required
  // also search for first contract that is larger than largest deployable bytecode size
  data.forEach(d => {
    let pad = new Array(25 - d.contract.length).join(' ');
    let line = d.contract+pad+[d.bsize,previous[d.contract]].join('\t\t');
    latest[d.contract] = d.bsize;
    if (!oversize && latest[d.contract] > MAXBYTES) oversize = d.contract + ' ' + latest[d.contract];
    if (verbose) console.log(line);
  });
  // write the latest data to 'previous' file for use in the next run
  fs.writeFileSync(p_path, JSON.stringify(latest), 'utf8');
  // return first oversized contract to migrations if any were found
  return oversize;
}
// for running from and printing to console
if (require.main === module) sizeCheck(true);

module.exports = function () {
  return sizeCheck(false);
}