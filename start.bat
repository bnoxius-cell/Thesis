@echo off
setlocal EnableExtensions

title StressCare Launcher

:: ===== ROOT PATH =====
set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%Thesis-main"

echo ==============================
echo   StressCare Launcher
echo ==============================
echo.

:: ===== CHECK NODE =====
where node >nul 2>&1 || (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: ===== CHECK NPM =====
where npm >nul 2>&1 || (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)

:: ===== CHECK PROJECT =====
if not exist "%APP_DIR%\package.json" (
    echo [ERROR] App folder not found:
    echo %APP_DIR%
    pause
    exit /b 1
)

cd /d "%APP_DIR%"

:: ===== INSTALL ROOT DEPENDENCIES =====
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install || goto :error
)

:: ===== INSTALL CLIENT =====
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install || goto :error
    cd ..
)

:: ===== INSTALL SERVER =====
if not exist "server\node_modules" (
    echo Installing server dependencies...
    cd server
    call npm install || goto :error
    cd ..
)

:: ===== START SYSTEM =====
echo.
echo Starting StressCare system...
echo.

cd /d "%APP_DIR%"
call npm run dev:open

exit /b 0

:error
echo.
echo [FAILED] Something went wrong during installation or startup.
pause
exit /b 1