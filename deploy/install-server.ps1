# One-time install of SysRent Shop on the server (safe to re-run).
#   powershell -ExecutionPolicy Bypass -File "D:\<project>\deploy\install-server.ps1"
# Needs .env.production.local in the project root. Asks for the root password.
$ErrorActionPreference = 'Stop'
$Server = 'root@187.77.141.138'
$EnvFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.production.local'
if (-not (Test-Path -LiteralPath $EnvFile)) { Write-Host "Missing $EnvFile"; exit 1 }

$tmp = Join-Path $env:TEMP ('shop-env-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Copy-Item -LiteralPath $EnvFile -Destination (Join-Path $tmp 'shop.env')
  Write-Host '>> Uploading settings'
  scp (Join-Path $tmp 'shop.env') "${Server}:/tmp/"
  if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }

  Write-Host '>> Installing (3-6 minutes)'
  $cmd = @(
    'set -e',
    '[ -d /home/app/shop/.git ] || sudo -iu app git clone -q -b main https://github.com/pawee2901/sysrent-pos.git /home/app/shop',
    'sudo -iu app git -C /home/app/shop pull -q --ff-only origin main',
    'install -o app -g app -m 600 /tmp/shop.env /home/app/shop/.env.local',
    'rm -f /tmp/shop.env',
    'bash /home/app/shop/deploy/setup-server.sh'
  ) -join ' && '
  ssh $Server $cmd
  if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
  Write-Host 'Done'
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
