const MembersManager = artifacts.require("MembersManager");
const web3Utils = require('web3-utils');

let testHelper, membersManager;

async function before(_testHelper) {
  testHelper = _testHelper;
  membersManager = await MembersManager.deployed();
};

async function depositAndRegisterMember(_memberAddress, _memberType, _evidenceUrl, _desc) {
  let amount = await membersManager.getNewMemberDeposit(_memberType);
  await testHelper.addAVTToFund(amount, _memberAddress, "deposit");
  await membersManager.registerMember(_memberAddress, _memberType, _evidenceUrl, _desc);
}

async function deregisterMemberAndWithdrawDeposit(_memberAddress, _memberType) {
  await membersManager.deregisterMember(_memberAddress, _memberType)
  let deposit = await membersManager.getNewMemberDeposit(_memberType);
  await testHelper.withdrawAVTFromFund(deposit, _memberAddress, "deposit");
}

module.exports = {
  before,
  depositAndRegisterMember,
  deregisterMemberAndWithdrawDeposit,
}