param(
  [string]$ConnectionString = "Host=localhost;Port=5432;Username=casino;Password=casino;Database=casino"
)

$ErrorActionPreference = 'Stop'

Write-Host "Running Postgres migrations..."

# Verify psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) { throw 'psql is not installed or not in PATH. Install PostgreSQL client tools.' }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationsDir = Join-Path $scriptDir '..\migrations\postgres'

Get-ChildItem -Path $migrationsDir -Filter '*.sql' | Sort-Object Name | ForEach-Object {
  $file = $_.FullName
  Write-Host "Applying: $($_.Name)"
  psql "$ConnectionString" -f "$file"
}

Write-Host "Postgres migrations complete."
