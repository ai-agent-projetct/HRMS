# Creates/repairs the loomhr MySQL user via --init-file (no root password needed).
# Self-elevates, logs everything to db/reset-loomhr.log, then verifies the login.
$log = 'E:\Updated Projects\HRMS\db\reset-loomhr.log'
"=== run $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8

$id=[Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin=(New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  "not elevated -> relaunching via UAC" | Add-Content $log
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath
  exit
}
"elevated: OK" | Add-Content $log

$svc    = 'MySQL97'
$mysqld = 'C:\mysql\mysql-commercial-9.7.0-winx64\bin\mysqld.exe'
$mysql  = 'C:\mysql\mysql-commercial-9.7.0-winx64\bin\mysql.exe'
$ini    = 'C:\mysql\mysql-commercial-9.7.0-winx64\my.ini'
$init   = 'E:\Updated Projects\HRMS\db\setup.sql'

try {
  foreach ($p in @($mysqld,$mysql,$ini,$init)) { if (-not (Test-Path $p)) { throw "Missing: $p" } }
  "paths: OK" | Add-Content $log

  "stopping $svc" | Add-Content $log
  Stop-Service $svc -Force
  (Get-Service $svc).WaitForStatus('Stopped','00:00:30')
  "stopped" | Add-Content $log

  "booting temp mysqld with init-file" | Add-Content $log
  $proc = Start-Process $mysqld -ArgumentList "--defaults-file=`"$ini`"","--init-file=`"$init`"" -PassThru
  Start-Sleep -Seconds 12
  "killing temp mysqld pid $($proc.Id)" | Add-Content $log
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3

  "restarting $svc" | Add-Content $log
  Start-Service $svc
  (Get-Service $svc).WaitForStatus('Running','00:00:30')
  "running" | Add-Content $log

  "verifying loomhr login" | Add-Content $log
  $out = & $mysql --host=127.0.0.1 --port=3306 --user=loomhr --password='LoomHr#2026' --database=loomhr -e "SELECT 'LOGIN_OK' AS r;" 2>&1
  "verify output: $out" | Add-Content $log
} catch {
  "ERROR: $($_.Exception.Message)" | Add-Content $log
}
"=== done ===" | Add-Content $log
Get-Content $log | Write-Host
Read-Host "Press Enter to close"
