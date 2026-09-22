@echo off
setlocal EnableDelayedExpansion

title SpicyThemes Installer
cls
echo.
echo ============================================================================
echo                       SpicyThemes Installer
echo ============================================================================
echo.

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

set "SPICETIFY_MIN=2.45.1"

echo [STEP 1] Checking Spicetify installation...
where spicetify >nul 2>&1
if errorlevel 1 goto :install_spicetify

call :read_spicetify_version
call :check_spicetify_version
if not errorlevel 1 (
    echo [OK] Spicetify !SPICETIFY_VER! is installed.
    goto :spicetify_ready
)

echo [INFO] Spicetify !SPICETIFY_VER! is older than %SPICETIFY_MIN%. Updating...
spicetify update
call :read_spicetify_version
call :check_spicetify_version
if errorlevel 1 (
    echo [WARN] Spicetify is still !SPICETIFY_VER!. SpicyThemes needs %SPICETIFY_MIN% or newer.
    echo [WARN] Run "spicetify update" manually, then re-run this installer.
    pause
    exit /b 1
)
echo [OK] Spicetify updated to !SPICETIFY_VER!.
goto :spicetify_ready

:install_spicetify
echo [INFO] Spicetify not found. Installing v%SPICETIFY_MIN%...
%PWSH% -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$v = '%SPICETIFY_MIN%'; iwr -useb 'https://raw.githubusercontent.com/spicetify/cli/v%SPICETIFY_MIN%/install.ps1' -OutFile '%TEMP%\spicetify-install.ps1'; & '%TEMP%\spicetify-install.ps1'; Remove-Item '%TEMP%\spicetify-install.ps1' -ErrorAction SilentlyContinue"
set "PATH=%PATH%;%LOCALAPPDATA%\spicetify;%USERPROFILE%\.spicetify;%APPDATA%\spicetify"
where spicetify >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Spicetify install did not complete. Restart this installer after installing Spicetify.
    pause
    exit /b 1
)

:spicetify_ready

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
exit /b 0

:read_spicetify_version
set "SPICETIFY_VER=unknown"
for /f "delims=" %%V in ('spicetify -v 2^>nul') do set "SPICETIFY_VER=%%V"
exit /b 0

:check_spicetify_version
%PWSH% -NoLogo -NoProfile -Command "try { if ([version](('!SPICETIFY_VER!'.TrimStart('v')) -replace '-.*$','') -ge [version]'%SPICETIFY_MIN%') { exit 0 } } catch {}; exit 1"
exit /b %errorlevel%
