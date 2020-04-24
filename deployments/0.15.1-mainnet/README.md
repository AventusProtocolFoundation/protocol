# Mainnet deployment of v0.15.1

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

