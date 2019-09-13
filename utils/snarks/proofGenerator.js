const fs = require('fs');
const java = require('java');
const jarDir = __dirname+'/jars';
const dependencies = fs.readdirSync(jarDir);

dependencies.forEach(function(dependency) {
  java.classpath.push(jarDir + '/' + dependency);
});

var pg = java.import('zksnarks.bctv14.ProofGen');

function generateProof(obj) {
  return pg.mainSync(java, obj);
}

module.exports = {
  generateProof : generateProof
}