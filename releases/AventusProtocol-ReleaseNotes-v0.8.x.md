# Aventus Protocol 0.8.x Release Notes

This set of releases (see v0.7.x for the previous) is for further refactors of contracts and
interfaces.

The release notes for this version follow, listed by sub-release and category.

## Release 0.8.0 - 2018-08-21

Breaking change:
* Move protocol AVT ownership to storage contract - approvals must now be made to storage

New methods
* Voters can now cancel their vote

Internal only minor changes:
* Remove generic "delegate" term
* Minor changes for readability
* Proposal status now uses enum internally

Bug fix:
* Limit event challenges to events that are active
