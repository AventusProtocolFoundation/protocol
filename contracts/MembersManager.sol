pragma solidity ^0.4.24;

import './interfaces/IMembersManager.sol';
import './interfaces/IAventusStorage.sol';
import './libraries/LMembers.sol';
import './Owned.sol';
import './Versioned.sol';

contract MembersManager is IMembersManager, Owned, Versioned {

    IAventusStorage public s;

    constructor(IAventusStorage _s) public {
      s = _s;
    }

    function registerMember(address _memberAddress, string _memberType, string _evidenceUrl, string _desc)
      external
      onlyOwner
    {
      LMembers.registerMember(s, _memberAddress, _memberType, _evidenceUrl, _desc);
    }

    function deregisterMember(address _memberAddress, string _memberType)
      external
      onlyOwner
    {
      LMembers.deregisterMember(s, _memberAddress, _memberType);
    }

    function challengeMember(address _memberAddress, string _memberType) external {
      LMembers.challengeMember(s, _memberAddress, _memberType);
    }

    function endMemberChallenge(address _memberAddress, string _memberType) external {
      LMembers.endMemberChallenge(s, _memberAddress, _memberType);
    }

    function getNewMemberDeposit(string _type) external view returns (uint memberDepositInAVT_) {
      memberDepositInAVT_ = LMembers.getNewMemberDeposit(s, _type);
    }

    function getExistingMemberDeposit(address _memberAddress, string _memberType)
      external
      view
      returns (uint memberDepositInAVT_)
    {
      memberDepositInAVT_ = LMembers.getExistingMemberDeposit(s, _memberAddress, _memberType);
    }
}
