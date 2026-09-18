$taskName = "ComparadorSupermercados_ActualizacionSemanal"
$batPath = "c:\Users\Gonza\Desktop\APP supermercados\scripts\run-weekly-update.bat"

Write-Host "Configurando tarea programada semanal: $taskName..." -ForegroundColor Cyan

try {
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 4:00am
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force -ErrorAction Stop

    Write-Host "`n[EXITO] Tarea '$taskName' programada correctamente en el Programador de Tareas de Windows." -ForegroundColor Green
    Write-Host "Horario: Todos los Lunes a las 04:00 AM" -ForegroundColor Yellow
    Write-Host "Script: $batPath" -ForegroundColor Gray
} catch {
    Write-Host "`n[ERROR] No se pudo registrar la tarea: $_" -ForegroundColor Red
}
