cls
start cmd /k node node_modules\ethereumjs-testrpc-sc\build\cli.node.js  -p 8555 -l 17592186044415 -e 500000000000000000000000
copy nul "allFiredEvents"
node_modules\.bin\solidity-coverage