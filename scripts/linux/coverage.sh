#!/bin/bash
set -e

## NOTE: latest version of solidity-coverage does not yet support solidity 0.5 out of the box. Use this to force it:
## curl -o node_modules/solidity-parser-sc/build/parser.js https://raw.githubusercontent.com/maxsam4/solidity-parser/solidity-0.5/build/parser.js

## NOTE: Run this in the protocol top level directory.
node scripts/SwitchMode.js release

rm -rf build
truffle compile
touch allFiredEvents
env SKIP_REVERT_ERR=1 SOLIDITY_COVERAGE_USE_RPC=1 node_modules/.bin/solidity-coverage

node scripts/SwitchMode.js debug
