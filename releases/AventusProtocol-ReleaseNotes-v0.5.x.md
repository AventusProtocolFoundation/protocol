# Aventus Protocol 0.5.x Release Notes

This second public major point release (see v0.4.x for the first) represents the state of the protocol after the Solidified Audit and the first main net release.

The audit brought to light a number of issues, none of which were critical, which are fixed in these releases.

The release notes for version 0.5.x follow, listed by sub-release and category, filtered by status.

## Release 0.5.5 - 2018-06-26

Minor changes:
* Consistent naming of primary contract events as LogXXX()
* Removal of LECRecovery and proxy from deployment (all methods are internal)
* Release of initial deployment code used for main net release and support for future partial deployment
* LLock now has account address before fund in mapping schema and is used directly
* Various minor clean up and efficiency/consistency changes in Solidity and test code

## Release 0.5.4 - 2018-06-19

DEPLOYED TO MAIN NET 2018-06-20: see MainNetRelease-20180620.md for details.

Breaking changes:
* All signed methods now use Zeppelin elliptic curve, ECRecovery, library, as suggested by Solidified.
* Storage no longer has any "delete" methods - use set to 0 instead - this saves on deployment gas and ABI.

Minor changes:
* Completed Solidified audit - all remaining tasks have now been dealt with:
  *  9 - Use more consistent variable naming
  * 13 - Make setting and getting values from storage more consistent
  * 18 - Refactor signature checking mechanism
  * 19 - Consider using external.

## Release 0.5.3 - 2018-06-12

Major changes:
* Updated all code to Solidity v0.4.24: enforced use of abi.encodePacked for all keccak256 calls.
* Split libraries into smaller, sub-libraries due to going over size limits when deploying

Minor changes:
* Fixed more notes from Solidified audit:
  * 14 - Using constructors without the constructor keyword is deprecated
  * 15 - Consider using latest version of solidity
  * 16 - Replace wrongly made asserts and add error strings to require statements
  * 24 - User correct ordering for modifiers and functions

Bug fixes:
* Fixed incorrect address usage in migrations file for library proxying

Efficiency improvements:
* Better calculation of storage address in proxying

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
