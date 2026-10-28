<#
.SYNOPSIS
  Automated WCAG 2 A/AA audit (axe-core) of one rendered screen.
.DESCRIPTION
  Builds a temporary, CSP-relaxed copy of dist/index.html with axe-core injected, renders the requested
  screen/theme in headless Chrome, runs axe, and writes the violations to verification/axe/<scenario>-<theme>.json.
  Dev-only; nothing is added to the shipped app.
.EXAMPLE
  powershell -File tools/axe-audit.ps1 -Scenario home -Theme dark
#>
[CmdletBinding()]
param(
  [ValidateSet('home','queue','care','serve','me','gate','muster','screen','results','plan','send')]
  [string]$Scenario = 'home',
  [ValidateSet('light','dark')]
  [string]$Theme = 'light'
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$axePath = Join-Path $root 'node_modules\axe-core\axe.min.js'
if (-not (Test-Path $axePath)) { throw 'axe-core is not installed (npm i -D axe-core)' }
$axe = [System.IO.File]::ReadAllText($axePath, [System.Text.Encoding]::UTF8)
$base = [System.IO.File]::ReadAllText((Join-Path $root 'dist\index.html'), [System.Text.Encoding]::UTF8)
$base = [regex]::Replace($base,
  '(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")',
  '$1default-src ''self'' ''unsafe-inline'' data: blob: https:; connect-src https: wss:; img-src ''self'' data: blob: https:$2', 1)

$gate = $Scenario -eq 'gate'
$journey = $Scenario -in @('screen','results','plan','send')
$tab = $Scenario
$scenarioJs = if ($gate) {
@'
var I=window.__NEWSTART.__internals;
var c=I.cloud;c.status='signedout';c.client={};c.view='login';c.ready=false;c.demo=false;c.gateForce=false;
I.setTheme('__THEME__');I.renderGate();
var root=document.getElementById('authGate');
'@
} elseif ($Scenario -eq 'muster') {
@'
var I=window.__NEWSTART.__internals;
I.gateDemo();I.setTheme('__THEME__');I.state.tab='serve';I.state.volTab='muster';I.render();
var root=document;
'@
} elseif ($journey) {
@'
var I=window.__NEWSTART.__internals;
I.gateDemo();I.setTheme('__THEME__');I.state.activeId=I.attendees[0].id;I.state.tab='__TAB__';I.render();
var root=document;
'@
} else {
@'
var I=window.__NEWSTART.__internals;
I.gateDemo();I.setTheme('__THEME__');I.state.tab='__TAB__';I.render();
var root=document;
'@
}
$scenarioJs = $scenarioJs.Replace('__THEME__', $Theme).Replace('__TAB__', $tab)

$audit = @'
<script>
window.addEventListener('load',function(){setTimeout(async function(){
 var out={scenario:'__TAB__',theme:'__THEME__',violations:[],incomplete:[]};
 try{
  var st=document.createElement('style');st.textContent='*{animation:none!important;transition:none!important}#main,#main *{opacity:1!important}';document.head.appendChild(st);
  __SCENARIO__
  var r=await axe.run(root,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});
  function clean(list){return list.map(function(v){return {id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.length,targets:v.nodes.slice(0,6).map(function(n){return n.target.join(' ');})};});}
  out.violations=clean(r.violations);
  out.incomplete=clean(r.incomplete).slice(0,10);
 }catch(e){out.error=String(e&&e.stack||e);}
 var pre=document.createElement('pre');pre.id='axeout';pre.textContent=JSON.stringify(out);document.body.appendChild(pre);
},1000);});
</script>
'@
$audit = $audit.Replace('__SCENARIO__', $scenarioJs).Replace('__TAB__', $tab).Replace('__THEME__', $Theme)

$i = $base.LastIndexOf('</body>')
$page = $base.Substring(0, $i) + '<script>' + $axe + '</script>' + $audit + $base.Substring($i)
$tmp = Join-Path $env:TEMP ("axe_$Scenario`_$Theme.html")
[System.IO.File]::WriteAllText($tmp, $page, (New-Object System.Text.UTF8Encoding($false)))
$udd = Join-Path $env:TEMP ('chrome_udd_' + [guid]::NewGuid().ToString('N'))
$dom = Join-Path $env:TEMP ("axe_$Scenario`_$Theme.dom")
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$chromeErr = Join-Path $env:TEMP ("axe_$Scenario`_$Theme.err")
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $chrome --headless=new --disable-gpu --user-data-dir=$udd --window-size=500,1000 --virtual-time-budget=30000 --dump-dom ("file:///" + ($tmp -replace '\\','/')) 2> $chromeErr | Out-File -Encoding utf8 $dom
$ErrorActionPreference = $prevEap
if (-not (Test-Path $dom)) { throw "Chrome produced no DOM for $Scenario/$Theme" }
$m = [regex]::Match([System.IO.File]::ReadAllText($dom), [regex]::Escape('<pre id="axeout">') + '(?<j>[\s\S]*?)</pre>')
if (-not $m.Success) { throw "Axe produced no output for $Scenario/$Theme" }
$json = [System.Net.WebUtility]::HtmlDecode($m.Groups['j'].Value)
$dir = Join-Path $root 'verification\axe'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$file = Join-Path $dir "$Scenario-$Theme.json"
$json | Set-Content -Encoding utf8 $file
$data = $json | ConvertFrom-Json
if ($data.error) { Write-Output ("ERROR " + $data.error) }
Write-Output ("$Scenario/$Theme violations: " + $data.violations.Count)
$data.violations | ForEach-Object { Write-Output ("  " + $_.impact + "  " + $_.id + " x" + $_.nodes + "  " + ($_.targets -join ' | ')) }
