// =====================================================================
//  Interface: fluxo de telas, HUD, cartas, loja, relatório, ranking,
//  conquistas e painel do organizador.
// =====================================================================

const UI = (() => {
  const $ = id => document.getElementById(id);
  const TELAS = ['screen-title', 'screen-nick', 'screen-mode', 'screen-tutorial', 'screen-clear',
    'screen-upgrade', 'screen-shop', 'screen-pause', 'screen-end', 'screen-report', 'screen-ranking',
    'screen-pin', 'screen-panel'];

  let estado = 'carregando';  // só vira 'titulo' depois que as fontes carregam
  let travaAte = 0;          // evita que um ENTER "vaze" de uma tela para outra
  let ultimaAtividade = performance.now();
  let timers = [];
  let cartas = [];
  let ultimoResultado = null;
  let nickPendente = '';
  let confirmarApagarAte = 0;
  let cachePrompt = '';
  let cacheHud = {};

  const agora = () => performance.now();
  const travar = (ms = 600) => { travaAte = agora() + ms; };
  const travado = () => agora() < travaAte;
  const esperar = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const limparTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, t) => String(n).padStart(t, '0');
  const rotuloAndar = () => `${Battle.run.modo === 'rapido' ? 'RÁPIDO · ' : ''}ANDAR ${Battle.posicao()}/${Battle.totalAndares()}`;

  function mostrar(id) {
    TELAS.forEach(t => $(t).classList.toggle('hidden', t !== id));
  }

  function setEstado(novo, tela) {
    estado = novo;
    mostrar(tela);
    travar();
    focar();
  }

  function focar() {
    if (estado === 'nick') $('nick-input').focus();
    else if (estado === 'pin') $('pin-input').focus();
    else $('type-input').focus({ preventScroll: true });
  }

  // ================= TÍTULO =================
  function irTitulo() {
    limparTimers();
    limparConquistas();
    Sound.pararMusica();
    $('hud').classList.add('hidden');
    $('banner').classList.add('hidden');
    $('title-event').textContent = CONFIG.evento;
    $('title-course').textContent = CONFIG.curso;
    for (const modo of ['normal', 'rapido']) {
      const lista = Ranking.top(3, modo);
      $(`title-rank-${modo}`).innerHTML = lista.length
        ? lista.map(r => `<li><span>${esc(r.nick)}</span><span>${pad(r.pontos, 6)}</span></li>`).join('')
        : '<li class="vazio">seja o primeiro!</li>';
    }
    setEstado('titulo', 'screen-title');
  }

  // ================= NICK =================
  function irNick() {
    Sound.init();
    Sound.sfx.boot();
    setEstado('nick', 'screen-nick');
    $('nick-input').value = '';
    $('nick-error').textContent = '';
    const linhas = [
      '> conectando ao servidor da empresa...',
      '> conexão estabelecida.',
      '> ALERTA: o prédio foi invadido por vírus!',
      '> precisamos de alguém para limpar os andares.',
      '> identifique-se, hacker:',
    ];
    const box = $('nick-lines');
    box.innerHTML = '';
    linhas.forEach((l, i) => esperar(i * 350, () => {
      const d = document.createElement('div');
      d.textContent = l;
      if (l.includes('ALERTA')) d.className = 'red';
      box.appendChild(d);
      Sound.sfx.tecla();
    }));
  }

  function confirmarNick() {
    const nick = Nick.limpar($('nick-input').value);
    const erro = Nick.validar(nick);
    if (erro) {
      $('nick-error').textContent = '> ' + erro;
      Sound.sfx.negado();
      return;
    }
    Sound.sfx.selecao();
    nickPendente = nick;
    // o organizador pode travar um modo (ex.: só o rápido quando a fila está grande)
    if (CONFIG.modoFixo) comecar(CONFIG.modoFixo);
    else irModo();
  }

  // ================= MODO DE JOGO =================
  function irModo() {
    for (const m of ['normal', 'rapido']) $(`modo-desc-${m}`).textContent = MODOS[m].desc;
    setEstado('modo', 'screen-mode');
  }

  function comecar(modo) {
    Battle.novaPartida(nickPendente, modo);
    setEstado('tutorial', 'screen-tutorial');
  }

  function escolherModo(modo) {
    if (estado !== 'modo' || travado()) return;
    Sound.sfx.selecao();
    comecar(modo);
  }

  // ================= ANDAR =================
  function iniciarAndar() {
    limparTimers();
    Battle.iniciarAndar();
    const A = ANDARES[Battle.run.andar];
    mostrar(null);
    $('hud').classList.remove('hidden');
    $('log').innerHTML = '';
    cacheHud = {};
    estado = 'banner';
    focar();
    banner(rotuloAndar(), A.nome, A.desc, A.dica, 'normal');
    Sound.sfx.levelUp();
    esperar(3600, () => {
      $('banner').classList.add('hidden');
      estado = 'batalha';
      $('type-input').value = '';
      Sound.tocarMusica('normal');
      logLinha(`> andar ${Battle.posicao()}: ${A.nome.toLowerCase()}`, '#39ff14');
    });
  }

  function banner(topo, titulo, sub, dica, tipo) {
    const el = $('banner');
    el.className = tipo === 'chefe' ? 'chefe' : '';
    $('banner-top').textContent = topo;
    $('banner-title').textContent = titulo;
    $('banner-title').setAttribute('data-text', titulo);
    $('banner-sub').textContent = sub || '';
    $('banner-tip').textContent = dica || '';
    // reinicia a animação
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  function aoAlertaChefe(chefe) {
    banner('⚠ AMEAÇA DETECTADA ⚠', chefe.nome, `"${chefe.falas.intro}"`, '', 'chefe');
    esperar(3200, () => $('banner').classList.add('hidden'));
  }

  // ================= CONQUISTAS (aviso na tela) =================
  const filaConquistas = [];
  let timerConquista = null;
  function aoConquista(def) {
    filaConquistas.push(def);
    // espera o instante atual terminar: conquistas que chegam juntas (ex.: chefão) formam uma rajada
    if (!timerConquista) timerConquista = setTimeout(proximaConquista, 0);
  }
  function proximaConquista() {
    const def = filaConquistas.shift();
    const el = $('toast');
    if (!def) { timerConquista = null; el.classList.add('hidden'); return; }
    el.innerHTML = `<b>${esc(def.icone)}</b><div><small>★ CONQUISTA DESBLOQUEADA · +${CONFIG.bonusConquista}</small>${esc(def.nome)}<i>${esc(def.desc)}</i></div>`;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    Sound.sfx.compra();  // um som por aviso exibido (antes: todos de uma vez numa rajada)
    // várias de uma vez (ex.: chefão perfeito) passam mais rápido para não cobrir o jogo
    timerConquista = setTimeout(proximaConquista, filaConquistas.length ? 1200 : 2600);
  }
  // novo visitante: avisos da partida anterior não podem aparecer para ele
  function limparConquistas() {
    filaConquistas.length = 0;
    clearTimeout(timerConquista);
    timerConquista = null;
    $('toast').classList.add('hidden');
  }

  // ================= ANDAR CONCLUÍDO =================
  function aoAndarConcluido() {
    const run = Battle.run;
    Battle.registrarAndar(true);
    if (Battle.ehUltimo()) { fimDeJogo(true); return; }
    const A = ANDARES[run.andar];
    const b = Battle.estado;
    const p = run.p;
    const cura = Math.round(p.maxHp * CURA_ENTRE_ANDARES);
    const antes = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + cura);
    const total = b.stats.acertos + b.stats.erros;
    $('hud').classList.add('hidden');
    $('clear-title').textContent = `// ANDAR ${Battle.posicao()} LIBERADO: ${A.nome}`;
    $('clear-stats').innerHTML = `
      <div><span>chefão derrotado</span><b>${esc(A.chefe.nome)}</b></div>
      <div><span>inimigos removidos</span><b>${b.stats.abates}</b></div>
      <div><span>precisão no andar</span><b>${total ? Math.round(b.stats.acertos / total * 100) : 100}%</b></div>
      <div><span>pontos no andar</span><b>+${run.pontos - b.stats.inicioPontos}</b></div>
      <div><span>manutenção do sistema</span><b class="green">${p.hp > antes ? `+${p.hp - antes} integridade` : 'integridade máxima'}</b></div>`;
    $('clear-fact').textContent = A.fato;
    Sound.pararMusica();
    Sound.sfx.vitoria();
    setEstado('concluido', 'screen-clear');
    travar(900);
  }

  // ================= UPGRADES =================
  function irUpgrade() {
    cartas = Battle.sortearCartas(3);
    const run = Battle.run;
    $('cards').innerHTML = cartas.map((u, i) => {
      const r = RARIDADES[u.raridade];
      const nivel = run.upgrades[u.id] || 0;
      return `<div class="card" data-i="${i}" style="--cor:${r.cor}">
        <div class="card-key">[${i + 1}]</div>
        <div class="card-rar">${r.nome}</div>
        <div class="card-icon">${esc(u.icone)}</div>
        <div class="card-name">${esc(u.nome)}</div>
        <div class="card-desc">${esc(u.desc)}</div>
        <div class="card-lvl">${u.max > 1 ? `nível ${nivel} → ${nivel + 1}` : 'único'}</div>
      </div>`;
    }).join('');
    document.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => escolherCarta(+c.dataset.i)));
    Sound.sfx.levelUp();
    setEstado('upgrade', 'screen-upgrade');
  }

  function escolherCarta(i) {
    if (estado !== 'upgrade' || travado() || !cartas[i]) return;
    Battle.aplicarUpgrade(cartas[i]);
    Sound.sfx.compra();
    const el = document.querySelectorAll('.card')[i];
    el.classList.add('escolhida');
    estado = 'escolhendo';
    esperar(500, irLoja);
  }

  // ================= LOJA =================
  function irLoja() {
    $('shop-msg').textContent = '';
    renderLoja();
    setEstado('loja', 'screen-shop');
  }

  function renderLoja() {
    const run = Battle.run;
    $('shop-cred').textContent = `CRÉDITOS: ${run.p.creditos} ₿`;
    $('shop-list').innerHTML = ITENS.map((it, i) => {
      const qtd = run.inventario[it.id];
      const caro = run.p.creditos < it.preco;
      return `<div class="shop-item ${caro || qtd >= ITEM_MAX ? 'off' : ''}" data-i="${i}">
        <span class="shop-key">[${i + 1}]</span>
        <span class="shop-icon">${esc(it.icone)}</span>
        <span class="shop-name">${esc(it.nome)}<small>${esc(it.desc)}</small></span>
        <span class="shop-qtd">${qtd}/${ITEM_MAX}</span>
        <span class="shop-price">${it.preco} ₿</span>
      </div>`;
    }).join('');
    document.querySelectorAll('.shop-item').forEach(el => el.addEventListener('click', () => comprar(+el.dataset.i)));
  }

  function comprar(i) {
    if (estado !== 'loja') return;
    const r = Battle.comprar(i);
    const msg = $('shop-msg');
    if (r === 'ok') { Sound.sfx.compra(); msg.textContent = `> ${ITENS[i].nome} adicionado ao inventário.`; msg.className = 'green'; }
    else if (r === 'cheio') { Sound.sfx.negado(); msg.textContent = '> inventário cheio para este item.'; msg.className = 'red'; }
    else if (r === 'sem credito') { Sound.sfx.negado(); msg.textContent = '> créditos insuficientes.'; msg.className = 'red'; }
    renderLoja();
  }

  function proximoAndar() {
    Battle.avancar();
    iniciarAndar();
  }

  // ================= PAUSA =================
  function pausar() {
    const b = Battle.estado;
    // não pausa durante a explosão do chefão nem durante a derrota
    if (estado !== 'batalha' || !b || b.etapa === 'vitoria' || b.etapa === 'morte') return;
    $('pause-sound').textContent = `[2] Som: ${Sound.ligado ? 'ON' : 'OFF'}`;
    Sound.pararMusica();
    setEstado('pausa', 'screen-pause');
  }

  function continuar() {
    mostrar(null);
    estado = 'batalha';
    travar(200);
    focar();
    const b = Battle.estado;
    if (b && (b.etapa === 'ondas' || b.etapa === 'chefe')) Sound.tocarMusica(b.chefe ? 'chefe' : 'normal');
  }

  function desistir() {
    mostrar(null);
    if (Battle.estado) Battle.estado.etapa = 'morte';
    fimDeJogo(false);
  }

  // ================= FIM DE JOGO =================
  function aoGameOver() { fimDeJogo(false); }

  function fimDeJogo(venceu) {
    limparTimers();
    Sound.pararMusica();
    const run = Battle.run;
    Battle.registrarAndar(venceu);
    if (venceu) Battle.conquista('zerou');
    run.venceu = venceu;
    if (venceu) run.pontos += 5000 + Math.round(run.p.hp * 20);
    const s = run.stats;
    const minutos = Math.max(s.tempo / 60, 1 / 60);
    const ppm = Math.round(s.acertos / 5 / minutos);
    const total = s.acertos + s.erros;
    const precisao = total ? Math.round(s.acertos / total * 100) : 0;
    const andar = Battle.posicao();
    const totalAndares = Battle.totalAndares();
    const A = ANDARES[run.andar];

    // partidas de teste (?andar=N) não entram no ranking
    if (run.debug) {
      const doModo = Ranking.carregar().filter(r => r.modo === run.modo);
      ultimoResultado = { posicao: doModo.filter(r => r.pontos > run.pontos).length + 1, total: doModo.length, id: null, modo: run.modo };
    } else {
      ultimoResultado = Ranking.adicionar({
        nick: run.nick, pontos: run.pontos, andar, total: totalAndares, venceu, ppm, precisao,
        modo: run.modo, conquistas: run.conquistas.slice(), data: new Date().toISOString(),
      });
    }

    // registro no console (F12) para quem cuida do estande
    console.info(`[INVASAO] fim de jogo: ${run.nick} | ${run.modo} | ${run.pontos} pts | andar ${andar}/${totalAndares} | ${ppm} ppm | ${precisao}% | ${run.conquistas.length} conquistas${venceu ? ' | VENCEU' : ''}`);

    $('hud').classList.add('hidden');
    $('banner').classList.add('hidden');
    const titulo = $('end-title');
    titulo.textContent = venceu ? 'SISTEMA RESTAURADO!' : 'CONEXÃO ENCERRADA';
    titulo.className = 'end-title ' + (venceu ? 'green' : 'red');
    $('end-sub').innerHTML = venceu
      ? `Você limpou ${run.modo === 'rapido' ? 'os 3 andares do modo rápido' : `os ${totalAndares} andares`}! Você tem o perfil de quem faz <b>${esc(CONFIG.curso)}</b>.`
      : `${esc(run.nick)}, você chegou ao andar ${andar}: <b>${esc(A.nome)}</b>.`;
    $('end-stats').innerHTML = `
      <div><span>PONTUAÇÃO</span><b>${run.pontos}</b></div>
      <div><span>ANDAR</span><b>${venceu ? `${totalAndares}/${totalAndares} ✓` : `${andar}/${totalAndares}`}</b></div>
      <div><span>VELOCIDADE</span><b>${ppm} ppm</b></div>
      <div><span>PRECISÃO</span><b>${precisao}%</b></div>
      <div><span>MAIOR COMBO</span><b>x${s.maiorCombo}</b></div>
      <div><span>CONQUISTAS</span><b>${run.conquistas.length}/${CONQUISTAS.length}</b></div>`;
    const pos = ultimoResultado.posicao;
    const nomeModo = run.modo === 'rapido' ? ' (MODO RÁPIDO)' : '';
    $('end-rank').innerHTML = (pos <= 3 ? `<span class="gold">🏆 ${pos}º LUGAR NO RANKING${nomeModo}!</span>` : `posição no ranking${nomeModo.toLowerCase()}: <b>${pos}º</b> de ${ultimoResultado.total}`)
      + `<div class="cta">Gostou? Conheça o curso de ${esc(CONFIG.curso)}!</div>`;
    if (venceu) Sound.sfx.vitoria();
    setEstado('fim', 'screen-end');
    travar(1500);
    esperar(CONFIG.voltarTituloSeg * 1000, irRelatorio);
  }

  // ================= RELATÓRIO DE DESEMPENHO =================
  function analise(run, teclas) {
    const h = run.historico;
    const partes = [];
    if (!teclas.length) partes.push('nenhuma letra errada. Precisão de profissional!');
    else {
      const [pior, n] = teclas[0];
      if (pior === ' ') partes.push(`o espaço entre as palavras foi o que mais te derrubou (${n}x).`);
      else if (Battle.temAcento(pior)) partes.push(`seu maior obstáculo foram os acentos: "${pior}" (${n}x).`);
      else partes.push(`a letra "${pior}" foi a que mais te derrubou (${n}x).`);
    }
    if (h.length >= 2 && h[0].ppm > 0) {
      const ini = h[0].ppm, fim = h[h.length - 1].ppm;
      if (fim > ini) partes.push(`Sua velocidade subiu de ${ini} para ${fim} ppm durante a partida.`);
    }
    return `> análise dos seus dados: ${partes.join(' ')} Transformar dados em decisões é o dia a dia de quem faz SI!`;
  }

  function irRelatorio() {
    limparTimers();
    const run = Battle.run, s = run.stats;
    const h = run.historico;
    const maxPpm = Math.max(30, ...h.map(x => x.ppm));
    $('rel-titulo').innerHTML = `// RELATÓRIO DE DESEMPENHO <span class="rel-nick">@${esc(run.nick)}</span>`;
    $('rel-barras').innerHTML = h.map((x, i) => `<div class="rel-linha${x.concluido ? '' : ' parcial'}">
        <span class="rel-nome">${i + 1}. ${esc(x.nome)}</span>
        <span class="rel-barra"><i style="width:${Math.round(x.ppm / maxPpm * 100)}%"></i></span>
        <span class="rel-val">${x.ppm} ppm · ${x.precisao}%</span></div>`).join('')
      || '<div class="rel-vazio">nenhum andar registrado</div>';
    const teclas = Object.entries(s.errosTecla).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('rel-teclas').innerHTML = teclas.length
      ? teclas.map(([ch, n]) => `<span class="chip">${ch === ' ' ? '␣' : esc(ch)}<small>${n}x</small></span>`).join('')
      : '<span class="rel-vazio">nenhuma! 👏</span>';
    const totAc = s.acentoOk + s.acentoErro;
    const seg = Math.round(s.tempo);
    $('rel-resumo').innerHTML = `
      <div><span>precisão nos acentos</span><b>${totAc ? Math.round(s.acentoOk / totAc * 100) + '%' : '—'}</b></div>
      <div><span>palavras e frases</span><b>${s.palavras}</b></div>
      <div><span>tempo de batalha</span><b>${Math.floor(seg / 60)}:${pad(seg % 60, 2)}</b></div>`;
    $('rel-conq-n').textContent = `${run.conquistas.length}/${CONQUISTAS.length}`;
    $('rel-conquistas').innerHTML = CONQUISTAS.map(c => `<div class="conq ${run.conquistas.includes(c.id) ? 'on' : ''}" title="${esc(c.desc)}">
        <b>${esc(c.icone)}</b><span>${esc(c.nome)}</span></div>`).join('');
    $('rel-insight').textContent = analise(run, teclas);
    setEstado('relatorio', 'screen-report');
    esperar(CONFIG.voltarTituloSeg * 1000, irRanking);
  }

  // ================= RANKING =================
  function irRanking() {
    limparTimers();
    const modo = (ultimoResultado && ultimoResultado.modo) || 'normal';
    const lista = Ranking.carregar().filter(r => r.modo === modo);
    const n = CONFIG.rankingTela;
    const meuId = ultimoResultado && ultimoResultado.id;
    $('rank-title').textContent = `// RANKING — MODO ${MODOS[modo].nome}`;
    const linha = (r, i) => `<tr class="${r.id === meuId ? 'eu' : ''} ${i < 3 ? 'top' + (i + 1) : ''}">
        <td>${i + 1}º</td><td>${esc(r.nick)}</td><td>${r.pontos}</td>
        <td>${r.venceu ? `${r.total}/${r.total} ✓` : `${r.andar}/${r.total}`}</td><td>${r.ppm}</td><td>${r.precisao}%</td><td>${r.conquistas.length}</td></tr>`;
    let html = '<tr><th>#</th><th>NICK</th><th>PONTOS</th><th>ANDAR</th><th>PPM</th><th>PREC.</th><th>★</th></tr>';
    html += lista.slice(0, n).map(linha).join('');
    const meu = lista.findIndex(r => r.id === meuId);
    if (meu >= n) html += `<tr class="sep"><td colspan="7">· · ·</td></tr>` + linha(lista[meu], meu);
    if (!lista.length) html += '<tr><td colspan="7">nenhum registro ainda</td></tr>';
    $('rank-table').innerHTML = html;
    setEstado('ranking', 'screen-ranking');
    esperar(CONFIG.voltarTituloSeg * 1000, irTitulo);
  }

  // ================= PAINEL DO ORGANIZADOR =================
  // Abre com Ctrl+Shift+O na tela título e pede o PIN (CONFIG.pinOrganizador).
  function abrirPainel() {
    $('pin-input').value = '';
    $('pin-error').textContent = '';
    setEstado('pin', 'screen-pin');
  }

  function confirmarPin() {
    if ($('pin-input').value === String(CONFIG.pinOrganizador)) { Sound.sfx.selecao(); irPainel(); return; }
    $('pin-error').textContent = '> PIN incorreto.';
    $('pin-input').value = '';
    Sound.sfx.negado();
  }

  function irPainel() {
    confirmarApagarAte = 0;
    $('painel-msg').textContent = '';
    renderPainel();
    setEstado('painel', 'screen-panel');
  }

  function salvarAjustes() {
    Ajustes.salvar({ modoFixo: CONFIG.modoFixo, som: Sound.ligado, volume: Sound.volume });
  }

  function renderPainel() {
    const lista = Ranking.carregar();
    const media = arr => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
    // o ranking já vem ordenado: o primeiro de cada modo é o vencedor daquele modo
    const melhor = m => { const r = lista.find(x => x.modo === m); return r ? `${esc(r.nick)} · ${r.pontos}` : '—'; };
    const contagem = {};
    lista.forEach(r => r.conquistas.forEach(c => { contagem[c] = (contagem[c] || 0) + 1; }));
    const populares = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, q]) => `${(CONQUISTAS.find(c => c.id === id) || { nome: id }).nome} (${q})`).join(', ') || '—';
    const qtdModo = m => lista.filter(r => r.modo === m).length;
    $('painel-stats').innerHTML = `
      <div><span>partidas jogadas</span><b>${lista.length} (normal ${qtdModo('normal')} · rápido ${qtdModo('rapido')})</b></div>
      <div><span>vitórias</span><b>${lista.filter(r => r.venceu).length}</b></div>
      <div><span>velocidade média</span><b>${media(lista.map(r => r.ppm))} ppm</b></div>
      <div><span>precisão média</span><b>${media(lista.map(r => r.precisao))}%</b></div>
      <div><span>líder do normal</span><b>${melhor('normal')}</b></div>
      <div><span>líder do rápido</span><b>${melhor('rapido')}</b></div>
      <div><span>conquistas mais comuns</span><b>${esc(populares)}</b></div>`;
    const nomeModoFixo = { null: 'O JOGADOR ESCOLHE', normal: 'SEMPRE NORMAL', rapido: 'SEMPRE RÁPIDO' }[CONFIG.modoFixo];
    $('painel-menu').innerHTML = `
      <div>[1] Modo de jogo: <b>${nomeModoFixo}</b></div>
      <div>[2] Som: <b>${Sound.ligado ? 'LIGADO' : 'DESLIGADO'}</b></div>
      <div>[3] Volume: <b>${Math.round(Sound.volume * 100)}%</b></div>
      <div>[4] Exportar ranking (planilha CSV para o Excel)</div>
      <div>[5] <span class="red">Apagar o ranking</span> (aperte 2 vezes)</div>
      <div>[ESC] Voltar ao jogo</div>`;
  }

  // CSV com ";" (Excel em português) e BOM para os acentos abrirem certos
  function gerarCsv() {
    const campo = v => {
      const s = String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [['posicao', 'nick', 'pontos', 'modo', 'andar', 'total_andares', 'venceu', 'ppm', 'precisao', 'conquistas', 'data']];
    Ranking.carregar().forEach((r, i) => linhas.push([i + 1, r.nick, r.pontos, r.modo, r.andar, r.total,
      r.venceu ? 'sim' : 'nao', r.ppm, r.precisao, r.conquistas.length, r.data]));
    return String.fromCharCode(0xFEFF) + linhas.map(l => l.map(campo).join(';')).join(String.fromCharCode(13, 10));
  }

  function exportarCsv() {
    const blob = new Blob([gerarCsv()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ranking-invasao-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return a.download;
  }

  function teclaPainel(k) {
    const msg = $('painel-msg');
    msg.className = 'green';
    if (k === '1') {
      const ordem = [null, 'normal', 'rapido'];
      CONFIG.modoFixo = ordem[(ordem.indexOf(CONFIG.modoFixo) + 1) % ordem.length];
      salvarAjustes();
      msg.textContent = '> modo de jogo alterado.';
    } else if (k === '2') {
      Sound.alternar();
      salvarAjustes();
      msg.textContent = `> som ${Sound.ligado ? 'ligado' : 'desligado'}.`;
    } else if (k === '3') {
      const vols = [0.25, 0.5, 0.75, 1];
      Sound.definirVolume(vols[(vols.indexOf(Sound.volume) + 1) % vols.length]);
      salvarAjustes();
      Sound.sfx.selecao();
      msg.textContent = `> volume em ${Math.round(Sound.volume * 100)}%.`;
    } else if (k === '4') {
      const nome = exportarCsv();
      msg.textContent = `> ranking exportado: ${nome} (pasta Downloads).`;
    } else if (k === '5') {
      if (agora() < confirmarApagarAte) {
        Ranking.limpar();
        confirmarApagarAte = 0;
        msg.textContent = '> ranking apagado.';
      } else {
        confirmarApagarAte = agora() + 5000;
        msg.className = 'red';
        msg.textContent = '> tem certeza? aperte 5 de novo em até 5 segundos para APAGAR TUDO.';
        return;
      }
    } else return;
    renderPainel();
  }

  // ================= HUD (chamado todo frame) =================
  function atualizarHud() {
    const run = Battle.run, b = Battle.estado;
    if (!run || !b || $('hud').classList.contains('hidden')) return;
    const p = run.p;
    const set = (id, v, prop = 'textContent') => {
      if (cacheHud[id] === v) return;
      cacheHud[id] = v;
      $(id)[prop] = v;
    };
    set('hud-nick', `@${run.nick}`);
    set('hud-andar', `${rotuloAndar()} · ${b.A.nome}`);
    set('hud-score', `PTS ${pad(run.pontos, 6)}`);
    set('hud-cred', `${p.creditos} ₿`);
    const hpProp = Math.max(0, p.hp / p.maxHp);
    set('hp-text', `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`);
    const fill = $('hp-fill');
    const w = (hpProp * 100).toFixed(1) + '%';
    if (cacheHud.hpw !== w) { cacheHud.hpw = w; fill.style.width = w; fill.classList.toggle('baixo', hpProp < 0.3); }

    const status = [];
    if (b.escudo > 0) status.push(`<span class="cyan">[#] escudo x${b.escudo}</span>`);
    if (b.lento > 0) status.push(`<span class="amber">c[_] café ${Math.ceil(b.lento)}s</span>`);
    if (p.reviver > 0) status.push(`<span class="pink">^^^ backup</span>`);
    set('hud-status', status.join(' '), 'innerHTML');

    const mult = Math.round(Math.min(b.combo, COMBO_MAX) * COMBO_PASSO * 100);
    set('hud-combo', b.combo > 1 ? `COMBO x${b.combo}<small>dano +${mult}%</small>` : '', 'innerHTML');
    $('hud-combo').classList.toggle('quente', b.combo >= 10);

    const itens = ITENS.map((it, i) => {
      const q = run.inventario[it.id];
      return `<span class="slot ${q ? '' : 'vazio'}"><b>${i + 1}</b> ${esc(it.icone)} ${esc(it.nome)} <i>x${q}</i></span>`;
    }).join('');
    set('items', itens, 'innerHTML');

    // prompt de digitação
    const pr = Battle.prompt();
    const chave = pr ? `${pr.texto}|${pr.dig}|${pr.ativo}` : '';
    if (chave !== cachePrompt) {
      cachePrompt = chave;
      const el = $('prompt-text');
      if (!pr || !pr.texto) {
        el.innerHTML = '<span class="dica">digite a palavra de um inimigo...</span>';
      } else {
        const feito = esc(pr.texto.slice(0, pr.dig));
        const prox = pr.texto[pr.dig] === ' ' ? '␣' : esc(pr.texto[pr.dig] || '');
        const resto = esc(pr.texto.slice(pr.dig + 1));
        el.innerHTML = `<span class="feito">${feito}</span><span class="prox">${prox}</span><span class="resto">${resto}</span>`;
      }
      $('prompt').classList.toggle('inativo', !!pr && !pr.ativo);
    }
  }

  function logLinha(msg, cor) {
    const box = $('log');
    const d = document.createElement('div');
    d.textContent = msg;
    if (cor) d.style.color = cor;
    box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
  }

  function piscar(cls) {
    const f = $('flash');
    f.className = '';
    void f.offsetWidth;
    f.className = cls;
  }

  function aoErro() {
    const pr = $('prompt');
    pr.classList.remove('erro');
    void pr.offsetWidth;
    pr.classList.add('erro');
  }

  Battle.on('log', logLinha);
  Battle.on('erro', aoErro);
  Battle.on('dano', () => piscar('dano'));
  Battle.on('alertaChefe', aoAlertaChefe);
  Battle.on('chefeDerrotado', () => piscar('branco'));
  Battle.on('andarConcluido', aoAndarConcluido);
  Battle.on('gameOver', aoGameOver);
  Battle.on('conquista', aoConquista);

  document.querySelectorAll('.modo').forEach(el => el.addEventListener('click', () => escolherModo(el.dataset.modo)));

  // ================= INATIVIDADE =================
  // Se um visitante abandona o jogo num menu, o jogo encerra sozinho
  // (a pontuação é salva) e volta ao título para a próxima pessoa.
  const MENUS_SEM_PARTIDA = ['nick', 'modo', 'tutorial', 'pin', 'painel'];
  const MENUS_DA_PARTIDA = ['concluido', 'upgrade', 'loja', 'pausa'];
  function atividade() { ultimaAtividade = performance.now(); }
  setInterval(() => {
    if (performance.now() - ultimaAtividade < CONFIG.ociosoSeg * 1000) return;
    if (MENUS_SEM_PARTIDA.includes(estado)) { atividade(); irTitulo(); }
    else if (MENUS_DA_PARTIDA.includes(estado)) { atividade(); desistir(); }
  }, 1000);

  // ================= TECLADO (menus) =================
  function tecla(e) {
    const k = e.key;
    atividade();
    if (estado === 'carregando') { e.preventDefault(); return; }
    if (estado === 'batalha') {
      if (k === 'Escape') { e.preventDefault(); pausar(); }
      else if (k === 'Backspace') { e.preventDefault(); Battle.soltarAlvo(); }
      else if (/^[1-4]$/.test(k)) { e.preventDefault(); Battle.usarItem(+k - 1); }
      return;
    }
    if (estado === 'banner') { if (k.length === 1 || k === 'Enter') e.preventDefault(); return; }
    if (travado()) { if (k === 'Enter') e.preventDefault(); return; }

    switch (estado) {
      case 'titulo':
        if (e.ctrlKey && e.shiftKey && (k === 'O' || k === 'o')) { e.preventDefault(); abrirPainel(); }
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); irNick(); }
        break;
      case 'nick':
        if (k === 'Enter') { e.preventDefault(); confirmarNick(); }
        else if (k === 'Escape') irTitulo();
        break;
      case 'modo':
        if (k === '1') escolherModo('normal');
        else if (k === '2') escolherModo('rapido');
        else if (k === 'Escape') irTitulo();
        break;
      case 'tutorial':
        if (k === 'Enter') { e.preventDefault(); iniciarAndar(); }
        break;
      case 'concluido':
        if (k === 'Enter') irUpgrade();
        break;
      case 'upgrade':
        if (/^[1-3]$/.test(k)) escolherCarta(+k - 1);
        break;
      case 'loja':
        if (/^[1-4]$/.test(k)) comprar(+k - 1);
        else if (k === 'Enter') proximoAndar();
        break;
      case 'pausa':
        if (k === '1' || k === 'Escape') continuar();
        else if (k === '2') { Sound.alternar(); $('pause-sound').textContent = `[2] Som: ${Sound.ligado ? 'ON' : 'OFF'}`; }
        else if (k === '3') desistir();
        break;
      case 'fim':
        if (k === 'Enter') irRelatorio();
        break;
      case 'relatorio':
        if (k === 'Enter') irRanking();
        break;
      case 'ranking':
        if (k === 'Enter' || k === 'Escape') irTitulo();
        break;
      case 'pin':
        if (k === 'Enter') { e.preventDefault(); confirmarPin(); }
        else if (k === 'Escape') irTitulo();
        break;
      case 'painel':
        if (k === 'Escape') irTitulo();
        else teclaPainel(k);
        break;
    }
    if (e.key === 'Enter') e.preventDefault();
  }

  // Atalhos de desenvolvimento:
  //   index.html?andar=5          começa direto no andar 5
  //   index.html?andar=5&chefe=1  começa direto no chefão do andar 5
  function inicioDebug(andar, chefe) {
    Sound.init();
    Battle.novaPartida('DEV', 'normal');
    Battle.run.debug = true;
    Battle.irParaAndar(andar - 1);
    Battle.run.p.creditos = 200;
    iniciarAndar();
    if (chefe) Battle.estado.restante = 0;
  }

  return {
    irTitulo, tecla, focar, atualizarHud, inicioDebug, atividade, gerarCsv,
    get estado() { return estado; },
    mostraBatalha: () => ['batalha', 'banner', 'pausa'].includes(estado),
  };
})();
