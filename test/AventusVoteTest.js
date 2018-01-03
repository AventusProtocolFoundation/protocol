// Specifically request an abstraction for AventusVote
const AventusVote = artifacts.require("AventusVote.sol");

contract('AventusVote - Proposal set-up', function () {
    const oneDay = 86400;    // seconds in one day.
    const minimumVotingPeriod = 7 * oneDay;
    const tenThousandYears = 10000 * 365 * oneDay;
    var aventusVote;
    var proposalId = 0;

    // These are the standard addresses from Ganache. If you are NOT using
    // Ganache, you will need to change these.
    const owner1 = "0x627306090abaB3A6e1400e9345bC60c78a8BEf57";
    const owner2 = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";

    before(async function () {
        aventusVote = await AventusVote.deployed();
    });

    // Get the current timestamp in seconds.
    function now() {
        return Math.floor((new Date()).getTime() / 1000);
    }
    
    function minimumLobbyStartTime() {
        return now();
    }

    async function expectRevert(myFunc) {
        try {
            await myFunc();
            assert.fail("TEST FAILED");
        } catch (error) {
            assert(error.toString().includes(
            'Error: VM Exception while processing transaction: revert'),
            "Was not expecting: " + error.toString())
        }
    }

    async function createProposal(desc, owner) {
        await aventusVote.createProposal(desc, {from: owner || owner1});
        ++proposalId;
        // TODO: test event and get proposalId from that event instead.
    }

    async function addProposalOptionSucceeds(desc) {
        await addProposalOptionWithOwnerSucceeds(desc);
    }

    async function addProposalOptionFails(desc) {
        await expectRevert(() => addProposalOptionWithIdAndOwner(proposalId, desc));
    }
    
    async function addProposalOptionWithOwnerSucceeds(desc, owner) {
        await addProposalOptionWithIdAndOwner(proposalId, desc, owner);
        // TODO: test event.
    }

    async function addProposalOptionWithIdAndOwner(proposalId_, desc, owner) {
        await aventusVote.addProposalOption(proposalId_, desc, {from:owner || owner1});
    }

    async function finaliseProposalSucceeds() {
        // TODO: test event.
        await finaliseProposalWithIdAndOwner(proposalId);
    }

    async function finaliseProposalFails() {
        await expectRevert(() => finaliseProposalWithIdAndOwner(proposalId));
    }

    async function finaliseProposalWithIdAndOwner(proposalId_, owner) {
        await aventusVote.finaliseProposal(
            proposalId_, minimumLobbyStartTime(), minimumVotingPeriod, {from: owner || owner1});
    }

    it("can create, add options to, and finalise a valid proposal", async function() {
        await createProposal("What shall we do for a team outing?");
        await addProposalOptionSucceeds("Bowling");
        await addProposalOptionSucceeds("Jet-skiiing");
        await finaliseProposalSucceeds();
    });

    it("can create a proposal with the same description as an existing one", async function() {
        await createProposal("What shall we do for a team outing?");
    });

    /*********
    * OPTIONS
    **********/
    it("can create and finalise a proposal with 2 to 5 options", async function() {
        for (i = 2; i <= 5; ++i) {
            await createProposal("Aventus to move office to which floor?");
            for (j = 1; j <= i; ++j) {
                await addProposalOptionSucceeds(j);
            }
            await finaliseProposalSucceeds();
        }
    });

    it("cannot add more than 5 options to a proposal", async function() {
        await createProposal("Which pub this Friday?");
        await addProposalOptionSucceeds("Ye Olde Chesire Cheese");
        await addProposalOptionSucceeds("Ye Olde Cock");
        await addProposalOptionSucceeds("The Tipperaray");
        await addProposalOptionSucceeds("Punch Tavern");
        await addProposalOptionSucceeds("The Albion");
        await addProposalOptionFails("The Old Bank of England");
        await addProposalOptionFails("The George");
    });

    it("cannot add an option to a finalised proposal", async function() {
        await createProposal("Shall we buy out Ticketmaster?");
        await addProposalOptionSucceeds("Yes");
        await addProposalOptionSucceeds("No");
        await finaliseProposalSucceeds();
        await addProposalOptionFails("Maybe");
    });

    it("cannot add an option to a non-existent proposal", async function() {
        await expectRevert(() => addProposalOptionWithIdAndOwner(99, "Yes"));
    });

    it("cannot add an option if not proposal owner", async function() {
        await createProposal("Writing test proposals is hard", owner2);
        await addProposalOptionWithOwnerSucceeds("Agreed", owner2);
        await addProposalOptionFails("Nah");
    });

    /***************
    ** FINALISING
    ***************/
    it("cannot finalise a finalised proposal", async function() {
        await createProposal("Shall we buy out Ticketmaster?");
        await addProposalOptionSucceeds("Yes");
        await addProposalOptionSucceeds("No");
        await finaliseProposalSucceeds();
        await finaliseProposalFails();
    });

    it("cannot finalise a proposal if not owner", async function() {
        await createProposal("Writing test proposals is hard");
        await addProposalOptionSucceeds("Agreed");
        await addProposalOptionSucceeds("Nah");
        await expectRevert(() => finaliseProposalWithIdAndOwner(proposalId, owner2));
        await finaliseProposalSucceeds();
    });

    it("cannot finalise a non-existent proposal", async function() {
        await expectRevert(() => finaliseProposalWithIdAndOwner(99));
    });
    
    it("cannot finalise a proposal with 0 or 1 options", async function() {
        await createProposal("Aventus to move to a new building");
        await finaliseProposalFails();
        await addProposalOptionSucceeds("Waterloo");
        await finaliseProposalFails();
    });

    it("cannot finalise a proposal with invalid times", async function() {
        await createProposal("Bad times are coming");
        await addProposalOptionSucceeds("Yup");
        await addProposalOptionSucceeds("Nope");
        await expectRevert(() => aventusVote.finaliseProposal(
            proposalId, minimumLobbyStartTime() - 1, minimumVotingPeriod));
        await expectRevert(() => aventusVote.finaliseProposal(
                proposalId, minimumLobbyStartTime(), minimumVotingPeriod - 1));
    });
    
    it("can finalise a proposal far in the future", async function() {
        await createProposal("Long waiting periods are coming");
        await addProposalOptionSucceeds("Yup");
        await addProposalOptionSucceeds("Nope");
        await aventusVote.finaliseProposal(
            proposalId, now() + tenThousandYears, tenThousandYears);
    });

});