<#
.SYNOPSIS
  Build and invoke the ScheduledDashboardCreation Lambda locally via SAM,
  capturing its returned HTML (via stdout) into .\out\report.html.

.NOTES
  Windows/PowerShell equivalent of run-report-locally.sh.

  One behavioral difference from the bash version: PowerShell can't easily
  tee a running process's stderr to both the console and a file at the same
  time, so here the function logs are captured to .\out\report.log and
  printed to the console once the invoke finishes, rather than streamed
  live line-by-line.

.EXAMPLE
  .\scripts\run-report-locally.ps1
#>

$ErrorActionPreference = 'Stop'

Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "==> Reauthenticating AWS session"
# aws login

Write-Host "==> Docker runtime"
# Docker Desktop on Windows normally doesn't need DOCKER_HOST set explicitly.
# Uncomment and adjust if your setup needs to target a specific engine
# (e.g. a WSL2 distro's Docker, or Rancher Desktop):
# $env:DOCKER_HOST = "npipe:////./pipe/docker_engine"

Write-Host "==> Building TypeScript"
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Building SAM package"
sam build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Force -Path .\out | Out-Null

Write-Host "==> Invoking ScheduledDashboardCreation locally (no memory limit, to avoid OOM kills)"

$responseFile = [System.IO.Path]::GetTempFileName()
$logFile = Join-Path (Get-Location) 'out\report.log'

$process = Start-Process -FilePath 'sam' `
  -ArgumentList 'local', 'invoke', 'ScheduledDashboardCreation', '--no-memory-limit' `
  -NoNewWindow -Wait -PassThru `
  -RedirectStandardOutput $responseFile `
  -RedirectStandardError $logFile

Get-Content $logFile | Write-Host

if ($process.ExitCode -ne 0) {
  Write-Host "sam local invoke failed with exit code $($process.ExitCode)"
  Remove-Item $responseFile -ErrorAction SilentlyContinue
  exit $process.ExitCode
}

Write-Host "==> Extracting report HTML from the invoke response"
node scripts/extract-report-response.mjs $responseFile .\out\report.html
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $responseFile -ErrorAction SilentlyContinue

Write-Host "==> Logs saved to .\out\report.log"
