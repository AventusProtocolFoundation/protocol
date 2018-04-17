@echo off
:: Only run this ONCE when you clone the repository for the first time.
:: (yes, this is horrible, we're going to fix it!)
call npm install

pushd api
call npm install
popd

set /p input="Would you like to run the test API to check your installation? (y/n): "
if "%input%"=="y" goto runtest

echo ***************************
goto end

:runtest
call deploy.bat api
if "%ERRORLEVEL%"=="0" goto success

echo "Sorry, something failed. Try deleting the repository and starting again."

goto end

:success

echo ***************************
echo *     YAY! It worked!     *

:end
echo * Initial set up complete *
echo ***************************
