const fs = require('fs');
const path = require('path');

function traverseDir(_dir, _files) {
  fs.readdirSync(_dir).forEach(file => {
    let fullPath = path.join(_dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath, _files);
    } else {
      _files.push(fullPath);
    }
  });
}

function swap(_from, _to, _contract) {
  let contents = fs.readFileSync(_contract, 'utf8');
  for (var i = 0; i < _from.length; i++) {
    contents = contents.split(_from[i]).join(_to[i]);
  }
  fs.writeFileSync(_contract, contents, 'utf8');
}

function main() {
  const mode = process.argv.slice(2)[0].trim();
  console.log('** Switching code to', mode, 'mode');
  let contracts = [];

  const release = [
    'assert(',
    '/* ONLY_IF_ASSERTS_OFF:',
    ':ONLY_IF_ASSERTS_OFF */',
    '// ONLY_IF_ASSERTS_OFF ',
    '// ONLY_IF_ASSERTS_ON:',
    '// :ONLY_IF_ASSERTS_ON',
    '/* ONLY_IF_ASSERTS_ON */ '
  ];

  // NOTE: asserts cannot be hit by coverage so are commented out for code coverage.
  const skip_asserts = [
    '// ONLY_IF_ASSERTS_ON assert(',
    '// ONLY_IF_ASSERTS_OFF:',
    '// :ONLY_IF_ASSERTS_OFF',
    '/* ONLY_IF_ASSERTS_OFF */ ',
    '/* ONLY_IF_ASSERTS_ON:',
    ':ONLY_IF_ASSERTS_ON */',
    '// ONLY_IF_ASSERTS_ON '
  ];

  traverseDir(path.join(__dirname, '../contracts'), contracts);

  contracts.forEach(contract => {
    if (contract.includes('zokrates')) console.log('Skipping', contract);
    else if (mode === 'release') swap(skip_asserts, release, contract);
    else if (mode === 'skip_asserts') swap(release, skip_asserts, contract);
  });
}

main();