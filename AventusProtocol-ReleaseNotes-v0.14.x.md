# Aventus Protocol 0.14.x Release Notes

This set of releases (see v0.13.x for the previous) catches up on improvements since the split with Aventus Classic.

The release notes for this version follow, listed by sub-release and category.

## Release 0.14.0 - 2019-09-13

Breaking changes:
- Rename of Members to Validators
- Add automatic transaction submission to Governance Proposals
- Change old-style advisory Governance Proposals into new Community Proposals
- Removed offSaleTime from events
- Merkle root lastEventTime is now rootExpiryTime
- Merkle roots can only be challenged within a time window
- Event ids are now predictable from new parameter eventRef
- AVT is no longer locked when revealing votes: see getHistoricBalance in AVTManager
- castVote no longer requires prevTime parameters due to AVT no longer being locked
- Removal of direct-to-protocol ticket management: see Aventus classic

New functionality:
- Added MerkleLeaf challenges
- Web3Provider support for deployment
- Events now have optional rules which are applied to tickets
- New getHistoricBalance method on AVTManager
- Code coverage now ignores unreachable assert statements
- Build-time manual switch to turn off challenges and proposals
- AVT contract for testing is new, not using old ABI code

Minor changes:
- None

Internal only major changes:
- Removal of Aventities: only Validators are now challengeable by vote
- Initialising ParameterRegistry twice now reverts
- Moved some functionality from tests into a common utils directory

Internal only minor changes:
- Various reformatting regarding spacing, use of brackets, etc
- Standardisation of naming in schemas in AventusStorage
