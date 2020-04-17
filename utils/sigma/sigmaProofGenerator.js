const fs = require('fs');
const java = require('java');
const jarDir = __dirname+'/jars';
const dependencies = fs.readdirSync(jarDir);

dependencies.forEach(function(dependency) {
  java.classpath.push(jarDir + '/' + dependency);
});

var pg = java.import('sigma.protocols.pedersen_commitment.SigmaPedersenCommitment');

function generateProof(obj) {
  if(obj.randomness)
   return pg.generateProofSync(obj.merchantAddress, obj.ticketOwnerAddress, obj.secret, obj.randomness);
  else
   return pg.generateProofSync(obj.merchantAddress, obj.ticketOwnerAddress, obj.secret);
}

module.exports = {
  generateProof : generateProof
}