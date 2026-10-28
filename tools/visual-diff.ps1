<#
.SYNOPSIS
  Compare two PNG/JPEG screenshots pixel by pixel with System.Drawing.

.PARAMETER A
  Reference image.

.PARAMETER B
  Candidate image.

.PARAMETER Out
  Optional diff PNG path. Defaults to verification/diffs/<A>-vs-<B>.diff.png.

.PARAMETER ThresholdPct
  Maximum percentage of differing pixels that still passes. Default 0.5.

.EXITCODES
  0 below/equal to threshold; 1 above threshold; 2 invalid input or image error.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$A,

    [Parameter(Mandatory = $true)]
    [string]$B,

    [string]$Out,

    [double]$ThresholdPct = 0.5
)

$ErrorActionPreference = 'Stop'
$invariant = [System.Globalization.CultureInfo]::InvariantCulture

function Write-InputError([string]$message) {
    [Console]::Error.WriteLine('visual-diff: ' + $message)
}

function Format-Integer([long]$value) {
    return $value.ToString('N0', $invariant)
}

function Format-Percent([double]$value) {
    return $value.ToString('0.0000', $invariant) + '%'
}

$exitCode = $null
$outPath = $null
$srcA = $null
$srcB = $null
$bmpA = $null
$bmpB = $null
$diffBmp = $null
$diffPixels = 0L
$totalPixels = 0L
$maxDelta = 0
$diffPct = 0.0
$imageWidth = 0
$imageHeight = 0

