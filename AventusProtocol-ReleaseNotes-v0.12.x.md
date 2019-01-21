# Aventus Protocol 0.12.x Release Notes

This set of releases (see v0.11.x for the previous) ???.

The release notes for this version follow, listed by sub-release and category.

## Release 0.12.0 - 2019-01-21

Breaking changes:
Upgrade to solidity 0.5
Events no longer require deposits
Combine Broker and Scaling Provider into new member type and event role: Validator
Updates to createEvent
Remove vendorProof and door data from sellTicket - can no longer sell via Broker/Validator or sell "blank tickets" (must sell via merkle trees for these)
Primary and Secondary event roles no longer need to be registered on the protocol
Roles can no longer be deregistered from events
Events can no longer be cancelled or ended
All deposits now specified in AVT not US cents

New functionality:

Minor changes:

Internal only major changes:
Renames of files for consistency and Event roles

Internal only minor changes:
