const aventusApi = require('../api/AventusCommon.js').instance;

async function main() {
  const payeeAddress = process.argv[2];
  if (payeeAddress == null) {
    error("Must pass payeeAddress address");
  }

  let amount = process.argv[3];
  if (amount == null) {
    error("Must pass amount");
  }

  const unit = process.argv[4];
  if (unit != 'avt' && unit != 'atto') {
    error("Must pass unit of 'avt' or 'atto'");
  }

  console.log("\n*** Initialising Aventus.js... ***");
  await aventusApi.initialise('');
  console.log("*** ...done***\n");

  if (unit == 'avt')
    amount = web3.utils.toWei(amount, 'ether');

  const network = await web3.eth.net.getNetworkType();
  console.log('Network is:', network)

  const currentAccount = (await web3.eth.getAccounts())[0];
  console.log("Using account", currentAccount);
  console.log(currentAccount, "currently has", await aventusApi.avt.methods.balanceOf(currentAccount).call(), " ATTOAVT");

  console.log("Sending", amount, "ATTOAVT from", currentAccount, "to", payeeAddress, "...");
  try {
    if (process.argv[5] != 'pay') {
      console.log("ABI ENCODED TRANSACTION:", await aventusApi.avt.methods.transfer(payeeAddress, amount).encodeABI());
      console.log('To actually send this transaction, run again with "pay" as the last parameter');
    } else {
      await aventusApi.avt.methods.transfer(payeeAddress, amount).send({from: currentAccount});
      console.log("AVT sent");
    }
  } catch (e) {
    error("sending payment:" + e);
  }
  console.log("...done");

  console.log(currentAccount, "now has", await aventusApi.avt.methods.balanceOf(currentAccount).call(), "ATTOAVT");
  console.log(payeeAddress, "now has", await aventusApi.avt.methods.balanceOf(payeeAddress).call(), "ATTOAVT");

  aventusApi.tearDown();
}

function error(_msg) {
  console.log("ERROR:", _msg);
  aventusApi.tearDown();
  process.exit(1);
}

return main();