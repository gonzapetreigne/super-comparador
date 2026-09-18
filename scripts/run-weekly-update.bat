@echo off
setlocal enabledelayedexpansion

:: Moverse al directorio del proyecto
cd /d "c:\Users\Gonza\Desktop\APP supermercados"

:: Crear directorio de logs si no existe
if not exist "logs" mkdir logs

:: Timestamp para el log
echo ==================================================== >> logs\weekly-update.log
echo [INICIO DE EJECUCION] %DATE% %TIME% >> logs\weekly-update.log
echo ==================================================== >> logs\weekly-update.log

:: Ejecutar el pipeline de actualización con Node.js
node scripts/update-all.js >> logs\weekly-update.log 2>&1

echo [FIN DE EJECUCION] Codigo de salida: %ERRORLEVEL% >> logs\weekly-update.log
echo. >> logs\weekly-update.log
exit /b %ERRORLEVEL%
