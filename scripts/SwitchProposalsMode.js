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

  // TODO: Think of a better way of doing this. Using two versions of a lib is tricky for compile and build time deps.
  let contracts = [];

  const proposals_on = [
    '// ONLY_IF_PROPOSALS_ON:',
    '// :ONLY_IF_PROPOSALS_ON'
  ];

  const proposals_off = [
    '/* ONLY_IF_PROPOSALS_ON:',
    ':ONLY_IF_PROPOSALS_ON */'
  ];

  const contract = path.join(__dirname, '../contracts/libraries/LValidators.sol');
  if (mode === 'on') swap(proposals_off, proposals_on, contract);
  else if (mode === 'off') swap(proposals_on, proposals_off, contract);

  let migrations = [];

  const migrations_proposals_on = [
    'proposalsOn = true'
  ];

  const migrations_proposals_off = [
    'proposalsOn = false'
  ];

  traverseDir(path.join(__dirname, '../migrations'), migrations);
  migrations.forEach(migration => {
    if (mode === 'on') swap(migrations_proposals_off, migrations_proposals_on, migration);
    else if (mode === 'off') swap(migrations_proposals_on, migrations_proposals_off, migration);
  });
}

main();