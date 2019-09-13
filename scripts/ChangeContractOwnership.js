const aventusApi = require('../api/AventusCommon.js').instance;

async function main() {
  const contractName = process.argv[2];
  if (contractName == null) {
    error("Must pass contractName");
  }

  const newOwnerAddress = process.argv[3];
  if (newOwnerAddress == null) {
    error("Must pass new owner address");
  }

  console.log("\n*** Initialising Aventus.js... ***");
  await aventusApi.initialise('');
  console.log("*** ...done***\n");

  var contract;
  if (contractName == 'validatorsManager')
    contract = aventusApi.validatorsManager;
  else
    error("contractName " + contractName + " not supported");

  const ownedContract = await aventusApi.getOwnedContract(contract._address);
  const existingOwnerAddress = await ownedContract.methods.owner().call();
  console.log("Existing owner is:", existingOwnerAddress);
  if (existingOwnerAddress == newOwnerAddress) {
    error("Cannot set to existing owner");
  }

  let params = aventusApi.parameters;
  const oldFromAddress = params.from;
  params.from = existingOwnerAddress;
  params.gas = await ownedContract.methods.setOwner(newOwnerAddress).estimateGas(params);
  const gasPrice = await web3.eth.getGasPrice();
  const weiRequired = gasPrice * params.gas;
  const existingOwnerBalance = await web3.eth.getBalance(existingOwnerAddress);

  console.log("Wei required  =", weiRequired);
  console.log("Owner balance =", existingOwnerBalance);

  if (weiRequired > existingOwnerBalance) {
    console.log("*** WARNING: weiRequired > existingOwnerBalance: transaction may fail");
  } else {
    console.log("Balance should be enough");
  }

  console.log("Setting owner to", newOwnerAddress);
  try {
    await ownedContract.methods.setOwner(newOwnerAddress).send(params);
  } catch (e) {
    error("setting owner:", e);
  }
  console.log("...done");
  const newOwner = await ownedContract.methods.owner().call();
  console.log("Owner is now:", newOwner);
  if (newOwner.toLowerCase() != newOwnerAddress.toLowerCase()) {
    error("owner was not set!");
  }
  aventusApi.tearDown();
}

function error(_msg) {
  console.log("ERROR:", _msg);
  aventusApi.tearDown();
  process.exit(1);
}

return main();

