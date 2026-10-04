# Install create-erxes-plugin as a standalone binary (no Node.js required).
#
#   irm https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.ps1 | iex
#
# With parameters (PowerShell 5.1+):
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/erxes/create-erxes-plugin/main/install.ps1))) -Version 0.2.0 -InstallDir "$env:USERPROFILE\bin"
param(
  [string]$Version,
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"
# Invoke-WebRequest is very slow on Windows PowerShell 5.1 while rendering progress.
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "erxes/create-erxes-plugin"
$Bin = "create-erxes-plugin"
$Exe = "$Bin.exe"

if (-not $Version) { $Version = $env:CREATE_ERXES_PLUGIN_VERSION }
if (-not $InstallDir) { $InstallDir = $env:CREATE_ERXES_PLUGIN_INSTALL_DIR }
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\create-erxes-plugin"
}
$BaseUrl = $env:CREATE_ERXES_PLUGIN_BASE_URL
if (-not $BaseUrl) { $BaseUrl = "https://github.com/$Repo/releases" }

switch ($env:PROCESSOR_ARCHITECTURE) {
  "AMD64" { }
  "ARM64" { Write-Host "Note: running the x64 build under ARM64 emulation." }
  default {
    Write-Error "Unsupported architecture $($env:PROCESSOR_ARCHITECTURE) - only x64 Windows builds are published. Use npx $Bin instead."
  }
}

$Target = "windows-x64"
$Asset = "$Bin-$Target.zip"

$Version = $Version -replace '^v', ''
if ($Version) {
  $Release = "$BaseUrl/download/v$Version"
} else {
  $Release = "$BaseUrl/latest/download"
}

$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("$Bin-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

try {
  Write-Host "Downloading $Asset ($Target)..."
  $ZipPath = Join-Path $Tmp $Asset
  Invoke-WebRequest -Uri "$Release/$Asset" -OutFile $ZipPath

  try {
    $SumsPath = Join-Path $Tmp "SHA256SUMS"
    Invoke-WebRequest -Uri "$Release/SHA256SUMS" -OutFile $SumsPath
    $Expected = $null
    foreach ($line in Get-Content $SumsPath) {
      $parts = $line -split '\s+'
      if ($parts[-1] -eq $Asset) { $Expected = $parts[0]; break }
    }
    if (-not $Expected) { throw "SHA256SUMS has no entry for $Asset" }
    $Actual = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLower()
    if ($Actual -ne $Expected.ToLower()) { throw "Checksum mismatch for $Asset" }
    Write-Host "Checksum verified."
  } catch {
    Write-Error "Checksum verification failed: $_"
  }

  Expand-Archive -Path $ZipPath -DestinationPath $Tmp -Force
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item -Force (Join-Path $Tmp $Exe) (Join-Path $InstallDir $Exe)

  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $Entries = @()
  if ($UserPath) { $Entries = $UserPath -split ';' | Where-Object { $_ -ne '' } }
  if ($Entries -notcontains $InstallDir) {
    $NewPath = (($Entries + $InstallDir) -join ';')
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "Added $InstallDir to your user PATH (new terminals)."
  }
  if (($env:Path -split ';') -notcontains $InstallDir) {
    $env:Path = "$InstallDir;$env:Path"
  }

  Write-Host "Installed $(Join-Path $InstallDir $Exe)"
  $Installed = Join-Path $InstallDir $Exe
  Write-Host "version: $(& $Installed --version)"
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
