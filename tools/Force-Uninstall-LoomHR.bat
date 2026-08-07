@echo off
REM ============================================================
REM  Force-Uninstall-LoomHR.bat
REM  Removes LoomHR when the normal uninstaller fails.
REM  HOW TO USE: right-click this file  ->  "Run as administrator"
REM  (or just double-click; it will ask for admin and self-elevate)
REM ============================================================

REM --- self-elevate to Administrator ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo(
echo Removing LoomHR ...
echo(

REM --- 1. stop the app and its background processes ---
taskkill /F /IM "LoomHR.exe" /T >nul 2>&1
timeout /t 1 /nobreak >nul

REM --- 2. try the app's own uninstaller silently, if present ---
for %%D in ("%ProgramFiles%\LoomHR" "%ProgramFiles(x86)%\LoomHR" "%LOCALAPPDATA%\Programs\LoomHR") do (
  if exist "%%~D\Uninstall LoomHR.exe" ( "%%~D\Uninstall LoomHR.exe" /allusers /S >nul 2>&1 )
)
timeout /t 2 /nobreak >nul
taskkill /F /IM "LoomHR.exe" /T >nul 2>&1

REM --- 3. force-delete the install folders ---
rd /s /q "%ProgramFiles%\LoomHR" 2>nul
rd /s /q "%ProgramFiles(x86)%\LoomHR" 2>nul
rd /s /q "%LOCALAPPDATA%\Programs\LoomHR" 2>nul

REM --- 4. remove the "Programs & Features" registry entries (any LoomHR) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -EA SilentlyContinue | ForEach-Object { $p = Get-ItemProperty $_.PSPath -EA SilentlyContinue; if ($p.DisplayName -like '*LoomHR*') { Remove-Item $_.PSPath -Recurse -Force -EA SilentlyContinue } }"

REM --- 5. remove shortcuts ---
del /f /q "%PUBLIC%\Desktop\LoomHR.lnk" 2>nul
del /f /q "%USERPROFILE%\Desktop\LoomHR.lnk" 2>nul
del /f /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\LoomHR.lnk" 2>nul
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\LoomHR.lnk" 2>nul

echo(
echo ============================================================
echo  LoomHR has been removed. You can now install the new .exe.
echo  (To also wipe local app data: delete  %%APPDATA%%\LoomHR )
echo ============================================================
echo(
pause
