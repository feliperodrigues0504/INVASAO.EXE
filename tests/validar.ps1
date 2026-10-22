# =====================================================================
#  INVASÃO.EXE — validação completa (rode no PowerShell, na pasta do jogo):
#      powershell -ExecutionPolicy Bypass -File tests\validar.ps1
#  Opções:  -SemTelas   (pula as screenshots)
#           -SemRobo    (pula as partidas completas do robô)
#           -SemResistencia (pula o teste de 40 min simulados)
# =====================================================================
param([switch]$SemTelas, [switch]$SemRobo, [switch]$SemResistencia)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$saida = Join-Path $env:TEMP 'invasao_validacao'
New-Item -ItemType Directory -Force $saida | Out-Null
$url = 'file:///' + ($raiz -replace '\\', '/') + '/index.html'
$falhas = New-Object System.Collections.ArrayList

$nav = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
         "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
         "$env:ProgramFiles\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nav) { throw 'Edge ou Chrome não encontrado.' }

function Titulo($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Falha($t) { [void]$falhas.Add($t); Write-Host "   [FALHOU] $t" -ForegroundColor Red }
function Ok($t) { Write-Host "   [OK] $t" -ForegroundColor Green }

# Abre o jogo no navegador sem janela. Devolve o DOM final (stdout) e o log do console.
function Navegador($nome, $query, $orcamentoMs, [switch]$Screenshot, $tamanho = '960,540', $extra = @()) {
  $perfil = Join-Path $saida "perfil_$nome"
  if (Test-Path $perfil) { Remove-Item -Recurse -Force $perfil }
  $argv = @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--window-size=$tamanho",
            "--virtual-time-budget=$orcamentoMs", "--user-data-dir=$perfil",
            '--enable-logging=stderr', '--v=0') + $extra
  if ($Screenshot) { $argv += "--screenshot=$saida\$nome.png" } else { $argv += '--dump-dom' }
  $argv += "$url$query"
  $p = Start-Process -FilePath $nav -ArgumentList $argv -PassThru -Wait `
       -RedirectStandardOutput "$saida\$nome.dom.txt" -RedirectStandardError "$saida\$nome.log.txt"
  $log = Get-Content "$saida\$nome.log.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
  $erros = $log | Where-Object { $_ -match 'INFO:CONSOLE' -and $_ -notmatch 'chrome-extension|AudioContext' -and $_ -match 'Error|Uncaught|TypeError|ReferenceError|SyntaxError|FALHOU' }
  return @{ dom = (Get-Content "$saida\$nome.dom.txt" -Raw -Encoding UTF8); erros = $erros; log = $log }
}

# ---------------------------------------------------------------- 1. estático
Titulo '1. Verificação estática dos arquivos'
$combinantes = '[' + [char]0x0300 + '-' + [char]0x036F + ']'
foreach ($f in Get-ChildItem $raiz -Recurse -Include *.js, *.css, *.html, *.md, *.ps1) {
  $txt = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  if ($txt -match $combinantes) { Falha "$($f.Name): contém acento 'solto' (caractere combinante invisível)" }
  if ($txt.Contains([string][char]0xFFFD)) { Falha "$($f.Name): contém caractere corrompido (U+FFFD)" }
}
foreach ($f in @(Get-Item "$raiz\index.html") + @(Get-ChildItem "$raiz\js", "$raiz\css" -File)) {
  $txt = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
  if ($txt -match 'https?://') { Falha "$($f.Name): depende de endereço externo ($($Matches[0])...) — o jogo precisa funcionar 100% offline" }
}
$html = [IO.File]::ReadAllText("$raiz\index.html", [Text.Encoding]::UTF8)
foreach ($m in [regex]::Matches($html, '(?:src|href)="((?:js|css)/[^"]+)"')) {
  if (-not (Test-Path (Join-Path $raiz $m.Groups[1].Value))) { Falha "index.html aponta para arquivo inexistente: $($m.Groups[1].Value)" }
}
$css = [IO.File]::ReadAllText("$raiz\css\style.css", [Text.Encoding]::UTF8)
foreach ($m in [regex]::Matches($css, "url\('\.\./([^']+)'\)")) {
  if (-not (Test-Path (Join-Path $raiz $m.Groups[1].Value))) { Falha "style.css aponta para fonte inexistente: $($m.Groups[1].Value)" }
}
if ($falhas.Count -eq 0) { Ok 'arquivos íntegros, referências e fontes presentes, nenhum endereço externo' }

# Atalho do evento: só ASCII, quebras de linha CRLF e acha navegador + jogo (sem abrir nada)
$bat = Join-Path $raiz 'INICIAR_EVENTO.bat'
if (-not (Test-Path $bat)) { Falha 'INICIAR_EVENTO.bat não existe' }
else {
  $bytes = [IO.File]::ReadAllBytes($bat)
  $txtBat = [Text.Encoding]::ASCII.GetString($bytes)
  if (@($bytes | Where-Object { $_ -gt 127 }).Count) { Falha 'INICIAR_EVENTO.bat tem caracteres fora do ASCII (o cmd do Windows quebra acentos)' }
  if (([regex]::Matches($txtBat, "(?<!`r)`n")).Count) { Falha 'INICIAR_EVENTO.bat tem quebras de linha sem CR (o cmd pode errar os goto)' }
  $saidaBat = cmd /c "`"$bat`" --testar"
  if ($LASTEXITCODE -ne 0 -or ($saidaBat -join ' ') -notmatch 'NAVEGADOR=.*(msedge|chrome)\.exe') { Falha "INICIAR_EVENTO.bat --testar falhou: $saidaBat" }
  else { Ok ('atalho do evento: ' + (($saidaBat | Where-Object { $_ -like 'NAVEGADOR=*' }) -replace 'NAVEGADOR=', '')) }
}

