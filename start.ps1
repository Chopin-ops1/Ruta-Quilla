# ============================================
# RutaQuilla - Script de Inicio
# ============================================
# Uso: .\start.ps1
# Abre el servidor (puerto 5000) y el cliente
# Vite (puerto 5173) en ventanas separadas.
#
# Node.js v22.14.0 está instalado en:
#   C:\Users\USER\nodejs\node-v22.14.0-win-x64
# ============================================

$NODE_PATH = "C:\Users\USER\nodejs\node-v22.14.0-win-x64"

# Añadir Node al PATH de esta sesión si no está
if ($env:PATH -notlike "*$NODE_PATH*") {
    $env:PATH = "$NODE_PATH;" + $env:PATH
    Write-Host "✅ Node.js añadido al PATH de la sesión" -ForegroundColor Green
}

# Verificar que node y npm funcionan
$nodeVersion = & "$NODE_PATH\node.exe" --version 2>&1
$npmVersion  = & "$NODE_PATH\npm.cmd"  --version 2>&1
Write-Host "📦 Node.js: $nodeVersion  |  npm: $npmVersion" -ForegroundColor Cyan

# Directorio base del proyecto
$projectRoot = $PSScriptRoot

Write-Host ""
Write-Host "🚌 Iniciando RutaQuilla..." -ForegroundColor Yellow

# Arrancar el servidor Express en una nueva ventana PowerShell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$env:PATH = '$NODE_PATH;' + `$env:PATH;
  Set-Location '$projectRoot\server';
  Write-Host '🔵 Servidor Express iniciando en puerto 5000...' -ForegroundColor Cyan;
  node server.js
" -WindowStyle Normal

Start-Sleep -Seconds 2

# Arrancar el cliente Vite en otra ventana
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$env:PATH = '$NODE_PATH;' + `$env:PATH;
  Set-Location '$projectRoot\client';
  Write-Host '🟡 Vite iniciando en http://localhost:5173...' -ForegroundColor Yellow;
  npm run dev
" -WindowStyle Normal

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host "  ✅ RutaQuilla iniciando..." -ForegroundColor Green
Write-Host "  🌐 Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  🔧 Backend:   http://localhost:5000/api" -ForegroundColor White
Write-Host "  💊 Health:    http://localhost:5000/api/health" -ForegroundColor White
Write-Host "============================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Abriendo el navegador en 4 segundos..." -ForegroundColor Gray
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"
