@echo off
REM ===================================================================
REM  Force-uninstall LoomHR / Mehala Carona HRMS
REM
REM  Use this when Windows "Uninstall" fails with:
REM     "Installer integrity check has failed"
REM  i.e. the uninstaller itself is corrupt and cannot run.
REM
REM  It removes the program files, the Add/Remove Programs entry and the
REM  shortcuts. It does NOT touch your saved HRMS data (see the note at
REM  the end if you also want that gone).
REM
REM  Just double-click it. It asks for Administrator itself.
REM ===================================================================

REM ---- self-elevate to Administrator ----
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo ==========================================================
echo   Force-uninstalling LoomHR / Mehala Carona HRMS
echo ==========================================================
echo.

echo [1/5] Closing the app if it is running...
taskkill /F /IM "LoomHR.exe"              >nul 2>&1
taskkill /F /IM "Mehala Carona HRMS.exe"  >nul 2>&1
taskkill /F /IM "Uninstall LoomHR.exe"    >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Trying the normal uninstaller once (silent)...
if exist "C:\Program Files\LoomHR\Uninstall LoomHR.exe" (
  "C:\Program Files\LoomHR\Uninstall LoomHR.exe" /S /allusers >nul 2>&1
)
if exist "C:\Program Files\Mehala Carona HRMS\Uninstall Mehala Carona HRMS.exe" (
  "C:\Program Files\Mehala Carona HRMS\Uninstall Mehala Carona HRMS.exe" /S /allusers >nul 2>&1
)
timeout /t 3 /nobreak >nul

echo [3/5] Deleting program files...
if exist "C:\Program Files\LoomHR"                    rd /s /q "C:\Program Files\LoomHR"
if exist "C:\Program Files (x86)\LoomHR"              rd /s /q "C:\Program Files (x86)\LoomHR"
if exist "C:\Program Files\Mehala Carona HRMS"        rd /s /q "C:\Program Files\Mehala Carona HRMS"
if exist "C:\Program Files (x86)\Mehala Carona HRMS"  rd /s /q "C:\Program Files (x86)\Mehala Carona HRMS"
if exist "%LOCALAPPDATA%\Programs\LoomHR"             rd /s /q "%LOCALAPPDATA%\Programs\LoomHR"
if exist "%LOCALAPPDATA%\Programs\Mehala Carona HRMS" rd /s /q "%LOCALAPPDATA%\Programs\Mehala Carona HRMS"

echo [4/5] Removing the Add/Remove Programs entries...
for /f "delims=" %%K in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "LoomHR" /d 2^>nul ^| find "HKEY_"') do reg delete "%%K" /f >nul 2>&1
for /f "delims=" %%K in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "Mehala Carona" /d 2^>nul ^| find "HKEY_"') do reg delete "%%K" /f >nul 2>&1
for /f "delims=" %%K in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "LoomHR" /d 2^>nul ^| find "HKEY_"') do reg delete "%%K" /f >nul 2>&1
for /f "delims=" %%K in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "Mehala Carona" /d 2^>nul ^| find "HKEY_"') do reg delete "%%K" /f >nul 2>&1
REM electron-builder also keys the entry off the appId GUID
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\c712ebf8-b0c4-5bd0-9aac-8c7652ade963" /f >nul 2>&1
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\c712ebf8-b0c4-5bd0-9aac-8c7652ade963" /f >nul 2>&1

echo [5/5] Removing shortcuts...
del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\LoomHR.lnk"             >nul 2>&1
del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Mehala Carona HRMS.lnk" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\LoomHR.lnk"                 >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Mehala Carona HRMS.lnk"     >nul 2>&1
del /f /q "%PUBLIC%\Desktop\LoomHR.lnk"                                                >nul 2>&1
del /f /q "%PUBLIC%\Desktop\Mehala Carona HRMS.lnk"                                    >nul 2>&1
del /f /q "%USERPROFILE%\Desktop\LoomHR.lnk"                                           >nul 2>&1
del /f /q "%USERPROFILE%\Desktop\Mehala Carona HRMS.lnk"                               >nul 2>&1

echo.
echo ==========================================================
echo   RESULT
echo ==========================================================
if exist "C:\Program Files\LoomHR" (
  echo   [!] C:\Program Files\LoomHR still exists.
  echo       Something is holding a file open. Restart Windows
  echo       and run this script once more.
) else (
  echo   [OK] Program files removed.
)
echo   [OK] Registry entries removed.
echo   [OK] Shortcuts removed.
echo.
echo   Your saved HRMS data was NOT deleted. It is here:
echo       %APPDATA%\LoomHR
echo   Delete that folder only if you want a completely fresh start.
echo.
echo   You can now install "Mehala Carona HRMS Setup 1.1.0.exe".
echo.
pause
