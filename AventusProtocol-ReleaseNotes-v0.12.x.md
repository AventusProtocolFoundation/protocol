# Aventus Protocol 0.12.x Release Notes

This set of releases (see v0.11.x for the previous) ???.

The release notes for this version follow, listed by sub-release and category.

## Release 0.12.0 - 2019-01-21

Breaking changes:
- Upgrade to solidity v0.5.2 and truffle v5
- Events no longer require deposits
- Combine Broker and Scaling Provider into new member type and event role: Validator
- Updates to createEvent
- Remove vendorProof and door data from sellTicket - can no longer sell via Broker/Validator or sell "blank tickets" (must sell via merkle trees for these)
- Primary and Secondary event roles are no longer registered as members on the protocol
- Roles can no longer be deregistered from events
- Events can no longer be cancelled or ended
- All deposits now specified in AVT not US cents

New functionality:
- Duplicate events can be created
- Remainder of challenge winnings goes to last claimant
- Validator cooling off period: can not deregister Validator until 90 days after their last interaction with the protocol

Minor changes:
- eventTime parameter added to createEvent internals for future support
- Debug only mode for better coverage

Internal only major changes:
- Events are no longer Aventities
- Renames of files for consistency and Event roles
- Use of schemas for internal storage "database"

Internal only minor changes:
- Remove all ternary operators - they are not support by solcover
Upgrade tests to web3 1.0 for compatibility with truffle 5.0
Split members and roles within tests
All javascript method parameters now begin with an underscore
Reformat test contexts for consistency and readability
