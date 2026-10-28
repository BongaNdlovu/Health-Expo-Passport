<#
.SYNOPSIS
  Capture a screenshot of the built, self-contained app at an exact phone viewport.

.DESCRIPTION
  Copies the app HTML to a temporary directory, relaxes only the temp copy's CSP,
  injects capture hooks at the end of the temp body, renders it inside a wrapper
  iframe (Chrome headless has a minimum window width), and crops the screenshot
  back to the requested width and height.

  The real dist/index.html is never modified.

.PARAMETER Name
  Output file name, without or with .png.

.PARAMETER OutDir
  Output directory. Default: verification/shots.

.PARAMETER Width
  Exact iframe width. Default: 430.

.PARAMETER Height
  Exact iframe height. Default: 932.

.PARAMETER Theme
  light or dark. Default: light. The tool calls __NEWSTART.__internals.setTheme()
  when the build exposes it, and warns (rather than fails) when it does not.

.PARAMETER Demo
  Call __NEWSTART.__internals.gateDemo() before the screenshot.

.PARAMETER Freeze
  Freeze CSS animation/transitions and hide #intro. Default: on. Disable with
  -Freeze:$false.

.PARAMETER AppPath
  Built HTML file. Default: dist/index.html.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Name,

    [string]$OutDir = 'verification/shots',

    [ValidateRange(1, 5000)]
    [int]$Width = 430,

    [ValidateRange(1, 5000)]
    [int]$Height = 932,

    [ValidateSet('dark', 'light')]
    [string]$Theme = 'light',

    [switch]$Demo,

    [ValidateSet('home', 'visit', 'queue', 'care', 'serve', 'me')]
    [string]$Tab = 'home',

    [switch]$Freeze = $true,

    [string]$AppPath = 'dist/index.html'
)

$ErrorActionPreference = 'Stop'
$chromeExe = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$tempRoot = $null
$exitCode = 0
$failure = $null
$chromeStderrPath = $null
$chromeProcess = $null
$profileDir = $null
$warnings = New-Object System.Collections.Generic.List[string]
$outputPath = $null
$appSha256 = $null
$appBytes = 0
$lastProbeJson = $null
$script:cdpSocket = $null
$script:cdpCommandId = 0
$script:cdpCancellationToken = [System.Threading.CancellationToken]::None

function Write-CaptureError([string]$message) {
    [Console]::Error.WriteLine('capture: ' + $message)
}

function Quote-NativeArgument([string]$value) {
    if ($value -match '[\s"]') {
        return '"' + $value.Replace('"', '\"') + '"'
    }
    return $value
}

function ConvertTo-HtmlAttribute([string]$value) {
    return $value.Replace('&', '&amp;').Replace('"', '&quot;').Replace('<', '&lt;').Replace('>', '&gt;')
}

function New-RelaxedCsp([string]$csp) {
    $directives = New-Object System.Collections.Generic.List[string]
    $scriptSrcSeen = $false

    foreach ($rawDirective in ($csp -split ';')) {
        $directive = $rawDirective.Trim()
        if (-not $directive) { continue }
        $parts = @($directive -split '\s+')
        $directiveName = $parts[0].ToLowerInvariant()

        if ($directiveName -eq 'frame-ancestors') {
            continue
        }

        if ($directiveName -eq 'script-src') {
            $scriptSrcSeen = $true
            $sources = New-Object System.Collections.Generic.List[string]
            foreach ($source in @($parts | Select-Object -Skip 1)) {
                # A CSP nonce/hash makes 'unsafe-inline' inert in Chrome. The temp copy
                # has to drop them, otherwise the injected capture script is blocked.
                if ($source -match "^'(sha256|sha384|sha512)-") { continue }
                if ($source -match "^'nonce-") { continue }
                if ($source -eq "'unsafe-inline'") { continue }
                if (-not $sources.Contains($source)) { $sources.Add($source) }
            }
            $sources.Add("'unsafe-inline'")
            $directives.Add('script-src ' + ($sources -join ' '))
            continue
        }

        $directives.Add($directive)
    }

    if (-not $scriptSrcSeen) {
        $directives.Insert(0, "script-src 'self' 'unsafe-inline'")
    }

    return ($directives -join '; ')
}

