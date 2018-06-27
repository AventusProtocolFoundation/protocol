# Release of v0.5.4 to MainNet 2018-06-20

# Contracts deployed
## AventusStorage:0xb04b2943871d61f31e8412ed213716ea21154d38
Storage for all protocol data. Can only be written to by our contracts.
## AventusVote: 0x7e599c6401c5d7301f9dd8784d1eb3d6aea161b8
Entry point for all proposals transactions, ie creating governance proposals and event challenges, casting and revealing votes.
## AppsManager: 0x2615ad81da19feca52416c71f996719723ef7b96
Entry point for the list of registered 3rd party apps which can use the protocol.
## EventsManager: 0xd052d564cefa9e9c123b0866463c945eca001465
Entry point for all events transactions, ie creating and cancelling events, handling delegates, selling and refunding tickets.
## ParameterRegistry: 0xc43955eb5b2aea25c264cafdfe7d150a96f9047c
INTERNAL USE ONLY. Sets up initial values for protocol parameters.

# Libraries deployed
## LAventusTime: 0xc5ef70e8f06f0c055e1c0ad3913112854687fc58
Wrapper around Solidity ‘now’ method, used for testing purposes with LAventusTimeMock (not deployed on mainnet).
Proxied by PAventusTime (0x69092d6ceb428422a9a904bbec88aec9c72161ef)
## LLock: 0x772797c082724b02d1483f462003503c523e100a
Handles all movement of AVT for deposits and stakes.
Proxied by PLock (0x571eea4ae64d453d55ff4dfba2ecd39b79dbc09b)
## LApps: 0xf0f44f8a116359ad9653ac96740a852be2a32055
Keeps the list of registered 3rd party apps which can use the protocol.
Proxied by PApps: (0x658145bc5eecd0e5f9436a5e04257791bbba9590)
## LECRecovery: 0x2752c0e0520c5ecbb9c87fda14ef66caf4451acc
Our version of the Zeppelin ECDSA library for signing messages.
Proxied by PECRecovery (0x3e1cfde5986750f4cdecc8abde828d2bf0b0f1ff)
## Events
Event management is split into 3 libraries due to size constraints on Ethereum, with LEvents as the proxied entry point:
### LEvents: 0xf67b8487d15df5c97a463bd5e1941fc632134bcc
Entry point for all events transactions, ie creating and cancelling events, handling delegates, selling and refunding tickets.
Proxied by PEvents (0x0eca4f01ae5ce22ea01adf28e6beb7f5948d2cf8)
### LEventsEnact: 0x87e7d21a3fd6d3c1fd4b6d3032716c8bafa1526f
Methods for actually writing event data to the blockchain for events and sales transactions. Directly linked to LEvents ie NOT proxied.
### LEventsCommon:0x1362f4f53a8361c1cbcbfbaa6851491538325171
Common methods shared between LEvents and LEventsCommon: mostly for checking status, etc. Directly linked to LEvents ie NOT proxied.
## Proposals
Proposals management is split into 3 libraries due to size constraints on Ethereum, with LProposals as the proxied entry point.
### LProposal: 0xd84eca1aabf57b7caec2835838c2d557b17a8730
Entry point for all proposals transactions, ie creating governance proposals and event challenges, casting and revealing votes.
Proxied by PProposal (0x4e463d2ba3eeaeb44dd3b21576ecdc578743872d)
### LProposalVoting: 0x07f9cb20ce0957a482a253e2811479f68d424d73
Handles all logic for casting and revealing votes.
### LProposalWinnings: 0x88f579776a12cd05269b0c39d527a1f00c1845ec
Handles all logic for calculating and distributing voter winnings.

