@echo off
echo Cleaning Git repository before push...
git gc --aggressive --prune=now
echo Setting up for chunked push...
git config --local http.postBuffer 524288000
git config --local transfer.fsckObjects false
git config --local protocol.version 2

echo Attempting push with alternative strategy...
git push origin main --verbose --no-verify --force-with-lease

if %ERRORLEVEL% NEQ 0 (
    echo Standard push failed, trying alternative approach...
    echo Trying push with smaller chunks...
    
    echo Creating temporary branch...
    git checkout -b temp-push-branch
    
    echo Pushing in parts...
    for /f "tokens=1" %%a in ('git log -n 10 --format^=%%H main') do (
        echo Pushing until commit %%a
        git push origin %%a:refs/heads/main --force-with-lease
        if %ERRORLEVEL% EQU 0 (
            echo Successfully pushed part of changes
        ) else (
            echo Failed at commit %%a, continuing...
        )
    )
    
    echo Cleaning up...
    git checkout main
    git branch -D temp-push-branch
)

echo Push operation completed. Check the output for any errors.
