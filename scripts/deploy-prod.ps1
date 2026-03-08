param(
  [switch]$SkipPush,
  [switch]$SkipDeploy,
  [string]$TestCommand = "npm test",
  [string]$BuildCommand = "npx next build"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CmdStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  Write-Host "    cmd /c $Command"

  & cmd /c $Command
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode."
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  Write-Host ""
  Write-Host "==> $Name"
  if ($Arguments.Count -gt 0) {
    Write-Host "    $FilePath $($Arguments -join ' ')"
  } else {
    Write-Host "    $FilePath"
  }

  & $FilePath @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "$Name failed with exit code $exitCode."
  }
}

try {
  Invoke-CmdStep -Name "Run tests" -Command $TestCommand
  Invoke-CmdStep -Name "Build application" -Command $BuildCommand

  if ($SkipPush) {
    Write-Host ""
    Write-Host "==> Skip git push (--SkipPush)"
  } else {
    Invoke-Step -Name "Push commits" -FilePath "git" -Arguments @("push")
  }

  if ($SkipDeploy) {
    Write-Host ""
    Write-Host "==> Skip Vercel deploy (--SkipDeploy)"
  } else {
    Invoke-CmdStep -Name "Deploy to Vercel production" -Command "npx vercel --prod"
  }

  Write-Host ""
  Write-Host "Deployment workflow completed successfully."
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
