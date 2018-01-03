pragma solidity ^0.4.19;

import "../contracts/AventusVote.sol";
import "../contracts/AventusStorage.sol";
import "../contracts/AventusData.sol";
import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

contract TestAventusVote {
    AventusVote vote;

    function beforeAll() {
        vote = AventusVote(DeployedAddresses.AventusVote());
    }

    function testMultipleCreateAndFinaliseProposals() public {
        for (uint i = 0; i < 5; ++i) {
            uint proposalId = vote.createProposal("We can haz Cryptokitties?");
            Assert.equal(proposalId, i + 1, "Proposal Ids should be sequential");
            vote.addProposalOption(proposalId, "Yes");
            vote.addProposalOption(proposalId, "No");
            vote.finaliseProposal(proposalId, now + 5 minutes, 10 days);
        }
    }
    
    function testCanFinaliseAProposalFarInTheFuture() public {
        uint proposalId = vote.createProposal("Long waiting periods are coming");
        vote.addProposalOption(proposalId, "Yup");
        vote.addProposalOption(proposalId, "Nope");
        vote.finaliseProposal(proposalId, now + 10000 years, 10000 years);
    }
}