function Get-TextTail([string]$path, [int]$lineCount = 12) {
    if (-not $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { return '' }
    try {
        $lines = @(Get-Content -LiteralPath $path -ErrorAction Stop)
        if ($lines.Count -le $lineCount) { return ($lines -join [Environment]::NewLine) }
        return (($lines | Select-Object -Last $lineCount) -join [Environment]::NewLine)
    }
    catch {
        return ''
    }
}

function Receive-CdpMessage {
    if ($null -eq $script:cdpSocket -or $script:cdpSocket.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
        throw 'The Chrome DevTools websocket is not open.'
    }
    $stream = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 131072
    try {
        do {
            $receive = $script:cdpSocket.ReceiveAsync(
                [ArraySegment[byte]]::new($buffer),
                $script:cdpCancellationToken
            ).GetAwaiter().GetResult()
            if ($receive.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                throw 'Chrome closed the DevTools websocket unexpectedly.'
            }
            if ($receive.Count -gt 0) {
                $stream.Write($buffer, 0, $receive.Count)
            }
        } while (-not $receive.EndOfMessage)
        return [System.Text.Encoding]::UTF8.GetString($stream.ToArray())
    }
    finally {
        $stream.Dispose()
    }
}

function Invoke-CdpCommand([string]$method, $params) {
    if ($null -eq $script:cdpSocket -or $script:cdpSocket.State -ne [System.Net.WebSockets.WebSocketState]::Open) {
        throw 'The Chrome DevTools websocket is not open.'
    }
    $script:cdpCommandId++
    $requestedId = $script:cdpCommandId
    $requestJson = @{ id = $requestedId; method = $method; params = $params } | ConvertTo-Json -Compress -Depth 20
    $requestBytes = [System.Text.Encoding]::UTF8.GetBytes($requestJson)
    $script:cdpSocket.SendAsync(
        [ArraySegment[byte]]::new($requestBytes),
        [System.Net.WebSockets.WebSocketMessageType]::Text,
        $true,
        $script:cdpCancellationToken
    ).GetAwaiter().GetResult() | Out-Null

    while ($true) {
        $messageText = Receive-CdpMessage
        $message = $messageText | ConvertFrom-Json -ErrorAction Stop
        if ($message.id -ne $requestedId) { continue }
        if ($message.error) {
            throw ("Chrome DevTools command {0} failed: {1}" -f $method, $message.error.message)
        }
        return $message.result
    }
}

function Stop-ChromeForProfile([string]$profilePath) {
    if ([string]::IsNullOrWhiteSpace($profilePath)) { return }
    try {
        Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.CommandLine -and
                $_.CommandLine.IndexOf($profilePath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
            } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    }
    catch {
        # Best-effort cleanup only; the main capture result has already been decided.
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($Name)) {
        throw 'Name must not be empty.'
    }
    $invalidNameChars = [System.IO.Path]::GetInvalidFileNameChars()
    if ($Name.IndexOfAny($invalidNameChars) -ge 0 -or $Name.Contains('\') -or $Name.Contains('/')) {
        throw "Name must be a file name, not a path: $Name"
    }
    $fileName = $Name
    if (-not $fileName.EndsWith('.png', [System.StringComparison]::OrdinalIgnoreCase)) {
        $fileName += '.png'
    }

    if (-not (Test-Path -LiteralPath $chromeExe -PathType Leaf)) {
        throw "Chrome was not found at $chromeExe."
    }

    $appFull = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($AppPath)
    if (-not (Test-Path -LiteralPath $appFull -PathType Leaf)) {
        throw "AppPath does not exist or is not a file: $appFull"
    }

    $outDirFull = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutDir)
    if (Test-Path -LiteralPath $outDirFull -PathType Leaf) {
        throw "OutDir is a file, not a directory: $outDirFull"
    }
    if (-not (Test-Path -LiteralPath $outDirFull -PathType Container)) {
        New-Item -ItemType Directory -Path $outDirFull -Force | Out-Null
    }
    $outputPath = Join-Path $outDirFull $fileName

    $appBytes = (Get-Item -LiteralPath $appFull).Length
    $appSha256 = (Get-FileHash -LiteralPath $appFull -Algorithm SHA256).Hash

    $tempRoot = Join-Path $env:TEMP ('newstart-capture-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    $tempApp = Join-Path $tempRoot 'app.html'
    $wrapperPath = Join-Path $tempRoot 'wrapper.html'
    $profileDir = Join-Path $tempRoot 'chrome-profile'
    $chromeShot = Join-Path $tempRoot 'chrome-shot.png'
    $chromeDom = Join-Path $tempRoot 'chrome-dom.html'
    $chromeLog = Join-Path $tempRoot 'chrome-log.txt'
    $chromeStderrPath = Join-Path $tempRoot 'chrome-stderr.txt'
    $croppedPath = Join-Path $tempRoot 'cropped.png'

    $html = [System.IO.File]::ReadAllText($appFull)
    if ($html.LastIndexOf('</body>', [System.StringComparison]::Ordinal) -lt 0) {
        throw 'The app HTML has no closing </body> tag.'
    }

    $cspMetaPattern = '(?is)<meta\s+http-equiv\s*=\s*(?<hq>["''])Content-Security-Policy\k<hq>\s+content\s*=\s*(?<cq>["''])(?<csp>.*?)\k<cq>\s*/?>'
    $cspMatches = [System.Text.RegularExpressions.Regex]::Matches($html, $cspMetaPattern)
    if ($cspMatches.Count -ne 1) {
        throw "Expected exactly one CSP meta tag in the app; found $($cspMatches.Count)."
    }
    $cspMatch = $cspMatches[0]
    $oldCsp = $cspMatch.Groups['csp'].Value
    $newCsp = New-RelaxedCsp $oldCsp
    if ($newCsp -notmatch "(?is)(?:^|;\s*)script-src\s+[^;]*'unsafe-inline'") {
        throw 'Failed to add unsafe-inline to the temp copy CSP script-src.'
    }
    if ($newCsp -match '(?i)frame-ancestors') {
        throw 'Failed to remove frame-ancestors from the temp copy CSP.'
    }
    $newMeta = $cspMatch.Value.Replace($oldCsp, $newCsp)
    $html = $html.Substring(0, $cspMatch.Index) + $newMeta + $html.Substring($cspMatch.Index + $cspMatch.Length)

    $themeJs = "'" + $Theme + "'"
    $bootScript = @'
<script id="__capture_theme_boot">
(function () {
  try {
    localStorage.setItem('newstart.theme', __THEME__);
    window.__NEWSTART_CAPTURE_BOOT__ = { stored: true, theme: __THEME__ };
  } catch (e) {
    window.__NEWSTART_CAPTURE_BOOT__ = { stored: false, theme: __THEME__, error: String(e) };
  }
})();
</script>
'@.Replace('__THEME__', $themeJs)

    $updatedCspMatch = [System.Text.RegularExpressions.Regex]::Match($html, $cspMetaPattern)
    if (-not $updatedCspMatch.Success) {
        throw 'Internal error: lost the CSP meta tag after rewriting it.'
    }
    $html = $html.Insert($updatedCspMatch.Index + $updatedCspMatch.Length, [Environment]::NewLine + $bootScript)
    $lastBodyIndex = $html.LastIndexOf('</body>', [System.StringComparison]::Ordinal)
    if ($lastBodyIndex -lt 0) {
        throw 'The app HTML has no closing </body> tag after CSP setup.'
    }

    $themeJs = "'" + $Theme + "'"
    $demoJs = if ($Demo.IsPresent) { 'true' } else { 'false' }
    $freezeJs = if ($Freeze.IsPresent) { 'true' } else { 'false' }

    $captureScript = @'
<script id="__capture_actions">
(function () {
  var cfg = { theme: __THEME__, demo: __DEMO__, freeze: __FREEZE__, tab: __TAB__ };
  var status = window.__NEWSTART_CAPTURE_STATUS__ = {
    ok: false,
    ready: false,
    phase: 'start',
    error: null,
    warning: null,
    theme: cfg.theme,
    demo: cfg.demo,
    freeze: cfg.freeze,
    internals: false,
    themeApi: false,
    themeApplied: false,
    themeStored: false,
    gateDemoApi: false,
    gateDemoCalled: false,
    gateHidden: null,
    authGatePresent: false,
    freezeApplied: false,
    introHidden: false,
    boot: window.__NEWSTART_CAPTURE_BOOT__ || null
  };

  function fail(message) {
    status.error = String(message);
    status.phase = 'error';
    try {
      var box = document.createElement('div');
      box.id = '__capture_error';
      box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#a40000;color:#fff;font:16px/1.45 monospace;padding:24px;white-space:pre-wrap;overflow:auto';
      box.textContent = 'CAPTURE FAILED\n\n' + status.error;
      (document.body || document.documentElement).appendChild(box);
    } catch (ignored) {}
    try { document.title = 'CAPTURE ERROR'; } catch (ignored) {}
  }

  try {
    try {
      localStorage.setItem('newstart.theme', cfg.theme);
      status.themeStored = true;
    } catch (storageError) {
      status.storageError = String(storageError);
    }

    if (cfg.freeze) {
      var freezeStyle = document.createElement('style');
      freezeStyle.id = '__capture_freeze';
      freezeStyle.textContent =
        '*,*::before,*::after{' +
        'animation-duration:0.001s!important;' +
        'animation-delay:0s!important;' +
        'animation-iteration-count:1!important;' +
        'animation-fill-mode:both!important;' +
        'animation-play-state:running!important;' +
        'transition-duration:0.001s!important;' +
        'transition-delay:0s!important;' +
        'scroll-behavior:auto!important}' +
        'html,body{scroll-behavior:auto!important}' +
        '#intro{display:none!important;visibility:hidden!important;opacity:0!important}';
      (document.head || document.documentElement).appendChild(freezeStyle);

      var intro = document.getElementById('intro');
      if (intro) {
        intro.style.setProperty('display', 'none', 'important');
        intro.setAttribute('data-capture-hidden', '1');
        status.introHidden = true;
      }

      if (document.getAnimations) {
        var animations = document.getAnimations();
        for (var i = 0; i < animations.length; i++) {
          try { animations[i].finish(); } catch (ignored) {}
        }
      }
      status.freezeApplied = true;
    }

    var api = window.__NEWSTART && window.__NEWSTART.__internals;
    status.internals = !!api;
    if (!api) throw new Error('window.__NEWSTART.__internals is missing after boot');

    if (typeof api.setTheme === 'function') {
      status.themeApi = true;
      api.setTheme(cfg.theme);
      status.themeApplied = true;
    } else {
      status.warning = 'This build does not expose __NEWSTART.__internals.setTheme(); ' +
        'the requested theme was not applied by the bundle.';
    }
    if (document.documentElement) {
      status.appliedTheme = document.documentElement.getAttribute('data-theme');
    }

    if (typeof api.gateDemo === 'function') {
      status.gateDemoApi = true;
      if (cfg.demo) {
        api.gateDemo();
        status.gateDemoCalled = true;
      }
    } else if (cfg.demo) {
      throw new Error('Demo requested, but __NEWSTART.__internals.gateDemo() is missing.');
    }

    var gate = document.getElementById('authGate');
    status.authGatePresent = !!gate;
    status.gateHidden = !!(gate && gate.classList && gate.classList.contains('hidden'));

    if (cfg.demo && !status.gateHidden) {
      throw new Error('gateDemo() ran, but the sign-in gate is still visible.');
    }
    if (!cfg.demo && (!gate || status.gateHidden)) {
      throw new Error('Gate capture requested, but the sign-in gate is missing or hidden.');
    }

    function finishCapture() {
      if (cfg.tab && cfg.tab !== 'home') {
        if (!api.state || typeof api.render !== 'function') throw new Error('Tab requested, but state/render are not exposed.');
        api.state.tab = cfg.tab;
        api.render();
        status.tab = cfg.tab;
        status.tabAfter = api.state.tab;
      }
      status.ready = true;
      status.ok = true;
      status.phase = 'done';
      status.setTheme = status.themeApplied;
    }
    /* the app's boot render can land just after this hook; switch once the layout has settled */
    if (cfg.tab && cfg.tab !== 'home') setTimeout(finishCapture, 700);
    else finishCapture();
  } catch (err) {
    fail(err && err.stack ? err.stack : err);
  }
})();
</script>
'@
    $tabJs = "'" + $Tab + "'"
    $captureScript = $captureScript.Replace('__THEME__', $themeJs).Replace('__DEMO__', $demoJs).Replace('__FREEZE__', $freezeJs).Replace('__TAB__', $tabJs)
    $html = $html.Insert($lastBodyIndex, $captureScript + [Environment]::NewLine)
    [System.IO.File]::WriteAllText($tempApp, $html, (New-Object System.Text.UTF8Encoding($false)))

    $appUri = (New-Object System.Uri($tempApp)).AbsoluteUri.Replace('&', '&amp;').Replace('"', '&quot;')
    $configJson = '{"theme":"' + $Theme + '","demo":' + $demoJs + ',"freeze":' + $freezeJs + ',"tab":"' + $Tab + '"}'
    $wrapperTemplate = @'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0 !important; padding: 0 !important; width: 100%; height: 100%; overflow: hidden !important; background: #fff; }
  #app { position: absolute; left: 0; top: 0; display: block; margin: 0 !important; padding: 0 !important; border: 0; background: #fff; width: __WIDTH__px; height: __HEIGHT__px; }
  #capture-status { display: none !important; }
</style>
</head>
<body>
<iframe id="app" src="__APP_URI__" width="__WIDTH__" height="__HEIGHT__" title="Health Expo capture"></iframe>
<pre id="capture-status"></pre>
<script>
(function () {
  var cfg = __CONFIG_JSON__;
  var maxAttempts = 60;
  var iframe = document.getElementById('app');
  var output = document.getElementById('capture-status');
  var attempts = 0;
  var finished = false;

  function finish(value) {
    if (finished) return;
    finished = true;
    var json;
    try {
      json = JSON.stringify(value);
      output.textContent = json;
      document.body.setAttribute('data-capture-status', json);
      document.title = 'CAPTURE_READY';
    } catch (e) {
      var fallback = '{"ok":false,"error":"could not serialize capture status: ' + String(e).replace(/"/g, '\\"') + '"}';
      output.textContent = fallback;
      document.body.setAttribute('data-capture-status', fallback);
      document.title = 'CAPTURE_ERROR';
    }
  }

  function check() {
    if (finished) return;
    attempts++;
    var appStatus = null;
    var doc = null;
    try {
      appStatus = iframe.contentWindow && iframe.contentWindow.__NEWSTART_CAPTURE_STATUS__;
      doc = iframe.contentDocument;
    } catch (err) {
      finish({ ok: false, ready: false, phase: 'wrapper-xorigin', error: 'Cannot reach the app iframe: ' + String(err) });
      return;
    }

    if (appStatus && appStatus.ready) {
      var gate = doc ? doc.getElementById('authGate') : null;
      appStatus.wrapper = {
        attempts: attempts,
        iframeClientWidth: iframe.clientWidth,
        iframeClientHeight: iframe.clientHeight,
        iframeInnerWidth: iframe.contentWindow.innerWidth,
        iframeInnerHeight: iframe.contentWindow.innerHeight,
        gatePresent: !!gate,
        gateHidden: !!(gate && gate.classList && gate.classList.contains('hidden')),
        gateClass: gate ? String(gate.className) : null,
        gateText: gate && gate.innerText ? String(gate.innerText).replace(/\s+/g, ' ').slice(0, 240) : null,
        documentTitle: doc ? doc.title : null
      };
      finish(appStatus);
      return;
    }

    if (appStatus && appStatus.error) {
      finish(appStatus);
      return;
    }

    if (attempts >= maxAttempts) {
      finish({
        ok: false,
        ready: false,
        phase: 'wrapper-timeout',
        attempts: attempts,
        error: 'Timed out waiting for the injected app capture status.'
      });
      return;
    }
    setTimeout(check, 100);
  }

  iframe.addEventListener('load', function () { setTimeout(check, 100); });
  setTimeout(check, 250);
})();
</script>
</body>
</html>
'@
    $wrapperTemplate = $wrapperTemplate.Replace('__WIDTH__', [string]$Width).
        Replace('__HEIGHT__', [string]$Height).
        Replace('__APP_URI__', $appUri).
        Replace('__CONFIG_JSON__', $configJson)
    [System.IO.File]::WriteAllText($wrapperPath, $wrapperTemplate, (New-Object System.Text.UTF8Encoding($false)))

    $wrapperUri = (New-Object System.Uri($wrapperPath)).AbsoluteUri
    $screenshotWidth = [Math]::Max($Width, 500)
    $chromeArgs = @(
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--run-all-compositor-stages-before-draw',
        '--force-device-scale-factor=1',
        "--window-size=$screenshotWidth,$Height",
        (Quote-NativeArgument ('--user-data-dir=' + $profileDir)),
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--allow-file-access-from-files',
        '--virtual-time-budget=8000',
        (Quote-NativeArgument ('--screenshot=' + $chromeShot)),
        '--dump-dom',
        (Quote-NativeArgument $wrapperUri)
    )

    $process = $null
    try {
        $process = Start-Process -FilePath $chromeExe -ArgumentList $chromeArgs -NoNewWindow -PassThru `
            -RedirectStandardOutput $chromeDom -RedirectStandardError $chromeStderrPath
        if (-not $process.WaitForExit(120000)) {
            try { $process.Kill() } catch {}
            try { $process.WaitForExit(5000) | Out-Null } catch {}
            throw 'Chrome headless did not exit within 120 seconds.'
        }
        # Start-Process can report a null ExitCode for a windowless Chrome launch on
        # Windows, so treat null as "unavailable" and rely on the artifacts/status.
        if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) {
            throw "Chrome headless exited with code $($process.ExitCode). $(Get-TextTail $chromeStderrPath)"
        }
    }
    finally {
        if ($null -ne $process) { $process.Dispose() }
    }

    if (-not (Test-Path -LiteralPath $chromeDom -PathType Leaf)) {
        throw 'Chrome did not produce a DOM dump.'
    }
    if (-not (Test-Path -LiteralPath $chromeShot -PathType Leaf) -or (Get-Item -LiteralPath $chromeShot).Length -eq 0) {
        throw 'Chrome did not produce a screenshot.'
    }

    $dom = [System.IO.File]::ReadAllText($chromeDom)
    $statusMatch = [System.Text.RegularExpressions.Regex]::Match($dom, 'data-capture-status="([^"]*)"')
    if (-not $statusMatch.Success) {
        throw "Chrome did not return the injected capture status. $(Get-TextTail $chromeStderrPath)"
    }
    $statusJson = [System.Net.WebUtility]::HtmlDecode($statusMatch.Groups[1].Value)
    try {
        $captureStatus = $statusJson | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw "Could not parse the capture status returned by Chrome: $statusJson"
    }

    if (-not $captureStatus.ok) {
        $why = if ($captureStatus.error) { $captureStatus.error } else { 'capture status reported not-ok' }
        throw "In-page capture failed: $why"
    }
    if (-not $captureStatus.internals) {
        throw 'In-page capture reported that __NEWSTART.__internals was not available.'
    }
    if ($Freeze.IsPresent -and -not $captureStatus.freezeApplied) {
        throw 'Freeze was requested but the in-page freeze hook did not run.'
    }
    if ($Demo.IsPresent -and -not $captureStatus.gateDemoCalled) {
        throw 'Demo was requested but gateDemo() was not called.'
    }
    if ($Demo.IsPresent -and -not $captureStatus.gateHidden) {
        throw 'Demo was requested but the sign-in gate is still visible.'
    }
    if (-not $Demo.IsPresent -and -not $captureStatus.authGatePresent) {
        throw 'Gate was requested but #authGate was not found.'
    }
    if (-not $captureStatus.wrapper -or $null -eq $captureStatus.wrapper.iframeInnerWidth) {
        throw 'The wrapper did not report the iframe viewport checks.'
    }
    if ([int]$captureStatus.wrapper.iframeInnerWidth -ne $Width -or [int]$captureStatus.wrapper.iframeInnerHeight -ne $Height) {
        throw ("Iframe viewport mismatch: requested {0}x{1}, got {2}x{3}." -f $Width, $Height,
            $captureStatus.wrapper.iframeInnerWidth, $captureStatus.wrapper.iframeInnerHeight)
    }

    if (-not $captureStatus.themeApplied) {
        $warning = if ($captureStatus.warning) { $captureStatus.warning } else {
            'setTheme() was not applied; the screenshot may show the light/default theme.'
        }
        $warnings.Add($warning)
    }

    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $sourceImage = $null
    $croppedImage = $null
    $graphics = $null
    try {
        $sourceImage = [System.Drawing.Bitmap]::FromFile($chromeShot)
        if ($sourceImage.Width -lt $Width -or $sourceImage.Height -lt $Height) {
            throw ("Chrome screenshot is smaller than the requested viewport: got {0}x{1}, need at least {2}x{3}." -f
                $sourceImage.Width, $sourceImage.Height, $Width, $Height)
        }
        $croppedImage = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($croppedImage)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.DrawImage($sourceImage,
            [System.Drawing.Rectangle]::new(0, 0, $Width, $Height),
            0, 0, $Width, $Height,
            [System.Drawing.GraphicsUnit]::Pixel)
        $croppedImage.Save($croppedPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        if ($null -ne $graphics) { $graphics.Dispose() }
        if ($null -ne $croppedImage) { $croppedImage.Dispose() }
        if ($null -ne $sourceImage) { $sourceImage.Dispose() }
    }

    $checkImage = [System.Drawing.Bitmap]::FromFile($croppedPath)
    try {
        if ($checkImage.Width -ne $Width -or $checkImage.Height -ne $Height) {
            throw ("Cropped PNG has wrong dimensions: {0}x{1}, expected {2}x{3}." -f
                $checkImage.Width, $checkImage.Height, $Width, $Height)
        }
    }
    finally {
        $checkImage.Dispose()
    }

    Copy-Item -LiteralPath $croppedPath -Destination $outputPath -Force
    if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
        throw "Failed to write screenshot to $outputPath."
    }

    $outputBytes = (Get-Item -LiteralPath $outputPath).Length
    Write-Output ('Captured:   ' + $fileName)
    Write-Output ('Output:     ' + $outputPath)
    Write-Output ('Image:      ' + $Width + 'x' + $Height + ' PNG, ' + $outputBytes.ToString('N0', [System.Globalization.CultureInfo]::InvariantCulture) + ' bytes')
    Write-Output ('App:        ' + $appFull + ' (' + $appBytes.ToString('N0', [System.Globalization.CultureInfo]::InvariantCulture) + ' bytes, SHA256 ' + $appSha256 + ')')
    Write-Output ('Theme:      ' + $Theme + $(if ($captureStatus.themeApplied) { ' (setTheme applied)' } else { ' (setTheme not exposed; warning)' }))
    Write-Output ('Demo:       ' + $(if ($Demo.IsPresent) { 'on (gateDemo called, gate hidden)' } else { 'off (gate visible)' }))
    Write-Output ('Freeze:     ' + $(if ($Freeze.IsPresent) { 'on (animations/transitions frozen, #intro hidden)' } else { 'off' }))
    foreach ($warningText in $warnings) {
        Write-Output ('Warning:    ' + $warningText)
    }
}
catch {
    $failure = $_.Exception.Message
    $tail = Get-TextTail $chromeStderrPath
    if ($tail) {
        $failure = $failure + [Environment]::NewLine + 'Chrome stderr tail:' + [Environment]::NewLine + $tail
    }
    Write-CaptureError $failure
    $exitCode = 1
}
finally {
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        try {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction Stop
        }
        catch {
            Start-Sleep -Milliseconds 250
            try { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction Stop }
            catch { Write-CaptureError "Could not remove temporary folder: $tempRoot ($($_.Exception.Message))" }
        }
    }
}

if ($exitCode -ne 0) {
    exit $exitCode
}
exit 0
