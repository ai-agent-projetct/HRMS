; LoomHR installer customization.
;
; Problem: LoomHR's Electron process forks a Node child process to run the
; Next.js server. If a previous version is still running when the new
; installer starts, electron-builder's built-in "uninstall old version" step
; (which runs later, during Install) can't delete the locked files. It
; retries 5 times, then gives up and shows a manual "close the app to
; continue" dialog — which looks like "can't install, previous version
; already installed" and needs the user to intervene by hand.
;
; Fix: kill any running instance (and its child processes, via /T) the
; moment the installer starts, in customInit — which electron-builder calls
; from .onInit, before any wizard page is shown and long before the old
; version's files are touched. By the time the built-in uninstall-old-
; version step runs, nothing has the files locked, so it succeeds silently
; and the whole upgrade happens with a single double-click, no prompts.
!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Sleep 500
!macroend
