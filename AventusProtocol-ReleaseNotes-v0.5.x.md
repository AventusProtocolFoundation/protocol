# Aventus Protocol 0.5.x Release Notes

This second public major point release (see v0.4.x for the first) represents the state of the protocol after the Solidified Audit.

The audit brought to light a number of issues, none of which were critical, that will be fixed over the next few releases.

The release notes for version 0.5.x follow, listed by sub-release and category, filtered by status.

## Release 0.5.2 - 2018-06-05

Bug fixes:
* Fix migration error which was breaking LLock proxying.

Efficiency improvements:
* Do not deploy LAventusTimeMock or LProposalForTesting on the main net

## Release 0.5.1 - 2018-05-29

Breaking changes:
* AventusVote contract: removed updateStorage and setStorageOwner as per Solidified audit recommendation.
* Removed kill method from Owned parent contract as per Solidified audit recommendation.

Minor changes:
* Updated AVT/US cents constant to today's value (will be updated automatically once live)

Bug fixes:
* Updating AVT/USD price to a non-whole number of dollars showed up rounding errors in test code

## Release 0.5.0 - 2018-05-22

Breaking changes:
* Challenge winnings distribution now uses the withdrawal pattern via a new method, claimVoterWinnings

Bug fixes:
* "internal" library methods have been replaced with "public" to fully enable proxying
* App deposits are now recorded, so changes to the fixedDepositAmount can not lead to loss of funds
* hashEventParameters() now pre-hashes two parameters to avoid problem with more than one variable length parameter. See http://solidity.readthedocs.io/en/v0.4.21/abi-spec.html#abi-packed-mode
* invalid "fund" parameters passed to withdraw or deposit methods are now checked with require, not assert

Efficiency improvements:
* Libraries now use constant bytes32 hashes where possible
* Voting options are now stored as a uint8 instead of a uint
* Removal of some duplicate code around event deposits and ending proposals

Other:
* Tidy up of javadoc, a few more comments added
* Better naming of some variables for consistency
