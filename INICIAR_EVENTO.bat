@echo off
rem =====================================================================
rem  INVASAO.EXE - inicia o jogo em TELA CHEIA TRAVADA (modo quiosque)
rem  para o dia do evento. De dois cliques neste arquivo.
rem
rem  - Sem barra de endereco, sem abas, sem como fechar sem querer.
rem  - Para SAIR do jogo: aperte  Alt + F4
rem  - Painel do organizador: na tela titulo, aperte Ctrl + Shift + O
rem  - O ranking fica guardado num perfil proprio do navegador, separado
rem    do seu navegador do dia a dia (nao se mistura e nao se perde).
rem
rem  O jogo e o arquivo dist\index.html (gerado por "npm run build" ou baixado
rem  pronto na pagina de Releases do GitHub, junto com este atalho).
rem  Alternativa: o app InvasaoExe.exe (Releases) dispensa este atalho.
rem
rem  Teste sem abrir nada:  INICIAR_EVENTO.bat --testar
rem =====================================================================
setlocal

set "JOGO=%~dp0dist\index.html"
set "PERFIL=%LOCALAPPDATA%\InvasaoExe\perfil-evento"

set "NAV="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "NAV=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not defined NAV goto :sem_navegador
if not exist "%JOGO%" goto :sem_jogo
if "%~1"=="--testar" goto :testar

echo Iniciando INVASAO.EXE em tela cheia... para sair, aperte Alt + F4
start "" "%NAV%" --kiosk "%JOGO%" --edge-kiosk-type=fullscreen --user-data-dir="%PERFIL%" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required --disable-features=Translate --overscroll-history-navigation=0 --disable-pinch
exit /b 0

:testar
echo OK
echo NAVEGADOR=%NAV%
echo JOGO=%JOGO%
echo PERFIL=%PERFIL%
exit /b 0

:sem_navegador
echo [ERRO] Microsoft Edge ou Google Chrome nao encontrado neste computador.
echo Instale um deles ou abra o arquivo index.html manualmente.
if not "%~1"=="--testar" pause
exit /b 1

:sem_jogo
echo [ERRO] dist\index.html nao encontrado em: %JOGO%
echo Rode "npm run build" ou baixe o pacote pronto na pagina de Releases.
if not "%~1"=="--testar" pause
exit /b 2
