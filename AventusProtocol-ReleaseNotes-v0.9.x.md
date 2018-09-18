# Aventus Protocol 0.9.x Release Notes

This set of releases (see v0.8.x for the previous) is for adding support for tickets from sellers that are not fully integrated.

The release notes for this version follow, listed by sub-release and category.

## Release 0.9.0 - 2018-09-18

Breaking changes:
* Aventities are now purely internal
* Members are now added, removed and challenged using a new MembersManager
* Events are now challenged using challengeEvent in EventsManager
* Existing event deposit is now via getExistingEventDeposit in EventsManager
* Single methods for all event creation/cancel rather than separate versions when using a broker
* Single methods for all ticket sale/refund/resell rather than separate versions when using a broker
* Capacity and ticket sale time removed from event deposit calculation; method renamed to getNewEventDeposit
* Logging of all event and ticket methods updated
* Ticket sale now requires a unique vendor reference as well as a description
* Contract deploying address no longer has special member privileges

New functionality
* Merkle Tree Roots can be added, removed and challenged via MerkleRootsManager
* Support for ticket sales when primary sellers are not fully integrated
* Support for ticket sales when door access is not fully integrated
* Can end a proposal when all votes have revealed but before revealing end timestamp
* Support for Scaling Providers and Token Bonding Curves as members

Internal only major changes:
* LAventities now initiates all challenges and winnings
* LEventsTickets now handles all ticket code (split out due to binary size limits)

Internal only minor changes:
* Some updates for consistency of line length, variable naming, NATSPEC documentation, etc
* TotalAVTFunds no longer tracked - protocol balance can be read from ERC20 contract
* Use web3Utls.soliditySha3 throughout all test code instead of web3.sha3
* Some general testing clean up including better sharing of code via helpers
