# Aventus Protocol 0.7.x Release Notes

This release (see v0.6.x for the previous) is a minor refactor of contracts and interfaces.

The release notes for version 0.6.x follow, listed by sub-release and category.

## Release 0.7.0 - 2018-07-10

Breaking changes:
* AventusVote split into AVTManager and ProposalsManager
* Versioning added for contracts and libraries

Minor changes:
* All events moved out of contracts, into interfaces and emitted from libraries, leaving contracts as empty shells
* Tidy up of thenables in migration scripts
* Tidy up of usage of "AVT" and "lock" terms

Bug fixes:
* Pass eventIsSigned parameter through in eventsTestHelper.makeEventDepositAndCreateValidEvent()