# Rede "pendurada" (como Wi-Fi com portal de login): todo endereço vai para um IP que nunca responde.
# Mede o tempo REAL até abrir (o tempo virtual do navegador pausa enquanto espera a rede).
# Controle negativo feito na R3: com o link do Google Fonts de volta, a abertura levou 43 s.
$cron = [Diagnostics.Stopwatch]::StartNew()
$r = Navegador 'rede_pendurada' '' 2500 -extra @('"--host-resolver-rules=MAP * 10.255.255.1"')
$seg = $cron.Elapsed.TotalSeconds
if ($r.dom -match 'id="screen-title" class="screen"' -and $seg -lt 10) { Ok ("abre com a rede pendurada em {0:N1} s reais (limite 10 s)" -f $seg) }
else { Falha ("rede pendurada: o jogo levou {0:N1} s para abrir (limite 10 s) — há alguma dependência externa" -f $seg) }

# ---------------------------------------------------------------- 2. testes
Titulo '2. Bateria de testes automatizados (index.html?teste=1)'
$r = Navegador 'testes' '?teste=1' 600000
$linhas = [regex]::Matches($r.dom, '<div[^>]*>(\[(?:OK|FALHOU)\][^<]*)</div>') | ForEach-Object { [Net.WebUtility]::HtmlDecode($_.Groups[1].Value) }
foreach ($l in $linhas) { if ($l -like '*FALHOU*') { Falha ($l -replace '^\[FALHOU\]\s*', '') } else { Write-Host "   $l" -ForegroundColor DarkGreen } }
$resumo = [regex]::Match($r.dom, 'RESULTADO: [^<]*').Value
if (-not $resumo) { Falha 'a bateria de testes não terminou (sem RESULTADO no DOM)' } else { Write-Host "   $resumo" -ForegroundColor White }
foreach ($e in $r.erros) { Falha "console: $e" }

# Desempenho em tempo REAL: cena pesada com 0 e com 3000 quadros; a diferença / 3000 = custo por quadro.
# (Navegador sem GPU = pior caso; 16,6 ms por quadro = 60 fps.)
$tempos = @{}
foreach ($q in 0, 3000) {
  $cron = [Diagnostics.Stopwatch]::StartNew()
  $r = Navegador "perf_$q" "?teste=perf&n=$q" 60000
  $tempos[$q] = $cron.Elapsed.TotalMilliseconds
  if ($r.dom -notmatch 'PERF-FIM') { Falha "desempenho: a cena pesada com $q quadros não terminou" }
  foreach ($e in $r.erros) { Falha "console (desempenho): $e" }
}
$msQuadro = ($tempos[3000] - $tempos[0]) / 3000
if ($msQuadro -lt 8) { Ok ("desempenho: {0:N2} ms por quadro na cena pesada, sem GPU (limite 8 ms; 60 fps = 16,6 ms)" -f $msQuadro) }
else { Falha ("desempenho: {0:N2} ms por quadro na cena pesada (limite 8 ms)" -f $msQuadro) }

