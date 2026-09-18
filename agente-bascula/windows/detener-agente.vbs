' Detiene procesos node que ejecutan src\index.js del agente báscula.

Dim wmi, proc, cmd, n

n = 0
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
For Each proc In wmi.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe'")
  cmd = LCase(proc.CommandLine & "")
  If InStr(cmd, "src\index.js") > 0 Then
    proc.Terminate()
    n = n + 1
  End If
Next

If n = 0 Then
  MsgBox "No había agente báscula en ejecución.", vbInformation, "CEM agente báscula"
Else
  MsgBox "Agente detenido (" & n & " proceso(s)).", vbInformation, "CEM agente báscula"
End If
