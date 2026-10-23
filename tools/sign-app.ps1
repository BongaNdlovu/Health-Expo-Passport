# Builds, zip-aligns and signs the Capacitor Android app:   powershell -File tools\sign-app.ps1
# Output: capacitor\android\app-release-signed.apk  (and prints its signing certificate fingerprint)
# Signs with android\signing\newstart.jks and the Credential Manager entries (NEWSTART-Expo/keystore-store and
# NEWSTART-Expo/keystore-key), so the app installs over the current one. Capacitor 8 needs Java 21: the portable JDK in
# %LOCALAPPDATA%\expo-build-tools\jdk-21 is used unless JAVA_HOME already points at one.
$ErrorActionPreference = 'Stop'

if (-not ('NewstartCred' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class NewstartCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct NativeCred {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credential);
  [DllImport("advapi32", SetLastError = true)]
  public static extern void CredFree(IntPtr credential);
  public static string Read(string target) {
    IntPtr p;
    if (!CredRead(target, 1, 0, out p))
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      NativeCred c = Marshal.PtrToStructure<NativeCred>(p);
      byte[] bytes = new byte[c.CredentialBlobSize];
      Marshal.Copy(c.CredentialBlob, bytes, 0, bytes.Length);
      return Encoding.Unicode.GetString(bytes);
    } finally { CredFree(p); }
  }
}
'@
}

function Get-NewstartCredential([string]$target) {
  try { return [NewstartCred]::Read($target) }
  catch {
    throw "Missing Windows Credential Manager entry '$target'. Do not put the password back in the project folder."
  }
}
$root    = Split-Path -Parent $PSScriptRoot
$cap     = Join-Path $root 'capacitor'
$android = Join-Path $cap 'android'
$sdk     = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
# the JDK's own "release" file says its version; running java -version would write to stderr, which 'Stop' turns into a crash
$isJdk21 = { param($h) $h -and (Test-Path (Join-Path $h 'bin\java.exe')) -and (Test-Path (Join-Path $h 'release')) -and
             ((Get-Content (Join-Path $h 'release') -Raw) -match '(?m)^JAVA_VERSION="21\.') }
$jdk     = if (& $isJdk21 $env:JAVA_HOME) { $env:JAVA_HOME } else { Join-Path $env:LOCALAPPDATA 'expo-build-tools\jdk-21' }
if (-not (Test-Path (Join-Path $jdk 'bin\java.exe'))) { throw "Java 21 not found at $jdk" }
$env:JAVA_HOME = $jdk; $env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk

$tools = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $tools) { throw "No Android build-tools found in $sdk" }

# the app's own files: the same page as the web site, plus the bundled libraries (hash-checked) and fonts
& node (Join-Path $root 'tools\build-app.js')
if ($LASTEXITCODE -ne 0) { throw 'tools/build-app.js failed' }
# Capacitor's own command line, called by its path (npx cannot always find it when started from PowerShell)
$capCli = Join-Path $cap 'node_modules\@capacitor\cli\bin\capacitor'
if (-not (Test-Path $capCli)) { throw "Capacitor is not installed: run 'npm install' in $cap" }
Push-Location $cap
try {
  & node $capCli sync android
  if ($LASTEXITCODE -ne 0) { throw 'cap sync android failed' }
} finally { Pop-Location }

Push-Location $android
try {
  [IO.File]::WriteAllText((Join-Path $android 'local.properties'), ('sdk.dir=' + ($sdk -replace '\\', '\\' -replace ':', '\:') + "`n"))
  & .\gradlew.bat assembleRelease --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }

  $unsigned = Join-Path $android 'app\build\outputs\apk\release\app-release-unsigned.apk'
  if (-not (Test-Path $unsigned)) { throw "Expected $unsigned" }
  $aligned = Join-Path $android 'app-release-aligned.apk'
  $signed  = Join-Path $android 'app-release-signed.apk'
  Remove-Item $aligned, $signed -Force -ErrorAction SilentlyContinue

  & (Join-Path $tools.FullName 'zipalign.exe') -f -p 4 $unsigned $aligned
  if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

  # Passwords live in Windows Credential Manager, never in the project folder.
  # They are handed to apksigner through the environment, never on the command line.
  $env:NS_KS_STORE = Get-NewstartCredential 'NEWSTART-Expo/keystore-store'
  $env:NS_KS_KEY   = Get-NewstartCredential 'NEWSTART-Expo/keystore-key'
  & (Join-Path $tools.FullName 'apksigner.bat') sign --ks (Join-Path $root 'android\signing\newstart.jks') --ks-key-alias newstart `
      --ks-pass env:NS_KS_STORE --key-pass env:NS_KS_KEY --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out $signed $aligned
  $signStatus = $LASTEXITCODE
  Remove-Item Env:\NS_KS_STORE, Env:\NS_KS_KEY
  if ($signStatus -ne 0) { throw 'apksigner failed' }
  Remove-Item $aligned -Force

  & (Join-Path $tools.FullName 'apksigner.bat') verify --verbose --print-certs $signed | Select-String 'Verifies|SHA-256|v1 scheme|v2 scheme|v3 scheme'
  '{0}  {1:N0} bytes' -f $signed, (Get-Item $signed).Length
} finally { Pop-Location }
