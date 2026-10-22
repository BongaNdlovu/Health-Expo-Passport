# Builds, zip-aligns and signs the Android app:   powershell -File tools\sign-apk.ps1
# Output: android\app-release-signed.apk  (and prints its signing certificate fingerprint)
# Store and key passwords are generic credentials NEWSTART-Expo/keystore-store and NEWSTART-Expo/keystore-key.
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
$android = Join-Path $root 'android'
$sdk     = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$jdk     = if ($env:JAVA_HOME)    { $env:JAVA_HOME }    else { 'C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot' }
$env:JAVA_HOME = $jdk; $env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk

$tools = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $tools) { throw "No Android build-tools found in $sdk" }

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
  & (Join-Path $tools.FullName 'apksigner.bat') sign --ks (Join-Path $android 'signing\newstart.jks') --ks-key-alias newstart `
      --ks-pass env:NS_KS_STORE --key-pass env:NS_KS_KEY --out $signed $aligned
  if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }
  Remove-Item $aligned -Force
  Remove-Item Env:\NS_KS_STORE, Env:\NS_KS_KEY

  & (Join-Path $tools.FullName 'apksigner.bat') verify --verbose --print-certs $signed | Select-String 'Verifies|SHA-256|v2|v3'
  '{0}  {1:N0} bytes' -f $signed, (Get-Item $signed).Length
} finally { Pop-Location }
