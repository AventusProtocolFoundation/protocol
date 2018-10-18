# Aventus Protocol 0.10.x Release Notes

This set of releases (see v0.9.x for the previous) is to support resale of merkle tree tickets and hardening of the protocol
for consistency and maintainability.

The release notes for this version follow, listed by sub-release and category.

## Release 0.10.0 - 2018-10-18

Breaking changes:
* Removed the majority of types from storage: they are, and never will be, necessary due to 32 byte packing.
* Return values for non-view and non-pure methods have all been removed: all values to be retrieved from logs instead.
* IEventsManager.unlockEventDeposit renamed to endEvent.
* IEventsManager.refundTicket renamed to returnTicket: now sets ticket owner to be the event owner.
* IEventsManger.de/registerRole renamed to de/registerMemberFromEvent
* All event method that can be called via a broker now require validity proof, regardless of whether via broker or not.
* All IEventsManager logs updated to reflect new data.
* Challenges are now ended using the manager contract that created them, NOT ProposalsManager.
* Various getters removed, eg memberIsActive: use logs instead.

New functionality:
* Added IEventsManager.listTicket and sendTicketToFriend for transfer of merkle tree tickets on the blockchain.
* Test timing profiling

Minor changes:
* ParameterRegistry can only be initialised ONCE.
* All method input parameters start with an underscore.
* All method output parameters end with an underscore.
* All external contract method comments moved to their respective interface files.
* NatSpec enforced on all interface public methods.
* Line limit of 128 characters
* Move old release notes into "release" directory.

Internal only major changes:
* Restructure of library->sublibrary calls, to check for state in correct place.
* Introduction of L<...>Storage sublibraries to better encapsulate usage of Storage contract.
* Aventity "active" state is now purely determined by presence of deposit.
* Check EventState in LEvents, other checks (eg sender and proof) in sublibraries.

Internal only minor changes:
* Signing of data automatically uses ethereum preamble.
* Various bits of clean up and renames for clarity.
