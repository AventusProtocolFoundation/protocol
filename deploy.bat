@echo off
cls

SET TRUFFLE_NETWORK=development

echo ***  Check if geth node is RUNNING... ***
Tasklist /FI "IMAGENAME eq geth.exe" 2>NUL | find /I /N "geth.exe">NUL
if "%ERRORLEVEL%"=="0" goto start-deploy

echo ***  Check if Ganache UI is RUNNING... ***
Tasklist /FI "IMAGENAME eq Ganache.exe" 2>NUL | find /I /N "Ganache.exe">NUL
if "%ERRORLEVEL%"=="0" goto start-deploy

echo ***  Check if Ganache-Cli Process is RUNNING ***
Tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" goto start-deploy

echo ***  Start Ganache-Cli Process ***
cmd /c START /min "Ganache-Cli" ganachecli.bat
if %ERRORLEVEL% neq 0 goto end

:start-deploy

echo ***  Starting initial contract deployment... ***

if "%1" == "api" goto api-test

:: Truffle test does NOT compile into the build directory.
:: Our deployment needs IERC20.json so we have to compile it.
echo *** Compiling contracts... ***
call del /s/q build
call truffle.cmd compile
if %ERRORLEVEL% neq 0 goto end

echo *** Running tests using truffle network %TRUFFLE_NETWORK%... ***
call truffle.cmd test --network %TRUFFLE_NETWORK% %1

goto end

:api-test
:: Truffle migrate will create build files for us.
echo *** Running deploy to %TRUFFLE_NETWORK%... ***
call truffle.cmd migrate --network %TRUFFLE_NETWORK% --reset
echo *** Running API Documentation update ... ***
pushd api
call npm run doc
echo *** Running API test... ***
call npm run test
popd

:end
echo *** ...done. ***
