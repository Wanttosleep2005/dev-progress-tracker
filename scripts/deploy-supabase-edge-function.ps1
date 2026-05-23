param(
  [string]$ProjectRef = "",
  [string]$FunctionName = "devtrack-delete-account",
  [string]$SupabaseUrl = "",
  [string]$SupabaseCliPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-SupabaseCli {
  if ($SupabaseCliPath) {
    if (Test-Path -LiteralPath $SupabaseCliPath) { return $SupabaseCliPath }
    throw "Supabase CLI path does not exist: $SupabaseCliPath"
  }

  $fromPath = Get-Command supabase -ErrorAction SilentlyContinue
  if ($fromPath) { return $fromPath.Source }

  foreach ($candidate in @("G:\supabase-cli\supabase.exe", "G:\supabase-cli\supabase.cmd", "G:\supabase-cli\supabase")) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  return "npx supabase@latest"
}

function Read-EnvValue([string]$Key) {
  $envFile = Join-Path (Get-Location) ".env"
  if (-not (Test-Path -LiteralPath $envFile)) { return "" }
  $content = [System.IO.File]::ReadAllText($envFile)
  $match = [regex]::Match($content, "(?m)^$([regex]::Escape($Key))=(.+)$")
  if ($match.Success) { return $match.Groups[1].Value.Trim() }
  return ""
}

function Resolve-SupabaseProject {
  if (-not $SupabaseUrl) {
    $script:SupabaseUrl = Read-EnvValue "VITE_SUPABASE_URL"
  }
  if (-not $SupabaseUrl) {
    throw "Missing SupabaseUrl. Pass -SupabaseUrl or set VITE_SUPABASE_URL in .env."
  }
  if (-not $ProjectRef) {
    $hostName = ([Uri]$SupabaseUrl).Host
    $script:ProjectRef = $hostName.Split(".")[0]
  }
  if (-not $ProjectRef) {
    throw "Missing ProjectRef. Pass -ProjectRef explicitly."
  }
}

function Read-RequiredSecret([string]$Name, [string]$Prompt) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ($value) { return $value }

  $secureValue = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Invoke-SupabaseCli([string[]]$Arguments) {
  if ($supabaseCli -like "npx *") {
    & npx @("supabase@latest") @Arguments
  } else {
    & $supabaseCli @Arguments
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI command failed: $($Arguments -join ' ')"
  }
}

function Ensure-DeleteAccountFunctionUrl([string]$FunctionUrl) {
  $envFile = Join-Path (Get-Location) ".env"
  $envLine = "VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=$FunctionUrl"

  if (-not (Test-Path -LiteralPath $envFile)) {
    [System.IO.File]::AppendAllText($envFile, $envLine + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
    Write-Host "Created .env with delete account function URL." -ForegroundColor Yellow
    return
  }

  $content = [System.IO.File]::ReadAllText($envFile)
  $existing = [regex]::Match($content, "(?m)^VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL=.*$")
  if ($existing.Success) {
    if ($existing.Value -eq $envLine) {
      Write-Host ".env already has the delete account function URL. No .env changes made." -ForegroundColor Yellow
    } else {
      Write-Host ".env already has VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL with a different value. I did not rewrite .env." -ForegroundColor Yellow
      Write-Host "Expected line: $envLine" -ForegroundColor Yellow
    }
    return
  }

  $prefix = if ($content.EndsWith("`n") -or $content.EndsWith("`r")) { "" } else { [Environment]::NewLine }
  [System.IO.File]::AppendAllText($envFile, $prefix + $envLine + [Environment]::NewLine, [System.Text.Encoding]::UTF8)
  Write-Host "Appended VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL to .env. Other .env content was not changed." -ForegroundColor Yellow
}

$serviceRoleKey = Read-RequiredSecret "SUPABASE_SERVICE_ROLE_KEY" "Input SUPABASE_SERVICE_ROLE_KEY. It will only be saved as a Supabase Function Secret"
$anonKey = Read-RequiredSecret "SUPABASE_ANON_KEY" "Input SUPABASE_ANON_KEY"
Resolve-SupabaseProject

$supabaseCli = Resolve-SupabaseCli
$tempSecretFile = Join-Path $env:TEMP ("devtrack-supabase-secrets-" + [Guid]::NewGuid().ToString("N") + ".env")

try {
  $secretContent = @(
    "DEVTRACK_SUPABASE_URL=$SupabaseUrl"
    "DEVTRACK_SUPABASE_ANON_KEY=$anonKey"
    "DEVTRACK_SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey"
  ) -join [Environment]::NewLine
  Write-Utf8NoBom $tempSecretFile ($secretContent + [Environment]::NewLine)

  Write-Host "Setting Supabase Edge Function secrets..." -ForegroundColor Cyan
  Invoke-SupabaseCli @("secrets", "set", "--project-ref", $ProjectRef, "--env-file", $tempSecretFile)

  Write-Host "Deploying Edge Function: $FunctionName ..." -ForegroundColor Cyan
  Invoke-SupabaseCli @("functions", "deploy", $FunctionName, "--project-ref", $ProjectRef)

  $functionUrl = "$SupabaseUrl/functions/v1/$FunctionName"
  Ensure-DeleteAccountFunctionUrl $functionUrl
  Write-Host "Done." -ForegroundColor Green
  Write-Host "Function URL: $functionUrl" -ForegroundColor Green
  Write-Host "Only VITE_SUPABASE_DELETE_ACCOUNT_FUNCTION_URL is handled in .env; all other .env content is left untouched." -ForegroundColor Yellow
} finally {
  if (Test-Path -LiteralPath $tempSecretFile) {
    Remove-Item -LiteralPath $tempSecretFile -Force
  }
}