# ---------------------------------------------------------------- 3. robô
if (-not $SemRobo) {
  Titulo '3. Partidas completas do robô (título → nick → 9 andares → fim)'
  foreach ($v in @(@{ms=110; nome='rapido'}, @{ms=250; nome='medio'}, @{ms=400; nome='lento'}, @{ms=850; nome='muito_lento'},
                   @{ms=110; nome='MODO_RAPIDO'; q='&modo=2'}, @{ms=400; nome='MODO_RAP_lento'; q='&modo=2'})) {
    $r = Navegador "robo_$($v.nome)" "?tick=1&bot=$($v.ms)&parar=fim$($v.q)" 900000
    $andar = [regex]::Match($r.dom, 'ANDAR</span><b>([^<]+)</b>').Groups[1].Value
    $ppm = [regex]::Match($r.dom, 'VELOCIDADE</span><b>([^<]+)</b>').Groups[1].Value
    if (-not $andar) { Falha "robô $($v.nome): não chegou à tela de fim" }
    else { Ok ("robô {0,-11} {1,8}  ->  andar {2}" -f $v.nome, $ppm, $andar) }
    foreach ($e in $r.erros) { Falha "console (robô $($v.nome)): $e" }
  }
}

# ---------------------------------------------------------------- 4. telas
if (-not $SemTelas) {
  Titulo '4. Screenshots das telas'
  $telas = @(
    @{n='01_titulo'; q='?tick=1'; t=2500},
    @{n='02_nick'; q='?tick=1&bot=1&parar=nick'; t=3000},
    @{n='03_tutorial'; q='?tick=1&bot=1&parar=tutorial'; t=6000},
    @{n='04_batalha'; q='?tick=1&andar=7&bot=1'; t=12000},
    @{n='05_chefao'; q='?tick=1&andar=1&chefe=1&bot=200'; t=13000},
    @{n='06_concluido'; q='?tick=1&andar=1&chefe=1&bot=40&parar=concluido'; t=25000},
    @{n='07_cartas'; q='?tick=1&andar=2&chefe=1&bot=40&parar=upgrade'; t=30000},
    @{n='08_loja'; q='?tick=1&andar=3&chefe=1&bot=40&parar=loja'; t=40000},
    @{n='09_fim'; q='?tick=1&bot=400&parar=fim'; t=600000},
    @{n='10_ranking'; q='?tick=1&bot=400&parar=ranking'; t=600000},
    @{n='12_modo'; q='?tick=1&bot=1&parar=modo'; t=5000},
    @{n='13_relatorio'; q='?tick=1&bot=250&parar=relatorio'; t=900000},
    @{n='14_painel'; q='?tick=1&bot=1&parar=painel'; t=5000},
    @{n='15_rapido_ranking'; q='?tick=1&bot=250&modo=2&parar=ranking'; t=600000}
  )
  foreach ($s in $telas) {
    $r = Navegador $s.n $s.q $s.t -Screenshot
    foreach ($e in $r.erros) { Falha "console ($($s.n)): $e" }
  }
  # outras resoluções: notebook comum, monitor 4:3 e Full HD
  foreach ($res in @('1366,768', '1280,1024', '1920,1080')) {
    $r = Navegador ("11_res_" + ($res -replace ',', 'x')) '?tick=1&andar=8&bot=1' 12000 -Screenshot -tamanho $res
    foreach ($e in $r.erros) { Falha "console (resolução $res): $e" }
  }
  Ok "screenshots salvas em $saida"
}

# ---------------------------------------------------------------- 5. resistência
if (-not $SemResistencia) {
  Titulo '5. Resistência: robô jogando sem parar por 40 min simulados (modo quiosque)'
  $r = Navegador 'resistencia' '?tick=1&bot=400' 2400000
  $fins = @($r.log | Where-Object { $_ -match '\[INVASAO\] fim de jogo' })
  foreach ($e in $r.erros) { Falha "console (resistência): $e" }
  if ($fins.Count -lt 4) { Falha "resistência: só $($fins.Count) partidas terminaram (esperado 4 ou mais: o ciclo fim → ranking → título → nova partida pode ter travado)" }
  else { Ok "$($fins.Count) partidas seguidas, ciclo fim → ranking → título → nova partida sem travar" }
}

# ---------------------------------------------------------------- resumo
Titulo 'RESUMO'
if ($falhas.Count -eq 0) { Write-Host '   VALIDAÇÃO APROVADA — nenhuma falha encontrada.' -ForegroundColor Green }
else { Write-Host "   VALIDAÇÃO REPROVADA — $($falhas.Count) falha(s):" -ForegroundColor Red; $falhas | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
Write-Host "   Arquivos de saída: $saida"
exit $falhas.Count
