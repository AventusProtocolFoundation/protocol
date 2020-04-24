# Mainnet deployment of v0.15.1

## CONTRACTS

 - storageContract (unchanged): 0xd6589f7CB6AE49f77ee9F666fF8AB84a91c07133
 - eventsManager: 0x8063FC2eA64d73916FB82e3CEbfB080Db0415e66
 - validatorsManager: 0xd2d24Ba45Fb794B42b0dA5ff634888454Fdcccfc
 - merkleRootsManager: 0x58F759CF9e69Fa7302c6Ed6882A02307Ec1Ad766
 - ftScalingManager: 0xBF6bd45dE7Ed9DafA8033b5fF8eb4C67bf6799D2

## 2020-04-23

- Ran ```scripts/SwitchProposalsMode off```
- Set gas price to 9Gwei
- Deployments:
  1. gas price 9GWei: failed part way through due to average network gas price changing, transactions taking too long, and truffle migrate timing out
  2. gas price 10GWei: got further, but also failed
  3. gas price 12GWei: failed at dry-run due to insufficient funds (no log)
- Transferred 2ETH in but fast gas price was now well over 20GWei so postponed rest of deployment.

## 2020-04-24

Deployment with gas price 10GWei succeeded.



