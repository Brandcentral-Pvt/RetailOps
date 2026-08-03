#Requires -Version 5.1
# Loads backend/.env (Node-style keys) into .NET-style env vars and runs the .NET API.
[CmdletBinding()]
param(
    [string]$ProjectDir = "dotnet\RetailOps.Api",
    [string]$LaunchProfile = "http",
    [string]$EnvFile = "backend\.env"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $EnvFile

if (-not (Test-Path $envPath)) {
    throw "Missing env file: $envPath"
}

# Parse backend/.env (KEY=VALUE, ignore comments/blank lines)
$values = @{}
Get-Content $envPath | Where-Object {
    $_ -match '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=' -and $_ -notmatch '^\s*#'
} | ForEach-Object {
    $idx = $_.IndexOf('=')
    $key = $_.Substring(0, $idx).Trim()
    $value = $_.Substring($idx + 1).Trim()
    $values[$key] = $value
}

function Set-IfPresent([string]$src, [string]$dst) {
    if ($values.ContainsKey($src)) {
        [Environment]::SetEnvironmentVariable($dst, $values[$src])
        Write-Host "  $dst <- $src"
    }
}

Write-Host "Loading environment from $envPath"
# DB connection (read directly by ConnectionStringResolver)
Set-IfPresent 'DB_SERVER'   'DB_SERVER'
Set-IfPresent 'DB_NAME'     'DB_NAME'
Set-IfPresent 'DB_USER'     'DB_USER'
Set-IfPresent 'DB_PASSWORD' 'DB_PASSWORD'
Set-IfPresent 'DB_PORT'     'DB_PORT'
Set-IfPresent 'DB_ENCRYPT'  'DB_ENCRYPT'

# JWT (mapped to .NET Jwt__ sections)
Set-IfPresent 'JWT_SECRET'          'Jwt__AccessSecret'
Set-IfPresent 'JWT_REFRESH_SECRET'  'Jwt__RefreshSecret'

# SMTP (mapped to Smtp__ sections)
Set-IfPresent 'SMTP_HOST'     'Smtp__Host'
Set-IfPresent 'SMTP_PORT'     'Smtp__Port'
Set-IfPresent 'SMTP_SECURE'   'Smtp__Secure'
Set-IfPresent 'SMTP_USER'     'Smtp__User'
Set-IfPresent 'SMTP_PASSWORD' 'Smtp__Password'
Set-IfPresent 'SMTP_FROM'     'Smtp__From'

# Dashboard URL (CORS + password-reset link)
if ($values.ContainsKey('FRONTEND_URL')) {
    [Environment]::SetEnvironmentVariable('RetailOps__DashboardUrl', $values['FRONTEND_URL'])
}

if (-not $env:Jwt__AccessSecret)  { throw "Jwt__AccessSecret is empty — set JWT_SECRET in $envPath" }
if (-not $env:Jwt__RefreshSecret) { throw "Jwt__RefreshSecret is empty — set JWT_REFRESH_SECRET in $envPath" }

$proj = Join-Path $repoRoot $ProjectDir
Write-Host "Starting API: dotnet run --project $proj --launch-profile $LaunchProfile"
& dotnet run --project $proj --launch-profile $LaunchProfile