try {
    if ([string]::IsNullOrWhiteSpace($A) -or -not (Test-Path -LiteralPath $A -PathType Leaf)) {
        throw "A is not a readable file: $A"
    }
    if ([string]::IsNullOrWhiteSpace($B) -or -not (Test-Path -LiteralPath $B -PathType Leaf)) {
        throw "B is not a readable file: $B"
    }
    if ($ThresholdPct -lt 0 -or $ThresholdPct -gt 100) {
        throw "ThresholdPct must be between 0 and 100 (got $ThresholdPct)"
    }

    $aFull = (Resolve-Path -LiteralPath $A -ErrorAction Stop).ProviderPath
    $bFull = (Resolve-Path -LiteralPath $B -ErrorAction Stop).ProviderPath

    if ([string]::IsNullOrWhiteSpace($Out)) {
        $repoRoot = Split-Path -Parent $PSScriptRoot
        $stemA = [System.IO.Path]::GetFileNameWithoutExtension($aFull)
        $stemB = [System.IO.Path]::GetFileNameWithoutExtension($bFull)
        $outPath = Join-Path $repoRoot ('verification\diffs\' + $stemA + '-vs-' + $stemB + '.diff.png')
    }
    else {
        $outPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
        if ([System.IO.Path]::GetExtension($outPath) -eq '') {
            $outPath += '.png'
        }
    }

    $outPath = [System.IO.Path]::GetFullPath($outPath)
    if ([string]::Equals($outPath, $aFull, [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($outPath, $bFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Out must not be the same path as A or B'
    }
    if (Test-Path -LiteralPath $outPath -PathType Container) {
        throw "Out is a directory, not a PNG path: $outPath"
    }

    Add-Type -AssemblyName System.Drawing -ErrorAction Stop

    $srcA = [System.Drawing.Bitmap]::FromFile($aFull)
    $srcB = [System.Drawing.Bitmap]::FromFile($bFull)
    if ($srcA.Width -ne $srcB.Width -or $srcA.Height -ne $srcB.Height) {
        throw ("image sizes differ: A is {0}x{1}, B is {2}x{3}" -f $srcA.Width, $srcA.Height, $srcB.Width, $srcB.Height)
    }

    $imageWidth = $srcA.Width
    $imageHeight = $srcA.Height
    $totalPixels = [long]$imageWidth * [long]$imageHeight
    if ($totalPixels -le 0) {
        throw 'images have no pixels'
    }

    # Normalize both inputs to 32bpp ARGB so LockBits/Win32 stride is predictable.
    $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $rect = [System.Drawing.Rectangle]::new(0, 0, $imageWidth, $imageHeight)

    $bmpA = [System.Drawing.Bitmap]::new($imageWidth, $imageHeight, $pixelFormat)
    $gA = [System.Drawing.Graphics]::FromImage($bmpA)
    try {
        $gA.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $gA.DrawImage($srcA, $rect)
    }
    finally {
        $gA.Dispose()
    }

    $bmpB = [System.Drawing.Bitmap]::new($imageWidth, $imageHeight, $pixelFormat)
    $gB = [System.Drawing.Graphics]::FromImage($bmpB)
    try {
        $gB.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $gB.DrawImage($srcB, $rect)
    }
    finally {
        $gB.Dispose()
    }

    $dataA = $null
    $dataB = $null
    $diffData = $null
    try {
        $dataA = $bmpA.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $pixelFormat)
        $dataB = $bmpB.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $pixelFormat)
        $stride = $dataA.Stride
        if ($stride -ne $dataB.Stride) {
            throw 'internal error: normalized images have different strides'
        }
        $bufferLength = $stride * $imageHeight
        $bytesA = New-Object byte[] $bufferLength
        $bytesB = New-Object byte[] $bufferLength
        $diffBytes = New-Object byte[] $bufferLength
        [System.Runtime.InteropServices.Marshal]::Copy($dataA.Scan0, $bytesA, 0, $bufferLength)
        [System.Runtime.InteropServices.Marshal]::Copy($dataB.Scan0, $bytesB, 0, $bufferLength)

        for ($y = 0; $y -lt $imageHeight; $y++) {
            $rowStart = $y * $stride
            for ($x = 0; $x -lt $imageWidth; $x++) {
                $offset = $rowStart + ($x * 4)
                $db = [Math]::Abs([int]$bytesA[$offset] - [int]$bytesB[$offset])
                $dg = [Math]::Abs([int]$bytesA[$offset + 1] - [int]$bytesB[$offset + 1])
                $dr = [Math]::Abs([int]$bytesA[$offset + 2] - [int]$bytesB[$offset + 2])
                $da = [Math]::Abs([int]$bytesA[$offset + 3] - [int]$bytesB[$offset + 3])
                $delta = $db
                if ($dg -gt $delta) { $delta = $dg }
                if ($dr -gt $delta) { $delta = $dr }
                if ($da -gt $delta) { $delta = $da }
                if ($delta -gt $maxDelta) { $maxDelta = $delta }

                if ($delta -eq 0) {
                    $diffBytes[$offset] = 255
                    $diffBytes[$offset + 1] = 255
                    $diffBytes[$offset + 2] = 255
                    $diffBytes[$offset + 3] = 255
                }
                else {
                    $diffPixels++
                    $diffBytes[$offset] = 0
                    $diffBytes[$offset + 1] = 0
                    $diffBytes[$offset + 2] = 255
                    $diffBytes[$offset + 3] = 255
                }
            }
        }
    }
    finally {
        if ($null -ne $dataB) { $bmpB.UnlockBits($dataB) }
        if ($null -ne $dataA) { $bmpA.UnlockBits($dataA) }
    }

    $diffPct = (100.0 * [double]$diffPixels) / [double]$totalPixels

    $outDir = Split-Path -Parent $outPath
    if ([string]::IsNullOrWhiteSpace($outDir)) {
        $outDir = (Get-Location).ProviderPath
    }
    if (-not (Test-Path -LiteralPath $outDir -PathType Container)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    $diffBmp = [System.Drawing.Bitmap]::new($imageWidth, $imageHeight, $pixelFormat)
    $diffData = $diffBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $pixelFormat)
    try {
        [System.Runtime.InteropServices.Marshal]::Copy($diffBytes, 0, $diffData.Scan0, $bufferLength)
    }
    finally {
        $diffBmp.UnlockBits($diffData)
        $diffData = $null
    }
    $diffBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
catch {
    Write-InputError $_.Exception.Message
    $exitCode = 2
}
finally {
    if ($null -ne $diffBmp) { $diffBmp.Dispose() }
    if ($null -ne $bmpB) { $bmpB.Dispose() }
    if ($null -ne $bmpA) { $bmpA.Dispose() }
    if ($null -ne $srcB) { $srcB.Dispose() }
    if ($null -ne $srcA) { $srcA.Dispose() }
}

if ($exitCode -eq 2) {
    exit 2
}

$failed = $diffPct -gt $ThresholdPct
Write-Output 'visual-diff'
Write-Output ('A:                        ' + $aFull)
Write-Output ('B:                        ' + $bFull)
Write-Output ('size:                     ' + $imageWidth + 'x' + $imageHeight + ' (' + (Format-Integer $totalPixels) + ' px)')
Write-Output ('differing pixels:         ' + (Format-Integer $diffPixels) + ' (' + (Format-Percent $diffPct) + ')')
Write-Output ('max per-channel delta:    ' + $maxDelta + ' (RGBA, 0-255)')
Write-Output ('threshold:                ' + (Format-Percent $ThresholdPct))
Write-Output ('diff PNG:                 ' + $outPath)
Write-Output ('diff PNG bytes:           ' + (Format-Integer ([System.IO.FileInfo]::new($outPath).Length)))
Write-Output ('result:                   ' + $(if ($failed) { 'FAIL' } else { 'PASS' }))

if ($failed) {
    exit 1
}
exit 0
