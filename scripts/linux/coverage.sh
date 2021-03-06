#!/bin/bash
set -e

## NOTE: latest version of solidity-coverage does not yet support solidity 0.5 out of the box. Use this to force it:
## curl -o node_modules/solidity-parser-sc/build/parser.js https://raw.githubusercontent.com/maxsam4/solidity-parser/solidity-0.5/build/parser.js

## NOTE: Run this in the protocol top level directory.
if [ "$1" == "SKIP_ASSERTS" ]; then
  node scripts/SwitchMode.js skip_asserts
fi

rm -rf build
truffle compile
touch allFiredEvents
truffle run coverage --network development

if [ "$1" == "SKIP_ASSERTS" ]; then
  node scripts/SwitchMode.js release
fi
