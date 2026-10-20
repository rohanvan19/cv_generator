Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
shell.Run "node.exe " & Chr(34) & folder & "\scripts\launch.mjs" & Chr(34), 0, False
