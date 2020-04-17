const crypto = require('crypto');
const fs = require('fs');
const proofGenerator = require('./sigmaProofGenerator.js');
const web3Tools = require('../web3Tools.js');

async function generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData) {
  return generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData, null);
}

async function generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData, _randomness) {
  const ticketUniquenessHash = (web3Tools.hash({t: 'uint', v: _immutableLeafData.eventId},
      {t: 'string', v:_immutableLeafData.ticketRef}, {t: 'address', v: _immutableLeafData.vendor})).substring(2);

  const merchantAddressPlusHash = _merchantAddress + ticketUniquenessHash;
  const ticketOwnerAddressPlusHash = _ticketOwnerAddress + ticketUniquenessHash;

  const proofInputs = {
    secret : 'some_secretive_secret',
    merchantAddress : merchantAddressPlusHash,
    ticketOwnerAddress : ticketOwnerAddressPlusHash,
    randomness: _randomness
  }

  const sigmaProof = JSON.parse(proofGenerator.generateProof(proofInputs));
  // TODO: - Do we need to hash these inputs prior to signing? BE/FE decisions over what's getting signed and how await!
  const merchantInputsHash = web3Tools.hash({t:'uint[2]', v: sigmaProof.publicInputs[0]});
  const ticketOwnerInputsHash = web3Tools.hash({t:'uint[2]', v: sigmaProof.publicInputs[1]});
  const merchantSignedInputsHash = await web3Tools.sign(merchantInputsHash, _merchantAddress);
  const ticketOwnerSignedInputsHash = await web3Tools.sign(ticketOwnerInputsHash, _ticketOwnerAddress);

  return {
    merchantSignedInputsHash,
    ticketOwnerSignedInputsHash,
    sigmaProof
  }
}

function encodeSigmaData(_sigmaData) {
  const commitments = _sigmaData.sigmaProof.commitments;
  const generators = _sigmaData.sigmaProof.generators;
  const publicInputs = _sigmaData.sigmaProof.publicInputs;
  const response = _sigmaData.sigmaProof.response;
  const sigmaProof = web3Tools.encodeParams(['uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]', 'uint[2]',
      'uint[2]'], [generators[0], generators[1], publicInputs[0], publicInputs[1], commitments[0], commitments[1],
      [response.witness, response.blinder]]);
  return web3Tools.encodeParams(['bytes', 'bytes', 'bytes'], [_sigmaData.merchantSignedInputsHash,
      _sigmaData.ticketOwnerSignedInputsHash, sigmaProof]);
}

async function createSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData, _randomness) {
  const sigmaData = await generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData, _randomness);
  return encodeSigmaData(sigmaData);
}

async function createSigmaDataAndGetRandomness(_merchantAddress, _ticketOwnerAddress, _immutableLeafData) {
  const sigmaData = await generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData);
  return {
    sigmaData: encodeSigmaData(sigmaData),
    randomness: sigmaData.sigmaProof.randomness
  };
}

async function createInvalidSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData) {
  const sigmaData = await generateSigmaData(_merchantAddress, _ticketOwnerAddress, _immutableLeafData);
  sigmaData.sigmaProof.response.witness = 0;
  return encodeSigmaData(sigmaData);
}

module.exports = {
  createSigmaData,
  createSigmaDataAndGetRandomness,
  createInvalidSigmaData
}