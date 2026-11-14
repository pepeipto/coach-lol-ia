# Prepara la clave de ElevenLabs para «Generar voz ElevenLabs.bat».
# Si ya hay una guardada en %USERPROFILE%\.coachlolia\elevenlabs.env la usa; si no, la pide oculta y la guarda ahí
# (fuera del repo). Escribe la ruta del archivo en %TEMP%\ruta-env-voz.txt para que el .bat se la pase al generador.
# La clave nunca se muestra.
$salida = Join-Path $env:TEMP 'ruta-env-voz.txt'
Remove-Item $salida -ErrorAction SilentlyContinue
$dir = Join-Path $env:USERPROFILE '.coachlolia'
$archivo = Join-Path $dir 'elevenlabs.env'
function Clave-Valida($ruta) {
  if (-not (Test-Path $ruta)) { return $false }
  $l = Get-Content $ruta | Where-Object { $_ -match '^\s*ELEVENLABS_API_KEY\s*=' } | Select-Object -First 1
  if (-not $l) { return $false }
  $v = ($l -split '=', 2)[1].Trim().Trim('"').Trim("'")
  return $v.Length -ge 20
}
if (-not (Clave-Valida $archivo)) {
  foreach ($c in @('E:\jarvis\.env', (Join-Path $env:USERPROFILE 'jarvis\.env'))) {
    if (Clave-Valida $c) { Set-Content -Path $salida -Value $c -Encoding ASCII; exit 0 }
  }
  Write-Host 'Pega tu clave de ElevenLabs (no se ve al pegar) y pulsa Intro:' -ForegroundColor Yellow
  $seguro = Read-Host -AsSecureString
  $clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()
  if ($clave.Length -lt 20) { Write-Host 'La clave es demasiado corta; copia la entera desde elevenlabs.io.' -ForegroundColor Red; exit 1 }
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Set-Content -Path $archivo -Value "ELEVENLABS_API_KEY=$clave" -Encoding ASCII
}
Set-Content -Path $salida -Value $archivo -Encoding ASCII
