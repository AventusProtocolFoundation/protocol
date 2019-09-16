const crypto = require('crypto');
const fs = require('fs');
const proofGenerator = require('./proofGenerator.js');
const cachePath = __dirname+'/proofCache.json';

async function generateSnarkData(_secret, _merchantAddress, _ticketOwnerAddress) {
  let merchantAddress = _merchantAddress.substring(2);
  let ticketOwnerAddress = _ticketOwnerAddress.substring(2);

  let merchantHash = crypto.createHash('sha256').update(Buffer.from(_secret + merchantAddress, 'hex')).digest('hex');
  let ticketOwnerHash = crypto.createHash('sha256').update(Buffer.from(_secret + ticketOwnerAddress, 'hex')).digest('hex');

  const zorroProof = {
    secret : _secret,
    merchantAddress : merchantAddress,
    ticketOwnerAddress : ticketOwnerAddress,
    merchantHash : merchantHash,
    ticketOwnerHash : ticketOwnerHash
  }

  const key = _secret + _merchantAddress + _ticketOwnerAddress;
  if (!(fs.existsSync(cachePath))) {
    var data = JSON.stringify({});
    fs.writeFileSync(cachePath, data);
  }
  const cached = JSON.parse(fs.readFileSync(cachePath));
  let proofObj;

  if (cached[key] === undefined) {
    console.log("*** Creating a snark proof - this may take some time...");
    proofObj = JSON.parse(proofGenerator.generateProof(JSON.stringify(zorroProof)));
    console.log("*** ...done")
    cached[key] = proofObj;
    fs.writeFileSync(cachePath, JSON.stringify(cached));
  } else {
    proofObj = cached[key];
  }

  proofObj.proof.B[0].reverse();
  proofObj.proof.B[1].reverse();

  const merchantHashBytes32 = '0x' + merchantHash;
  const ticketOwnerHashBytes32 = '0x' + ticketOwnerHash;

  const merchantSignedHash = await web3.eth.sign(merchantHashBytes32, _merchantAddress);
  const ticketOwnerSignedHash = await web3.eth.sign(ticketOwnerHashBytes32, _ticketOwnerAddress);

  return {
    merchantSignedHash,
    ticketOwnerSignedHash,
    proofObj
  }
}

function encodeSnarkData(_snarkData) {
  const proof = _snarkData.proofObj.proof;
  const input = _snarkData.proofObj.input;
  const snarkProof = web3.eth.abi.encodeParameters(
      ['uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[]'],
      [proof.A, proof.A_p, proof.B[0], proof.B[1], proof.B_p, proof.C, proof.C_p, proof.K, proof.H, input]);

  return web3.eth.abi.encodeParameters(['bytes', 'bytes', 'bytes'],
      [_snarkData.merchantSignedHash, _snarkData.ticketOwnerSignedHash, snarkProof]);
}

async function generateEncodedSnarkData(_secret, _merchantAddress, _ticketOwnerAddress) {
  const snarkData = await generateSnarkData(_secret, _merchantAddress, _ticketOwnerAddress);
  return encodeSnarkData(snarkData);
}

module.exports = {
  encodeSnarkData,
  generateEncodedSnarkData,
  generateSnarkData,
}