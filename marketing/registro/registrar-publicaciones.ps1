# Registra en el panel de Coach LoL IA todas las publicaciones de publicaciones.csv que tengan enlace.
# Uso: clic derecho > Ejecutar con PowerShell (o: powershell -ExecutionPolicy Bypass -File registrar-publicaciones.ps1)
$ErrorActionPreference = 'Stop'
$token = (Get-Content "$env:USERPROFILE\.coachlolia\panel_token.txt" -Raw).Trim()
$csvUrl = 'https://raw.githubusercontent.com/pepeipto/coach-lol-ia/claude/project-thread-cpijql/marketing/registro/publicaciones.csv'
$filas = (Invoke-WebRequest -UseBasicParsing $csvUrl).Content | ConvertFrom-Csv
$ok = 0; $fallos = 0
foreach ($f in $filas) {
  if (-not $f.enlace_o_id -or $f.enlace_o_id -notmatch '^https://') { continue }
  $cuerpo = @{ red = $f.red; url = $f.enlace_o_id; titulo = $f.titulo }
  if ($f.fecha_publicacion -match '^\d{4}-\d{2}-\d{2}$') { $cuerpo.publicado = $f.fecha_publicacion }
  try {
    Invoke-RestMethod -Method Post -Uri 'https://api.coachlolia.com/admin/panel/api/redes' `
      -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json))) | Out-Null
    Write-Host "OK    $($f.red)  $($f.titulo)"; $ok++
  } catch {
    Write-Host "FALLO $($f.red)  $($f.titulo): $($_.Exception.Message)" -ForegroundColor Red; $fallos++
    # 401/403: token incorrecto. Se para para no bloquear la IP (5 fallos en 15 min).
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -in 401,403) { Write-Host 'Token rechazado: paro.' -ForegroundColor Red; break }
  }
}
Write-Host "`nRegistradas: $ok  Fallos: $fallos"
if ($Host.Name -eq 'ConsoleHost') { Read-Host 'Pulsa Enter para cerrar' }
