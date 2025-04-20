@echo off
echo =============================================
echo Git Connectivity Test - %date% %time%
echo =============================================

REM Show current git config
echo Checking your Git configuration...
git config --get remote.origin.url
git config --get user.name
git config --get user.email

echo.
echo Creating a test file with current timestamp...
echo # Git Connection Test > test-connection.md
echo This is a small file created to test GitHub connectivity. >> test-connection.md
echo Test date: %date% %time% >> test-connection.md
echo Last successful test: %date% %time% >> test-connection.md

echo.
echo Adding only the test file to staging...
git add test-connection.md

echo.
echo Committing test file...
git commit -m "Test commit to verify connectivity"

echo.
echo Testing connection speed to GitHub...
ping github.com -n 4

echo.
echo Pushing only this small commit to verify connection...
git push origin HEAD:main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Connection to GitHub is working properly.
    echo Last successful connection: %date% %time%
    
    REM Create or update a log file of successful connections
    echo %date% %time% - Successful GitHub connection >> git-connection-log.txt
) else (
    echo.
    echo [ERROR] Push failed with error code %ERRORLEVEL%.
    echo You may want to check your network connection or GitHub credentials.
    
    REM Log the failure
    echo %date% %time% - Failed connection, error code: %ERRORLEVEL% >> git-connection-errors.txt
)

echo.
echo Test complete.
echo =============================================
pause
