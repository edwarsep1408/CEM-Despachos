' CEM-Despachos — agente báscula sin ventana CMD.
' Doble clic o Tarea programada al iniciar sesión.

Dim fso, shell, agenteDir, nodeExe

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Carpeta agente-bascula (un nivel arriba de windows/)
agenteDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = agenteDir

' 0 = ventana oculta (sin CMD)
shell.Run "node.exe src\index.js", 0, False
