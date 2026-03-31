@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: SpicyThemes - Spicetify Extension Installer
:: ============================================================================

title SpicyThemes Installer
cls
echo.
echo ============================================================================
echo                       SpicyThemes Installer
echo ============================================================================
echo.

:: Find PowerShell
set "PWSH="
for %%P in (pwsh.exe powershell.exe) do (
    where %%P >nul 2>&1 && (set "PWSH=%%P" & goto :found_ps)
)
echo [ERROR] PowerShell not found.
pause
exit /b 1

:found_ps
echo [INFO] Using: %PWSH%
echo.

:: ============================================================================
:: STEP 1: Check Spicetify Installation
:: ============================================================================
echo [STEP 1] Checking Spicetify installation...
where spicetify >nul 2>&1
if errorlevel 1 (
    echo [INFO] Spicetify not found. Installing...
    %PWSH% -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 -OutFile '%TEMP%\spicetify-install.ps1'; & '%TEMP%\spicetify-install.ps1'; Remove-Item '%TEMP%\spicetify-install.ps1' -ErrorAction SilentlyContinue"
    set "PATH=%PATH%;%USERPROFILE%\.spicetify;%APPDATA%\spicetify"
) else (
    echo [OK] Spicetify is installed.
)

:: ============================================================================
:: STEP 2: Copy Extension
:: ============================================================================
echo.
echo [STEP 2] Installing SpicyThemes extension...

set "EXT_DIR=%APPDATA%\spicetify\Extensions"
if not exist "%EXT_DIR%" (
    mkdir "%EXT_DIR%"
)

set "SCRIPT_DIR=%~dp0"
set "SRC_FILE=%SCRIPT_DIR%..\dist\spicy-themes.js"

if not exist "%SRC_FILE%" (
    echo [ERROR] Build file not found at: %SRC_FILE%
    echo [INFO] Please run 'npm run build' first.
    pause
    exit /b 1
)

copy /Y "%SRC_FILE%" "%EXT_DIR%\spicy-themes.js" >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy extension file.
    pause
    exit /b 1
)

echo [OK] Extension copied to: %EXT_DIR%\spicy-themes.js

:: ============================================================================
:: STEP 3: Apply
:: ============================================================================
echo.
echo [STEP 3] Applying changes...
spicetify apply
if errorlevel 1 (
    echo [WARN] spicetify apply failed. You may need to run it manually.
)

echo.
echo ============================================================================
echo                    Installation Complete!
echo ============================================================================
echo.
echo Restart Spotify to activate SpicyThemes.
echo.
pause
