# Aventus Protocol 0.13.x Release Notes

This set of releases (see v0.12.x for the previous) adds merkle root deposits and autochallenges and combines the stake and deposit funds.

The release notes for this version follow, listed by sub-release and category.

## Release 0.13.0 - 2019-02-27

Breaking changes:
- AVT holdings are no longer split into "stake" and "deposit" fund types but now comprise a single AVT fund
- The combining AVT funds change affects deposit, withdrawl and transfer methods which no longer require a fund parameter
- The createEvent method now requires an event time and an event owner
- Signed proofs have been removed from cancelTicket and resellTicket and their logs
- The registerMerkleRoot method now requires a tree depth and last event time, for use in autochallenges
- Validators can no longer be registered as roles on events separately to event creation
- The listTicket method and its log have been removed
- The AventusStorage access logs have been renamed
- LogRoleRegisteredOnEvent is now LogEventRoleRegistered
- A signed proof has been added to registerRoleOnEvent

New functionality:

- Validators are now registered on events automatically when a protocol-registered validator calls createEvent
- MerkleRoot autochallenges to cover inaccurate tree depths and last event times have been added along with their logs
- Merkle roots now require a deposit
- Merkle roots can now be deregistered
- Merkle root deposit, cooling period, and maximum tree depth and event time values have been added to the parameter registry

Minor changes:

Internal only major changes:
- The voting DLL functionality has been moved from LProposalsVoting into its own library and storage sublibrary
- All libraries now call their storage sublibraries directly
- Storage library key schemas no longer cross-reference other storage libraries
- LAVTManager and its terminology and logic have been reworked to handle the removal of stake and deposit fund types
- The recording of member interactions with the protocol has been removed

Internal only minor changes:
- Function scope, type, and return values are now laid out on separate lines
