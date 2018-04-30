﻿# Aventus Protocol 0.4.x Release Notes

This initial public release represents the foundation for everything that will come next; the building blocks to a new, more secure and easier to control way to supply and transact tickets. By developing an open standard that defines how tickets are managed and interacted with throughout the ticketing lifecycle, we can create a new paradigm and a new way to control bots, counterfeits and touting.

The Aventus Protocol provides a backbone of interoperability which will lower barriers to entry for developers in the ticketing industry. Developers can now access the Protocol via our API, giving them the tools to begin building (or expanding existing) ticketing applications and services to take advantage of the benefits of the blockchain. To this end, the full code is now available on GitHub for anyone to use.

The glossary and release notes for version 0.4.x follow, listed by sub-release and category, filtered by status.

### Glossary
* Event Owner - Ethereum address that is stored as the owner of the event. Has all event-related permissions.
* Delegates - Other addresses that the owner has given permissions to sell and refund tickets.
* Apps - Ethereum addresses that can send messages to the blockchain on behalf of an event owner or delegate via a signed message on the blockchain. Apps need an app deposit to access the network.

## Release 0.4.1 - 2018-04-24

Breaking changes

* Remove finaliseProposal from event challenges and governance proposals: all proposals now start immediately and use fixed time periods.

Bug Fixes:
* Use RefundedTicketCount in LEvents.sol: allows cancellation of an event when all tickets have been refunded.

Other
* Rename ProposalManager to ProposalsManager in migration files, for consistency
* Publish EventsManager ABI and address in storage, in preparation for upcoming API release

## Release 0.4.0 - 2018-04-17

### Token Holders

New

* Can now create event challenges
* Can now vote on event challenges
* Can now receive winnings from event challenges

### Event Challengers

New

*  AVT holders can now challenge a suspected fraudulent event as long as they have paid an AVT deposit equal to that of the event being challenged. Challengers receive a percentage of the 'winnings' if their challenge is successful, as well as the event being marked fraudulent.
* AVT holders can vote on event challenges and receives winnings. Their vote is weighted by the amount of AVT they have staked on the challenge. If the AVT holder has revealed their vote during the revealing period of a challenge and is on the winning side they will receive a share of the winnings.
* Challenge Enders (AVT Holders who interact with the vote outside of the voting period) can trigger the end of a challenge and receive a percentage of the winnings.
* If event challenger wins, the event is marked as fraudulent. The losing deposit is distributed amongst the winner, challenge ender and winning voters.

### Event Ownership

New

* Event owners can now create an event as long as they have first paid an AVT deposit
* Event owners can now sell and refund tickets
* Event owners can now cancel an event as long as no tickets have been sold and the event has not yet occurred. They cannot cancel if their event is under challenge.
* Third party delegates can now sell and refund tickets for an event
* Event owners can add and remove the rights of delegates for an event

### Governance

New

* Voting can now be held on protocol challenges, as long as the voter has an AVT stake. However, differing to the event challenges, there are no winnings to be distributed after the vote.
Improved
* Changes to the protocol can now be suggested as long as the proposer has paid an AVT deposit.
* Votes are now binary: I agree/I disagree statements

### App Registration

New

* All apps (including delegates) sending event transactions on behalf of others must be registered with Aventus. The user must also have first paid an AVT deposit.
