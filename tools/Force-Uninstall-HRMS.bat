@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Force Uninstall - LoomHR / Mehala Carona HRMS

REM =====================================================================
REM  FORCE UNINSTALL  -  LoomHR / Mehala Carona HRMS
REM
REM  Use this when Windows "Uninstall" fails with:
REM       "Installer integrity check has failed"
REM  That means the uninstaller file itself is damaged, so Windows
REM  cannot remove the program the normal way - and the new setup
REM  cannot install over it either.
REM
REM  HOW TO USE
REM    1. Copy this file onto the affected computer (e.g. Desktop).
REM    2. Right-click it  ->  "Run as administrator".
REM       (If you just double-click it, it will ask for admin itself.)
REM    3. Wait until you see RESULT, then press a key.
REM    4. Install "Mehala Carona HRMS Setup 1.1.0.exe".
REM
REM  Works on Windows 7 SP1, 8, 8.1, 10 and 11 (32-bit and 64-bit).
REM  Your saved HRMS data is NOT deleted - see the note at the end.
REM =====================================================================


REM ---------------------------------------------------------------
REM  Step 0 - make sure we are running as Administrator.
REM  Uses a small VBScript shim instead of PowerShell, because a bare
REM  Windows 7 machine may not have PowerShell available.
REM ---------------------------------------------------------------
net session >nul 2>&1
if %errorlevel% EQU 0 goto :ELEVATED

echo.
echo  Administrator rights are required.
echo  Please click YES on the Windows prompt...
echo.
set "_VBS=%TEMP%\hrms_elevate.vbs"
> "%_VBS%" echo Set U = CreateObject("Shell.Application")
>>"%_VBS%" echo U.ShellExecute "%~f0", "", "", "runas", 1
cscript //nologo "%_VBS%" >nul 2>&1
if errorlevel 1 (
  echo  Could not elevate automatically.
  echo  Please RIGHT-CLICK this file and choose "Run as administrator".
  echo.
  pause
)
del "%_VBS%" >nul 2>&1
exit /b

:ELEVATED
cls
echo =====================================================================
echo    FORCE UNINSTALL - LoomHR / Mehala Carona HRMS
echo =====================================================================
echo.

REM ---------------------------------------------------------------
REM  Step 1 - close the application if it is running
REM ---------------------------------------------------------------
echo [1/6] Closing the application if it is running...
taskkill /F /IM "LoomHR.exe"                       >nul 2>&1
taskkill /F /IM "Mehala Carona HRMS.exe"           >nul 2>&1
taskkill /F /IM "Uninstall LoomHR.exe"             >nul 2>&1
taskkill /F /IM "Uninstall Mehala Carona HRMS.exe" >nul 2>&1
ping -n 3 127.0.0.1 >nul


REM ---------------------------------------------------------------
REM  Step 2 - give the real uninstaller one silent attempt
REM ---------------------------------------------------------------
echo [2/6] Trying the normal uninstaller once (silently)...
for %%D in (
  "C:\Program Files\LoomHR"
  "C:\Program Files (x86)\LoomHR"
  "C:\Program Files\Mehala Carona HRMS"
  "C:\Program Files (x86)\Mehala Carona HRMS"
  "%LOCALAPPDATA%\Programs\LoomHR"
  "%LOCALAPPDATA%\Programs\Mehala Carona HRMS"
) do (
  if exist "%%~D\Uninstall LoomHR.exe"             start "" /wait "%%~D\Uninstall LoomHR.exe" /S /allusers
  if exist "%%~D\Uninstall Mehala Carona HRMS.exe" start "" /wait "%%~D\Uninstall Mehala Carona HRMS.exe" /S /allusers
)
ping -n 3 127.0.0.1 >nul


REM ---------------------------------------------------------------
REM  Step 3 - delete the program folders
REM ---------------------------------------------------------------
echo [3/6] Deleting program folders...
for %%D in (
  "C:\Program Files\LoomHR"
  "C:\Program Files (x86)\LoomHR"
  "C:\Program Files\Mehala Carona HRMS"
  "C:\Program Files (x86)\Mehala Carona HRMS"
  "%LOCALAPPDATA%\Programs\LoomHR"
  "%LOCALAPPDATA%\Programs\Mehala Carona HRMS"
) do (
  if exist "%%~D" (
    echo        removing %%~D
    rd /s /q "%%~D" 2>nul
  )
)


REM ---------------------------------------------------------------
REM  Step 4 - remove the Add/Remove Programs entries
REM ---------------------------------------------------------------
echo [4/6] Removing Add/Remove Programs entries...
for %%R in (
  "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
  "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
  "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
) do (
  for %%N in ("LoomHR" "Mehala Carona") do (
    for /f "delims=" %%K in ('reg query %%R /s /f %%N /d 2^>nul ^| find "HKEY_"') do (
      reg delete "%%K" /f >nul 2>&1
    )
  )
)
REM electron-builder also writes a key named after the appId GUID
for %%R in (
  "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
  "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
  "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
) do (
  reg delete "%%~R\c712ebf8-b0c4-5bd0-9aac-8c7652ade963" /f >nul 2>&1
)


REM ---------------------------------------------------------------
REM  Step 5 - remove shortcuts
REM ---------------------------------------------------------------
echo [5/6] Removing shortcuts...
for %%N in ("LoomHR" "Mehala Carona HRMS") do (
  del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\%%~N.lnk" >nul 2>&1
  del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\%%~N.lnk"     >nul 2>&1
  del /f /q "%PUBLIC%\Desktop\%%~N.lnk"                                    >nul 2>&1
  del /f /q "%USERPROFILE%\Desktop\%%~N.lnk"                               >nul 2>&1
  rd /s /q  "%ProgramData%\Microsoft\Windows\Start Menu\Programs\%%~N"     >nul 2>&1
  rd /s /q  "%APPDATA%\Microsoft\Windows\Start Menu\Programs\%%~N"         >nul 2>&1
)


REM ---------------------------------------------------------------
REM  Step 6 - report
REM ---------------------------------------------------------------
echo [6/6] Checking...
set "LEFTOVER="
for %%D in (
  "C:\Program Files\LoomHR"
  "C:\Program Files (x86)\LoomHR"
  "C:\Program Files\Mehala Carona HRMS"
  "C:\Program Files (x86)\Mehala Carona HRMS"
  "%LOCALAPPDATA%\Programs\LoomHR"
  "%LOCALAPPDATA%\Programs\Mehala Carona HRMS"
) do (
  if exist "%%~D" set "LEFTOVER=%%~D"
)

echo.
echo =====================================================================
echo    RESULT
echo =====================================================================
if defined LEFTOVER (
  echo    [!] A folder could not be deleted:
  echo        !LEFTOVER!
  echo.
  echo        A file in it is still open. Please RESTART Windows and
  echo        run this script one more time. That almost always fixes it.
) else (
  echo    [OK] Program files removed.
  echo    [OK] Add/Remove Programs entries removed.
  echo    [OK] Shortcuts removed.
  echo.
  echo    You can now install:  Mehala Carona HRMS Setup 1.1.0.exe
)
echo.
echo    Your saved HRMS data was NOT deleted. It is stored in:
echo        %APPDATA%\LoomHR
echo    Delete that folder ONLY if you want to start completely fresh.
echo =====================================================================
echo.
pause
endlocal
