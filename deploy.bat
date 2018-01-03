@echo off
cls
echo *** Starting contract deployment ***
cd ..\deploy-contracts
call npm run vote
cd ..\voting
call del /s/q build
rem call truffle.cmd compile
rem call truffle.cmd deploy --reset
echo *** Running tests ***
truffle.cmd test