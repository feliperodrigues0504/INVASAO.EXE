// =====================================================================
//  Inicialização: loop principal, escala da tela e captura do teclado.
// =====================================================================

(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const jogo = document.getElementById('game');
  const entrada = document.getElementById('type-input');
  const params = new URLSearchParams(location.search);

  // ---------------- escala para caber em qualquer tela ----------------
  function redimensionar() {
    const s = Math.min(window.innerWidth / LARGURA, window.innerHeight / ALTURA);
    jogo.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', redimensionar);
  redimensionar();

  // ---------------- digitação na batalha ----------------
  // Lemos o texto de um <input> escondido (e não tecla por tecla) para que
  // os acentos do teclado ABNT2 (´ ~ ^ ` + letra) funcionem corretamente.
  function processarEntrada() {
    const valor = entrada.value;
    entrada.value = '';
    if (UI.estado !== 'batalha') return;
    for (const ch of valor.normalize('NFC')) Battle.digitar(ch);
  }
  entrada.addEventListener('input', e => { if (!e.isComposing) processarEntrada(); });
  entrada.addEventListener('compositionend', processarEntrada);
  // colar ou arrastar texto seria trapaça
  entrada.addEventListener('paste', e => e.preventDefault());
  entrada.addEventListener('drop', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    if (e.key === 'Tab') e.preventDefault();
    UI.tecla(e);
  });

  // mantém o foco no campo certo (cliques fora, alt+tab etc.)
  document.addEventListener('mousedown', e => {
    Sound.init();
    UI.atividade();
    if (!e.target.closest('.card, .shop-item, .modo')) { e.preventDefault(); UI.focar(); }
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('focus', () => UI.focar());
  entrada.addEventListener('blur', () => setTimeout(() => { if (UI.estado !== 'nick') UI.focar(); }, 0));

  // ---------------- loop ----------------
  // Um quadro do jogo: atualiza e desenha. Separado do loop para os testes
  // automatizados poderem chamá-lo diretamente (e verem qualquer erro).
  function quadro(dt, t) {
    FX.atualizar(dt);
    if (UI.estado === 'batalha') Battle.atualizar(dt);

    const b = Battle.estado;
    const naBatalha = UI.mostraBatalha() && b;
    FX.desenharFundo(ctx, naBatalha ? b.A.cores[0] : '#39ff14', t, naBatalha);
    if (naBatalha) {
      const o = FX.offset();
      ctx.save();
      ctx.translate(o.x, o.y);
      Battle.desenhar(ctx, t);
      FX.desenharEfeitos(ctx);
      ctx.restore();
    }
    UI.atualizarHud();
  }

  let ultimo = performance.now();
  function loop(agora) {
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    try {
      quadro(dt, agora / 1000);
    } catch (err) {
      // nunca deixar o jogo congelar no meio do evento
      console.error(err);
    }
    proximoQuadro(loop);
  }

  // ?tick=1 usa um timer comum no lugar do requestAnimationFrame (testes automatizados)
  const proximoQuadro = params.get('tick')
    ? fn => setTimeout(() => fn(performance.now()), 16)
    : requestAnimationFrame.bind(window);

  // Ferramentas para quem estiver cuidando do estande (abra o console com F12):
  //   INVASAO.limparRanking()   -> apaga o ranking
  //   INVASAO.exportarRanking() -> mostra o ranking em formato de tabela
  window.INVASAO = {
    limparRanking: () => { Ranking.limpar(); UI.irTitulo(); return 'ranking apagado'; },
    exportarRanking: () => console.table(Ranking.carregar()),
    _quadro: quadro,
    _ctx: ctx,
  };

  // ajustes salvos pelo painel do organizador
  const ajustes = Ajustes.carregar();
  CONFIG.modoFixo = ajustes.modoFixo;
  Sound.definirLigado(ajustes.som);
  Sound.definirVolume(ajustes.volume);

  const iniciar = () => {
    if (params.get('teste')) {
      // ?teste=1 -> roda a bateria de testes automatizados (tests/testes.js)
      UI.irTitulo();
      const s = document.createElement('script');
      s.src = 'tests/testes.js';
      document.body.appendChild(s);
      return;
    }
    if (params.get('andar')) UI.inicioDebug(+params.get('andar'), params.get('chefe'));
    else UI.irTitulo();
    proximoQuadro(loop);
    if (params.get('bot')) iniciarBot();
  };

  // ?bot=1 (ou ?bot=ms) -> um robô joga sozinho, para testar o jogo.
  // ?parar=loja faz o robô parar quando chegar naquela tela.
  // ?modo=2 faz o robô escolher o modo rápido.
  function iniciarBot() {
    const parar = params.get('parar');
    const teclaModo = params.get('modo') === '2' ? '2' : '1';
    if (parar) { CONFIG.voltarTituloSeg = 99999; CONFIG.ociosoSeg = 99999; }
    let espera = 0;
    const tecla = (key, extra) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key }, extra)));
    setInterval(() => {
      const est = UI.estado, b = Battle.estado;
      if (est === parar) return;
      if (est === 'batalha' && b) {
        const alvo = b.alvo || b.inimigos.find(e => !e.morrendo);
        if (alvo) Battle.digitar(Math.random() < 0.05 ? 'x' : alvo.texto[alvo.dig]);
        return;
      }
      if (++espera < 12) return;
      espera = 0;
      // ?parar=painel: o robô abre o painel do organizador (para a screenshot)
      if (parar === 'painel' && est === 'titulo') tecla('O', { ctrlKey: true, shiftKey: true });
      else if (est === 'pin') { document.getElementById('pin-input').value = String(CONFIG.pinOrganizador); tecla('Enter'); }
      else if (est === 'modo') tecla(teclaModo);
      else if (est === 'upgrade') tecla('1');
      else if (est === 'loja') tecla(Battle.run.inventario.cafe < 1 ? '1' : 'Enter');
      // nick de 30 caracteres (o máximo) para validar o layout no pior caso
      else if (est === 'nick') { document.getElementById('nick-input').value = 'Robô Testador da Computação ' + (10 + Math.floor(Math.random() * 90)); tecla('Enter'); }
      else if (['titulo', 'tutorial', 'concluido', 'fim', 'relatorio', 'ranking'].includes(est)) tecla('Enter');
    }, +params.get('bot') > 1 ? +params.get('bot') : 110);
  }

  // espera as fontes carregarem (com limite, caso esteja offline)
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(iniciar);
  } else iniciar();
})();
