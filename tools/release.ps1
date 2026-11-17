# One release, in the order it has to happen:   npm run release            (website only)
#                                                npm run release -- -Android  (a new Android app too)
#
#  1. refuses to start unless every change is committed (a release ships what is in git, nothing else)
#  2. runs the tests and the typecheck              (-SkipTests leaves them out)
#  3. -Android: bumps versionCode and the last part of versionName in capacitor/android/app/build.gradle, commits
#     that, and builds and signs the app with tools/sign-app.ps1 (passwords come from Windows Credential Manager)
#  4. builds dist/ AFTER signing, so the download on the website is the app just signed (sign-app.ps1 builds before
#     it signs, which used to leave dist/ one APK behind), then runs the build checks
#  5. commits index.html if the build brought its CSP hashes up to date, and pushes the branch. dist/ is not in git
#     (since 2026-11-17): it is built here and deployed straight from this folder. -Android also puts the signed APK
#     on a GitHub Release (v<versionName>), so every app version is kept outside the repository's history
#  6. deploys the app and the landing page, then reads /version.json from the live site until it shows this build
#                                                    (-NoDeploy stops after the push)
param([switch]$Android, [switch]$SkipTests, [switch]$NoDeploy)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# $label, not $name: a step's script block runs inside this function, so a parameter called $name hid the
# version ($name) from every step that used it (the 1.7.5 release tagged "vGitHub release v1.7.5" and failed)
function Step([string]$label, [scriptblock]$run) {
  Write-Host "`n== $label" -ForegroundColor Cyan
  & $run
  if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE) - nothing after this step was done" }
}

# 1. a clean tree
$dirty = git status --porcelain
if ($dirty) { throw "Commit or stash these first, a release ships only what is committed:`n$($dirty -join "`n")" }
$branch = (git rev-parse --abbrev-ref HEAD).Trim()

# 2. tests
if (-not $SkipTests) {
  Step 'tests (npm test)' { npm test }
  Step 'typecheck' { npm run typecheck }
}

# 3. the Android app
if ($Android) {
  $gradle = Join-Path $root 'capacitor\android\app\build.gradle'
  $text = [IO.File]::ReadAllText($gradle)
  $codeMatch = [regex]::Match($text, 'versionCode (\d+)')
  $nameMatch = [regex]::Match($text, 'versionName "(\d+)\.(\d+)\.(\d+)"')
  if (-not $codeMatch.Success -or -not $nameMatch.Success) { throw "build.gradle: versionCode or versionName not found" }
  $code = [int]$codeMatch.Groups[1].Value + 1
  $name = '{0}.{1}.{2}' -f $nameMatch.Groups[1].Value, $nameMatch.Groups[2].Value, ([int]$nameMatch.Groups[3].Value + 1)
  $text = $text.Replace($codeMatch.Value, "versionCode $code").Replace($nameMatch.Value, "versionName `"$name`"")
  [IO.File]::WriteAllText($gradle, $text)
  Step "commit Android $name" { git add $gradle; git commit -q -m "Android $name (versionCode $code)" }
  Step 'build and sign the Android app' { powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'tools\sign-app.ps1') }
}

# 4. the website, built after signing
Step 'build dist/' { node tools/build.js }
Step 'build checks' { npm run test:build }

# 5. commit what the build changed in the source (only index.html's CSP hashes can change), push, keep the APK
$version = (Get-Content (Join-Path $root 'dist\version.json') -Raw | ConvertFrom-Json).version
git add index.html
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { Step 'commit index.html' { git commit -q -m "index.html: inline-script hashes brought up to date by the build (stamp $version)" } }
Step "push $branch" { git push origin $branch }
if ($Android) {
  $apk = Join-Path $root 'capacitor\android\app-release-signed.apk'
  $asset = Join-Path ([IO.Path]::GetTempPath()) "newstart-$name.apk"
  Copy-Item $apk $asset -Force
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    Step "GitHub release v$name" { gh release create "v$name" $asset --title "Android $name" --notes "Android $name (versionCode $code). The website serves the same file at /newstart.apk." }
  } else { Write-Host "gh is not installed: attach $asset to a GitHub release v$name by hand" -ForegroundColor Yellow }
}
if ($NoDeploy) { Write-Host "`nPushed. Not deployed (-NoDeploy)."; exit 0 }

# 6. deploy and check
Step 'deploy the app' { npm run deploy }
Step 'deploy the landing page' { npm run deploy:landing }
$platform = Get-Content (Join-Path $root 'src\platform.js') -Raw
$site = [regex]::Match($platform, "export const APP_SITE='([^']+)'").Groups[1].Value
$live = ''
foreach ($try in 1..6) {
  try { $live = (Invoke-RestMethod -Uri ($site + 'version.json?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -TimeoutSec 20).version } catch { $live = '' }
  if ($live -eq $version) { break }
  Start-Sleep -Seconds 10
}
if ($live -ne $version) { throw "Deployed, but the live site still says '$live', not '$version'. Check $site in a minute." }
Write-Host "`nReleased: the live site serves $version." -ForegroundColor Green
if ($Android) { Write-Host "Android $name (versionCode $code) is the download on the site." -ForegroundColor Green }
