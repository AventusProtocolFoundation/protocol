# Aventus Protocol 0.11.x Release Notes

This set of releases (see v0.10.x for the previous) further hardens the protocol for consistency and maintainability
and contains a full rewrite of our testing framework to improve speed, reliability and coverage.

The release notes for this version follow, listed by sub-release and category.

## Release 0.11.0 - 2018-11-23

Breaking changes:
* Storage transferAVTTo and transferAVTFrom no longer return values: will assert instead
* IAVTManager logs renamed for clarity
* All logs renamed to present perfect tense for consistency
* Removed sendTicketToFriend
* Removed event challenges
* returnTicket renamed to cancelTicket
* Removed evidenceUrl and desc from merkle root registration
* Removed merkle root deposits, challenges and deregistering
* Event deposits increased
* Register/Deregister of member now revert rather than fail silently

New functionality:
* All requires now have error strings
* LogEventCreated additionally logs eventOwner
* LogTicketResold additionally logs doorData
* Restored memberIsActive
* Support for member deregistration cool off periods (currently switched off)

Minor changes:
* All strings in Solidity code now use double quotes
* All strings in javascript code now use single quotes
* Consistent function keyword ordering: visibility, state, modifiers, return

Internal only major changes:
* All tests files replaced with new versions

Internal only minor changes:
* Moved some parameter checks into storage setters (be more OO)
* Renaming of some proofs and related methods for consistency
* All require statements to fit on a single line for easy grepping of errors
* Rename of library files for consistency
* Absorb MultiAccess contract into Storage
* We no longer store doorData
* Various minor TODOs and tidy up