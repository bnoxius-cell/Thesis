@echo off
setlocal
title StressCare Launcher

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%Thesis-main"

cd /d "%ROOT_DIR%"

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed or not added to PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo npm is not installed or not added to PATH.
    pause
    exit /b 1
)

if not exist "%APP_DIR%\package.json" (
    echo App folder not found: %APP_DIR%
    pause
    exit /b 1
)

call :install_if_needed "%APP_DIR%" "app"
if errorlevel 1 exit /b 1

call :install_if_needed "%APP_DIR%\client" "client"
if errorlevel 1 exit /b 1

call :install_if_needed "%APP_DIR%\server" "server"
if errorlevel 1 exit /b 1

echo Starting StressCare...
cd /d "%ROOT_DIR%"
call npm.cmd run dev:open
exit /b %errorlevel%

:install_if_needed
set "TARGET_DIR=%~1"
set "LABEL=%~2"

if exist "%TARGET_DIR%\node_modules" exit /b 0

echo Installing %LABEL% dependencies...
cd /d "%TARGET_DIR%"
call npm.cmd install
if errorlevel 1 (
    echo Failed to install %LABEL% dependencies.
    pause
    exit /b 1
)

exit /b 0
