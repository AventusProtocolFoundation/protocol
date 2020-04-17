# Aventus Protocol 0.15.x Release Notes

This set of releases (see v0.14.x for the previous) simplifies Merkle root registration, adds the FTSM and involves minor changes for audit.

The release notes for this version follow, listed by sub-release and category.

## Release 0.15.0 - 2019-10-22

Breaking changes:
- Root challenges have been removed
- Removal of eventTime from createEvent
- Removal of Validator from createEvent proof: any registered validator can operate on an event now, not just the creator
- Removal of treeDepth and rootExpiryTime from Merkle roots: deposit is now fixed to 200AVT as a result
- deregisterMerkleRoot renamed to unlockMerkleRootDeposit
- Merkle root deposit can be unlocked 24 hours after registration: time no longer varies due to parameters
- Validator deregistration can now be done 48 hours after the latest Merkle root is registered, if no challenge penalties
- Merkle leaves can now be challenged at any time: deposit paid to challenger only for first successful challenge
- Can no longer reregister a Merkle root if it has lost a challenge

New functionality:
- Merkle leaf tickets now use Sigma protocol instead of SNARKS
- Upgraded to use Truffle v5.0.41, Solidity 0.5.12, Solidity-coverage 0.7.0-beta.2
- Support for switching off proposals and challenges at deploy time

Bug fixes:
- Validator deregistration time penalties now increase correctly with each subsequent leaf challenge: see getCoolingOffPeriod

Internal only major changes:
- Root owner is no longer cleared when root deposit is unlocked: owner remains forever, as does the root

Internal only minor changes:
- Optional ERC20 elements added to test ERC20 contract
- Single migration 11_setup file for all networks
- Improvement to migration script to better support partial deployment
- Started consolidation of usage of web3 into a common web3Tools util
- Various refactors of test code for sharing via utils with future web3 code
- Standardisation of attoAVT as smallest unit of AVT: 1*10^-18
- Fixed more inconsistencies with parameter names starting with underscore
- Ordering of external, public, private methods

## Release 0.15.0 - 2020-04-XX

Breaking changes:
- None.

New functionality:
- Fungible Token Scaling Manager: FTScalingManager.

Internal only:
- Renames of internal libraries to be more generic: Aventus -> Protocol.
- Locked Solidity version to 0.5.2 rather than a range.
- Add optional ERC20 method support in interface, eg name().
- Tidy up.
- Better logs testing.
- Rename of storage extension testing.
- Remove dead scripts.
- Minor update from zeppelin LECRecovery
