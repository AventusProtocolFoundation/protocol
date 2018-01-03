var Migrations = artifacts.require("./Migrations");
var AventusStorage = artifacts.require("./AventusStorage");
var Vote = artifacts.require("./AventusVote");
var AventusData = artifacts.require("./AventusData");
var LProposal = artifacts.require("./libraries/LProposal");
var LLock = artifacts.require("./libraries/LLock");
var PProposal = artifacts.require("./proxies/PProposal");
var PLock = artifacts.require("./proxies/PLock");

module.exports = function(deployer, network, accounts) {
  var addrLProposal, addrLLock;

  var d;
  var s;
  var avt;
  deployer.deploy(AventusData).then(function() {
    console.log("deploying aventusdata");

     return AventusData.deployed();
   }).then(function(instance) {
     d = instance;
     return d.s();
   }).then(function(storageAddress) {
     s = AventusStorage.at(storageAddress);
     return d.avt();
   }).then(function(avt_) {
     avt = avt_;
     return deployer.deploy(Migrations);
  }).then(function() {
     return deployer.deploy(LProposal);
  }).then(function() {
    return deployer.deploy(LLock);
  }).then(function() {
    return deployer.deploy(PProposal);
  }).then(function() {
    return deployer.deploy(PLock);
  }).then(function() {
    addrLProposal = LProposal.address;
    addrLLock = LLock.address;

    // Link to the proxy not the actual implementation
    LProposal.address = PProposal.address;
    LLock.address = PLock.address;

    deployer.link(LProposal, Vote);
    deployer.link(LLock, Vote);

    return deployer.deploy(Vote, s.address);
  }).then(function() {
    console.log("Setting AVT address = " + avt);

    return s.setAddress(web3.sha3("AVT"), avt);
  }).then(function() {
    return s.setBoolean(web3.sha3("LockRestricted"), true);
  }).then(function() {
    return s.setUInt(web3.sha3("LockAmountMax"), web3.toWei(1, 'ether'));
  }).then(function() {
    return s.setUInt(web3.sha3("LockBalanceMax"), web3.toWei(1000, 'ether'));
  }).then(function() {
    return s.setAddress(web3.sha3("LProposalInstance"), addrLProposal);
  }).then(function() {
    return s.setAddress(web3.sha3("LLockInstance"), addrLLock);
  }).then(function() {
    return s.setOwner(Vote.address);
  });

};
