' Silent Background Launcher for Kafr Inja ERP Server
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get project root directory
scriptPath = WScript.ScriptFullName
scriptsDir = fso.GetParentFolderName(scriptPath)
rootDir = fso.GetParentFolderName(scriptsDir)

WshShell.CurrentDirectory = rootDir
WshShell.Run "node """ & rootDir & "\scripts\service-watchdog.js""", 0, False
