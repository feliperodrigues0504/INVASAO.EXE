# =====================================================================
#  INVASÃO.EXE — teste de mutação
#  Injeta bugs conhecidos (tests\mutacoes.json) em cópias do jogo e confere se a
#  bateria de testes REPROVA cada um. Mutante que sobrevive = ponto cego dos testes.
#      powershell -ExecutionPolicy Bypass -File tests\mutacao.ps1
#      (só alguns:  ... tests\mutacao.ps1 -Somente M15,M09)
# =====================================================================
param([int]$Paralelo = 4, [string[]]$Somente)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$base = Join-Path $env:TEMP 'invasao_mutacao'
if (Test-Path $base) { Remove-Item -Recurse -Force $base }
New-Item -ItemType Directory -Force $base | Out-Null

$nav = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
         "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
         "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1

$mutacoes = Get-Content (Join-Path $PSScriptRoot 'mutacoes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Somente) { $Somente = @($Somente -split ',' | ForEach-Object { $_.Trim() }); $mutacoes = @($mutacoes | Where-Object { $Somente -contains $_.id }) }
if (-not $mutacoes.Count) { Write-Host '[ERRO] nenhum mutante selecionado — nada foi testado.' -ForegroundColor Red; exit 99 }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$jobs = @()
$naoAplicadas = @()

foreach ($m in $mutacoes) {
  $dir = Join-Path $base $m.id
  Copy-Item -Recurse $raiz $dir -Exclude 'tests'
  Copy-Item -Recurse (Join-Path $raiz 'tests') (Join-Path $dir 'tests')
  $arq = Join-Path $dir ($m.arquivo -replace '/', '\')
  $txt = [IO.File]::ReadAllText($arq, [Text.Encoding]::UTF8)
  $ok = $true
  foreach ($t in $m.trocas) {
    if (-not $txt.Contains($t[0])) { $ok = $false; break }
    $txt = $txt.Replace($t[0], $t[1])
  }
  if (-not $ok) { $naoAplicadas += $m.id; continue }
  [IO.File]::WriteAllText($arq, $txt, $utf8)
  $url = 'file:///' + ($dir -replace '\\', '/') + '/index.html?teste=1'
  $jobs += @{ m = $m; dir = $dir; url = $url }
}

$resultados = @()
for ($i = 0; $i -lt $jobs.Count; $i += $Paralelo) {
  $lote = $jobs[$i..([Math]::Min($i + $Paralelo, $jobs.Count) - 1)]
  $procs = foreach ($j in $lote) {
    Start-Process -FilePath $nav -PassThru -RedirectStandardOutput "$($j.dir)\dom.txt" -RedirectStandardError "$($j.dir)\err.txt" `
      -ArgumentList '--headless=new', '--disable-gpu', '--virtual-time-budget=900000', "--user-data-dir=$($j.dir)\perfil", '--dump-dom', $j.url
  }
  $procs | Wait-Process -Timeout 900
  foreach ($j in $lote) {
    $dom = Get-Content "$($j.dir)\dom.txt" -Raw -Encoding UTF8
    $resumo = [regex]::Match([string]$dom, 'RESULTADO: [^<]*').Value
    $falhas = [regex]::Matches([string]$dom, '\[FALHOU\] ([^<]+)') | ForEach-Object { $v = [Net.WebUtility]::HtmlDecode($_.Groups[1].Value.Trim()); if ($v.Length -gt 140) { $v.Substring(0, 140) + '...' } else { $v } }
    $morto = $falhas.Count -gt 0 -or -not $resumo
    $resultados += [pscustomobject]@{ id = $j.m.id; morto = $morto; desc = $j.m.desc; pegoPor = ($falhas | Select-Object -First 1); resumo = $resumo }
  }
}

Write-Host ''
foreach ($r in $resultados) {
  if ($r.morto) { Write-Host ("[MORTO]      {0} {1}" -f $r.id, $r.desc) -ForegroundColor Green; Write-Host "             motivo: $($r.pegoPor)" -ForegroundColor DarkGray }
  else { Write-Host ("[SOBREVIVEU] {0} {1}" -f $r.id, $r.desc) -ForegroundColor Red }
}
foreach ($id in $naoAplicadas) { Write-Host "[NÃO APLICADA] $id — o trecho do código mudou; atualize tests\mutacoes.json" -ForegroundColor Yellow }
$mortos = @($resultados | Where-Object { $_.morto }).Count
Write-Host ''
Write-Host "PLACAR: $mortos de $($resultados.Count) mutantes mortos ($($naoAplicadas.Count) não aplicados)"
exit (($resultados.Count - $mortos) + $naoAplicadas.Count)
