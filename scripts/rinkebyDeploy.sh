#!/bin/bash

echo "*** DOING DEPLOY"
../deploy.sh

export godkeeperAddress=0x1b185002395904310c2f116060cbaeccebba9b7f

# TODO: Consider not give godkeeper ownership of the membersManager, or the AVT, just make patient a Validator. The backend
# should be able to run without any special permissions.
echo "*** CHANGING OWNERSHIP OF MEMBERSMANAGER"
node ChangeContractOwnership.js membersManager $godkeeperAddress
echo "*** SENDING AVT"
node SendAVT.js $godkeeperAddress 10000000 avt
