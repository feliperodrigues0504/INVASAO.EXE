// =====================================================================
//  INVASÃO.EXE — bateria de testes automatizados
//  Como rodar: abra  index.html?teste=1  (o resultado aparece na tela).
//  O ranking real é salvo antes e restaurado no final.
// =====================================================================

(async () => {
  const testes = [];
  const teste = (nome, fn) => testes.push({ nome, fn });
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const $ = id => document.getElementById(id);
  const tecla = key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  function afirmar(cond, msg) { if (!cond) throw new Error(msg || 'condição falsa'); }
  function igual(obtido, esperado, msg) {
    if (obtido !== esperado) throw new Error(`${msg || ''} | esperado: ${JSON.stringify(esperado)} | obtido: ${JSON.stringify(obtido)}`);
  }

  // ---------- preparação ----------
  const backupRanking = localStorage.getItem(Ranking.CHAVE);
  const backupAjustes = localStorage.getItem(Ajustes.CHAVE);
  const somOriginal = Sound.ligado, volumeOriginal = Sound.volume;
  const configOriginal = Object.assign({}, CONFIG);
  CONFIG.voltarTituloSeg = 99999;
  CONFIG.ociosoSeg = 99999;
  CONFIG.modoFixo = null;
  const rngOriginal = Math.random;

  const cont = {};
  ['andarConcluido', 'gameOver', 'alertaChefe', 'chefeDerrotado', 'erro', 'dano', 'conquista']
    .forEach(ev => Battle.on(ev, () => { cont[ev] = (cont[ev] || 0) + 1; }));
  const zerar = () => Object.keys(cont).forEach(k => { cont[k] = 0; });
  const n = ev => cont[ev] || 0;

  const temAcento = s => s.normalize('NFD').length !== s.length;
  const vivos = () => Battle.estado.inimigos.filter(e => !e.morrendo);

  function novaBatalha(andarIdx, extraP) {
    UI.irTitulo();
    Battle.novaPartida('teste', 'normal');
    const run = Battle.run;
    run.debug = true;
    Battle.irParaAndar(andarIdx);
    Object.assign(run.p, extraP || {});
    Battle.iniciarAndar();
    zerar();
    return run;
  }
  function simular(seg, parar) {
    for (let t = 0; t < seg; t += 0.05) {
      Battle.atualizar(0.05);
      FX.atualizar(0.05);
      if (parar && parar()) return true;
    }
    return false;
  }
  const ateInimigos = q => simular(15, () => vivos().length >= q && vivos().every(e => e.nascendo <= 0));
  const digitar = s => { for (const ch of s) Battle.digitar(ch); };
  // pula a onda: remove quem estiver vivo e espera o chefão terminar de aparecer
  const ateChefe = () => {
    Battle.estado.restante = 0;
    Battle.estado.inimigos.forEach(e => { e.morrendo = true; });
    return simular(8, () => Battle.estado.chefe && Battle.estado.chefe.nascendo <= 0);
  };
  function botTecla() {
    const b = Battle.estado;
    if (b.etapa !== 'ondas' && b.etapa !== 'chefe') return;
    const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : b.inimigos.find(e => !e.morrendo);
    if (alvo) Battle.digitar(alvo.texto[alvo.dig]);
  }
  const desenhar = t => { Battle.desenhar(INVASAO._ctx, t); FX.desenharEfeitos(INVASAO._ctx); };

  // Cena pesada: andar 7, 3 inimigos, explosões, café, escudo e HUD visível.
  // Atenção: no navegador de testes o relógio é virtual e NÃO anda durante código síncrono,
  // por isso o tempo é medido de fora, pelo validar.ps1 (modo ?teste=perf&n=QUADROS).
  function rodarCenaPesada(quadrosN) {
    UI.inicioDebug(7);
    Battle.run.p.maxHp = Battle.run.p.hp = 1e6;
    afirmar(ateInimigos(3), 'deveriam aparecer 3 inimigos');
    const b = Battle.estado;
    b.lento = 99; b.escudo = 3;
    for (let i = 0; i < quadrosN; i++) {
      if (i % 120 === 0) for (let k = 0; k < 3; k++) FX.explodir(Sprites.get('ransomware', 7), 300 + k * 120, 200);
      botTecla();
      Battle.atualizar(1 / 60);
      INVASAO._quadro(1 / 60, i / 60);
    }
  }

  const params = new URLSearchParams(location.search);
  if (params.get('teste') === 'perf') {
    CONFIG.voltarTituloSeg = CONFIG.ociosoSeg = 99999;
    rodarCenaPesada(+params.get('n') || 0);
    document.body.insertAdjacentHTML('beforeend', '<div id="perf-fim">PERF-FIM</div>');
    return;
  }

  // =====================================================================
  //  DADOS
  // =====================================================================
  teste('dados: 9 andares completos (palavras, chefão, falas, curiosidade)', () => {
    igual(ANDARES.length, 9, 'quantidade de andares');
    ANDARES.forEach((A, i) => {
      afirmar(A.nome && A.desc && A.dica && A.fato, `andar ${i + 1}: textos faltando`);
      afirmar(['nenhum', 'leniente', 'estrito'].includes(A.acentos), `andar ${i + 1}: modo de acento inválido`);
      afirmar(A.palavras.length >= 15, `andar ${i + 1}: poucas palavras`);
      afirmar(A.tipos.every(t => TIPOS_INIMIGO[t]), `andar ${i + 1}: tipo de inimigo inexistente`);
      afirmar(A.cores.length === 2, `andar ${i + 1}: cores`);
      for (const k of ['inimigos', 'maxTela', 'hp', 'atkBase', 'porLetra', 'dano', 'recompensa'])
        afirmar(Number.isFinite(A[k]) && A[k] > 0, `andar ${i + 1}: ${k} inválido`);
      const C = A.chefe;
      afirmar(C.nome && C.arquivo && SPRITES[C.sprite], `andar ${i + 1}: chefão incompleto`);
      afirmar(C.frases.length >= 4, `andar ${i + 1}: poucas frases do chefão`);
      afirmar(C.falas.intro && C.falas.metade && C.falas.derrota, `andar ${i + 1}: falas faltando`);
      afirmar([null, 'glitch', 'invocar', 'acelerar'].includes(C.truque), `andar ${i + 1}: truque inválido`);
    });
  });

  teste('dados: todo texto é digitável num teclado ABNT2', () => {
    const permitido = 'abcdefghijklmnopqrstuvwxyzáéíóúâêôãõçà ,.!?:*-';
    ANDARES.forEach((A, i) => {
      for (const t of [...A.palavras, ...A.chefe.frases]) {
        igual(t, t.normalize('NFC'), `andar ${i + 1} "${t}" não está em NFC`);
        igual(t, t.trim(), `andar ${i + 1} "${t}" tem espaço sobrando`);
        afirmar(!t.includes('  '), `andar ${i + 1} "${t}" tem espaço duplo`);
        for (const ch of t) afirmar(permitido.includes(ch), `andar ${i + 1} "${t}" tem caractere não permitido "${ch}"`);
      }
    });
  });

  teste('dados: andares "sem acento" realmente não têm acento', () => {
    ANDARES.forEach((A, i) => {
      if (A.acentos !== 'nenhum') return;
      for (const t of [...A.palavras, ...A.chefe.frases]) afirmar(!temAcento(t), `andar ${i + 1}: "${t}" tem acento`);
    });
  });

  teste('dados: sem palavras repetidas e com primeiras letras variadas', () => {
    ANDARES.forEach((A, i) => {
      igual(new Set(A.palavras).size, A.palavras.length, `andar ${i + 1}: palavra repetida`);
      const iniciais = new Set(A.palavras.map(w => w[0].normalize('NFD')[0]));
      afirmar(iniciais.size >= A.maxTela + 3, `andar ${i + 1}: só ${iniciais.size} letras iniciais diferentes`);
    });
  });

  teste('sprites: todos existem e toda cor usada está na paleta', () => {
    for (const [nome, def] of Object.entries(SPRITES)) {
      def.grid.forEach((linha, y) => {
        for (const ch of linha) afirmar(ch === '.' || def.pal[ch], `sprite ${nome} linha ${y}: cor "${ch}" sem paleta`);
      });
      const s = Sprites.get(nome, 2);
      afirmar(s.w > 0 && s.h > 0 && s.pixels.length > 0, `sprite ${nome} vazio`);
    }
    Object.values(TIPOS_INIMIGO).forEach(t => afirmar(SPRITES[t.sprite], `sprite ${t.sprite} não existe`));
  });

  teste('upgrades e itens: ids únicos, raridades válidas, efeitos não quebram', () => {
    igual(new Set(UPGRADES.map(u => u.id)).size, UPGRADES.length, 'id de upgrade repetido');
    UPGRADES.forEach(u => {
      afirmar(RARIDADES[u.raridade], `${u.id}: raridade inválida`);
      afirmar(u.max >= 1 && u.desc && u.icone, `${u.id}: dados faltando`);
      const p = Object.assign({ maxHp: 100 }, JOGADOR_BASE);
      u.aplicar(p);
    });
    Battle.novaPartida('x');
    ITENS.forEach(it => afirmar(it.id in Battle.run.inventario, `item ${it.id} fora do inventário`));
    afirmar(ITENS.length === 4, 'devem existir 4 itens (teclas 1 a 4)');
  });

  // =====================================================================
  //  NICK
  // =====================================================================
  teste('nick: aceita nomes comuns, acentos, espaços e até 30 caracteres', () => {
    const ok = ['Fernanda', 'joão_silva', 'Ana Clara', 'computeiro', 'Computação', 'deputado', 'Rolando',
      'controlador', 'Yoshito', 'enviado', 'Esmeralda', 'Pinto', 'Paulo', 'Cuca', 'Nazaré', 'Disputa',
      'xX_Hacker_Xx', 'Hacker Supremo da Computação 1', 'SI-2026', 'a.b'];
    ok.forEach(nk => igual(Nick.validar(nk), null, `"${nk}" deveria ser aceito`));
    igual('Hacker Supremo da Computação 1'.length, 30, 'tamanho do nick de teste');
  });

  teste('nick: bloqueia palavrões, nicks curtos/longos e caracteres especiais', () => {
    const ruins = ['', 'a', '   ', 'x'.repeat(31), 'porra', 'PORRA123', 'c4r4lh0', 'puta', 'putaria', 'fdp',
      'Cu', 'viado', 'xXcaralhoXx', 'foda-se', 'hitler1', '<script>', 'nick😀', 'a/b'];
    ruins.forEach(nk => afirmar(Nick.validar(nk) !== null, `"${nk}" deveria ser bloqueado`));
    igual($('nick-input').maxLength, 30, 'maxlength do campo de nick');
  });

  // =====================================================================
  //  RANKING
  // =====================================================================
  teste('ranking: ordena por pontos e devolve a posição correta', () => {
    Ranking.limpar();
    Ranking.adicionar({ nick: 'b', pontos: 100, andar: 2, venceu: false, ppm: 20, precisao: 90 });
    Ranking.adicionar({ nick: 'a', pontos: 300, andar: 4, venceu: false, ppm: 30, precisao: 95 });
    const r = Ranking.adicionar({ nick: 'c', pontos: 200, andar: 3, venceu: false, ppm: 25, precisao: 92 });
    igual(r.posicao, 2, 'posição');
    igual(r.total, 3, 'total');
    igual(Ranking.top(3).map(x => x.nick).join(','), 'a,c,b', 'ordem');
  });

  teste('segurança: nick com código HTML adulterado no armazenamento nunca vira código na tela', async () => {
    // a validação de nick já barra < e >, mas o ranking pode ser adulterado direto no navegador
    const ataque = '<img src=x id=xss onerror=window.__xss=1>';
    localStorage.setItem(Ranking.CHAVE, JSON.stringify([
      { nick: ataque, pontos: 50, andar: 1, total: 9, modo: 'normal', venceu: false, ppm: 1, precisao: 1, conquistas: [] },
      { nick: ataque, pontos: 40, andar: 1, total: 3, modo: 'rapido', venceu: false, ppm: 1, precisao: 1, conquistas: [] },
    ]));
    const semInjecao = onde => {
      afirmar(!document.getElementById('xss'), `HTML injetado virou elemento em: ${onde}`);
      afirmar(!window.__xss, `código injetado executou em: ${onde}`);
    };
    UI.irTitulo();
    semInjecao('título');
    afirmar($('title-rank-normal').textContent.includes('<img'), 'o nick aparece como texto');
    await espera(700);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', ctrlKey: true, shiftKey: true, bubbles: true }));
    await espera(700);
    $('pin-input').value = CONFIG.pinOrganizador;
    tecla('Enter');
    semInjecao('painel do organizador');
    // tela de ranking (via fim de jogo de uma partida de teste)
    novaBatalha(0);
    Battle.estado.etapa = 'morte'; Battle.estado.tempoEtapa = 0; Battle.estado.avisou = false;
    Battle.atualizar(2.5);
    await espera(1600); tecla('Enter');
    await espera(700); tecla('Enter');
    igual(UI.estado, 'ranking', 'ranking');
    semInjecao('ranking');
    // o ranking corta nicks em NICK_MAX caracteres ao carregar (o ataque tem mais que isso)
    afirmar(UI.gerarCsv().includes(ataque.slice(0, NICK_MAX)), 'no CSV o nick vai como texto puro');
    Ranking.limpar();
  });

  teste('ranking: dados corrompidos ou antigos não quebram o jogo', () => {
    for (const lixo of ['{"a":1}', 'lixo{', 'null', '[null, {"nick":5}, {"nick":"ok","pontos":"x"}]', '[{"nick":"velho","pontos":50}]']) {
      localStorage.setItem(Ranking.CHAVE, lixo);
      const l = Ranking.carregar();
      afirmar(Array.isArray(l), `carregar com "${lixo}"`);
      UI.irTitulo();
      afirmar(!$('screen-title').classList.contains('hidden'), 'tela título deveria abrir');
    }
    igual(Ranking.carregar()[0].precisao, 0, 'campo ausente vira 0');
    Ranking.limpar();
  });

  // =====================================================================
  //  BATALHA
  // =====================================================================
  teste('batalha: palavra completa derrota inimigo do andar 1 e dá créditos/pontos', () => {
    const run = novaBatalha(0);
    afirmar(ateInimigos(1), 'nenhum inimigo apareceu');
    const e = vivos()[0];
    digitar(e.texto);
    afirmar(e.morrendo, 'inimigo deveria morrer (hp 10, dano 10)');
    afirmar(run.p.creditos > 0 && run.pontos > 0, 'créditos e pontos');
    igual(n('erro'), 0, 'nenhum erro');
  });

  teste('batalha: erro não avança, conta erro e zera o combo', () => {
    novaBatalha(0);
    ateInimigos(1);
    const e = vivos()[0];
    Battle.digitar(e.texto[0]);
    Battle.estado.combo = 7;
    Battle.digitar('#');
    igual(e.dig, 1, 'progresso não pode avançar');
    igual(n('erro'), 1, 'erros');
    igual(Battle.estado.combo, 0, 'combo');
  });

  teste('batalha: espaço sem alvo é ignorado e maiúsculas são aceitas', () => {
    novaBatalha(0);
    ateInimigos(1);
    const e = vivos()[0];
    Battle.digitar(' ');
    igual(n('erro'), 0, 'espaço sem alvo não é erro');
    Battle.digitar(e.texto[0].toUpperCase());
    igual(e.dig, 1, 'maiúscula aceita');
  });

  teste('batalha: modo leniente (andar 3) aceita sem acento, mas não soma combo', () => {
    novaBatalha(2, { crit: 0 });
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'função'; e.dig = 0;
    digitar('funcao');
    igual(n('erro'), 0, 'sem erros');
    igual(Battle.estado.combo, 0, 'palavra sem acento não soma combo');
    afirmar(e.texto !== 'função' || e.dig === 0, 'deveria ter recebido texto novo');
  });

  teste('batalha: modo estrito (andar 5) exige o acento', () => {
    novaBatalha(4);
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'conexão'; e.dig = 0;
    digitar('conex');
    Battle.digitar('a');
    igual(n('erro'), 1, '"a" no lugar de "ã" é erro');
    igual(e.dig, 5, 'não avança');
    Battle.digitar('ã');
    igual(e.dig, 6, 'com acento avança');
  });

  teste('batalha: BACKSPACE solta o alvo e mantém o progresso', () => {
    novaBatalha(0);
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 999;
    // palavra fixa: com uma sorteada de 3 letras ("cpu"), a 3ª letra completaria a palavra (teste instável TST-09)
    e.texto = 'teclado'; e.dig = 0;
    digitar(e.texto.slice(0, 2));
    Battle.soltarAlvo();
    igual(Battle.estado.alvo, null, 'alvo solto');
    igual(e.dig, 2, 'progresso mantido');
    Battle.digitar(e.texto[2]);
    igual(e.dig, 3, 'continua de onde parou');
  });

  teste('batalha: combo cresce com palavras perfeitas e aumenta o dano (fórmula)', () => {
    const run = novaBatalha(0, { crit: 0 });
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 9999;
    const danos = [];
    for (let i = 0; i < 6; i++) {
      e.texto = 'cabos'; e.dig = 0;
      const antes = e.hp;
      digitar('cabos');
      danos.push(antes - e.hp);
    }
    igual(Battle.estado.combo, 6, 'combo');
    danos.forEach((d, i) => igual(d, Math.round(run.p.atk * (1 + (i + 1) * COMBO_PASSO)), `dano da palavra ${i + 1}`));
  });

  teste('batalha: acerto crítico dobra o dano', () => {
    novaBatalha(0, { crit: 1 });
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 9999;
    e.texto = 'cabos'; e.dig = 0;
    digitar('cabos');
    igual(9999 - e.hp, Math.round(10 * 1.05 * 2), 'dano crítico');
  });

  teste('batalha: inimigo ataca quando a barra enche; escudo e criptografia bloqueiam', () => {
    const run = novaBatalha(0);
    ateInimigos(1);
    const e = vivos()[0];
    const atacar = () => { e.atk = e.intervalo - 0.001; Battle.atualizar(0.05); };
    atacar();
    igual(run.p.hp, 100 - ANDARES[0].dano, 'dano recebido');
    Battle.estado.escudo = 1;
    atacar();
    igual(run.p.hp, 100 - ANDARES[0].dano, 'escudo bloqueia');
    igual(Battle.estado.escudo, 0, 'escudo gasto');
    run.p.bloqueio = 1;
    atacar();
    igual(run.p.hp, 100 - ANDARES[0].dano, 'criptografia bloqueia');
  });

  teste('batalha: 3 inimigos atacando no mesmo quadro matam o jogador uma única vez', () => {
    const run = novaBatalha(6);
    afirmar(ateInimigos(3), 'deveriam aparecer 3 inimigos');
    zerar();
    run.p.hp = 1;
    vivos().forEach(e => { e.atk = e.intervalo; });
    Battle.atualizar(0.05);
    igual(n('dano'), 1, 'só o primeiro ataque pode acertar');
    igual(Battle.estado.etapa, 'morte', 'etapa');
    simular(3);
    igual(n('gameOver'), 1, 'gameOver uma vez');
  });

  teste('batalha: Backup na Nuvem revive uma única vez', () => {
    const run = novaBatalha(0, { reviver: 1 });
    ateInimigos(1);
    const e = vivos()[0];
    run.p.hp = 1;
    e.atk = e.intervalo; Battle.atualizar(0.05);
    igual(run.p.hp, 50, 'revive com 50%');
    igual(run.p.reviver, 0, 'backup consumido');
    run.p.hp = 1;
    e.atk = e.intervalo; Battle.atualizar(0.05);
    igual(Battle.estado.etapa, 'morte', 'na segunda vez morre');
  });

  teste('batalha: os 9 andares completos (ondas → alerta → chefão → vitória) sem travar', () => {
    for (let k = 0; k < 9; k++) {
      const run = novaBatalha(k, { maxHp: 1e6, hp: 1e6 });
      let t = 0, viuChefe = false;
      const fim = simular(900, () => {
        t += 0.05;
        botTecla();
        if (Battle.estado.chefe) viuChefe = true;
        if (Math.round(t * 20) % 15 === 0) desenhar(t);
        return n('andarConcluido') > 0;
      });
      afirmar(fim, `andar ${k + 1} não terminou em 900s simulados (etapa ${Battle.estado.etapa})`);
      afirmar(viuChefe, `andar ${k + 1}: chefão não apareceu`);
      igual(n('alertaChefe'), 1, `andar ${k + 1}: alertas`);
      igual(n('chefeDerrotado'), 1, `andar ${k + 1}: chefão derrotado`);
      simular(5);
      igual(n('andarConcluido'), 1, `andar ${k + 1}: andarConcluido deve disparar 1 vez`);
      afirmar(run.stats.abates >= ANDARES[k].inimigos + 1, `andar ${k + 1}: abates`);
    }
  });

  teste('chefão: truque "invocar" chama capangas com letras que não conflitam', () => {
    novaBatalha(2, { maxHp: 1e6, hp: 1e6 });
    afirmar(ateChefe(), 'chefão não apareceu');
    simular(22);
    const capangas = vivos().filter(e => !e.chefe);
    afirmar(capangas.length >= 1, 'nenhum capanga');
    const chefe = Battle.estado.chefe;
    const ini = s => s.normalize('NFD')[0];
    capangas.forEach(c => afirmar(ini(c.texto[c.dig]) !== ini(chefe.texto[chefe.dig]), 'capanga começa com a mesma letra do chefão'));
  });

  teste('chefão: truque "acelerar" encurta o intervalo de ataque com a vida baixa', () => {
    novaBatalha(3, { maxHp: 1e6, hp: 1e6, crit: 0 });
    ateChefe();
    const chefe = Battle.estado.chefe;
    const i0 = chefe.intervalo;
    chefe.hp = Math.round(chefe.maxHp * 0.3);
    digitar(chefe.texto.slice(chefe.dig));
    afirmar(chefe.intervalo < i0 * 0.8, `intervalo ${chefe.intervalo.toFixed(2)} deveria ser < ${(i0 * 0.8).toFixed(2)}`);
    afirmar(chefe.metade, 'abaixo de 50% fica furioso');
  });

  teste('itens: café, patch, antivírus e firewall funcionam e consomem 1 unidade', () => {
    const run = novaBatalha(0);
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 999;
    Object.assign(run.inventario, { cafe: 1, patch: 1, antivirus: 1, escudo: 1 });
    run.p.hp = 50;
    Battle.usarItem(0); afirmar(Battle.estado.lento > 0, 'café');
    Battle.usarItem(1); igual(run.p.hp, 85, 'patch');
    Battle.usarItem(2); igual(e.hp, 959, 'antivírus');
    Battle.usarItem(3); igual(Battle.estado.escudo, 2, 'firewall');
    igual(Object.values(run.inventario).join(','), '0,0,0,0', 'estoque');
    Battle.usarItem(1); igual(run.p.hp, 85, 'sem estoque não faz nada');
    run.p.hp = 90; run.inventario.patch = 1; Battle.usarItem(1); igual(run.p.hp, 100, 'patch não passa do máximo');
  });

  teste('itens: antivírus pode derrotar o chefão e concluir o andar', () => {
    const run = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    ateChefe();
    Battle.estado.chefe.hp = 10;
    run.inventario.antivirus = 1;
    Battle.usarItem(2);
    igual(Battle.estado.etapa, 'vitoria', 'etapa');
    simular(3);
    igual(n('andarConcluido'), 1, 'andar concluído');
  });

  teste('loja: compra, limite de 3 por item e créditos insuficientes', () => {
    const run = novaBatalha(0);
    run.p.creditos = 1000;
    for (let i = 0; i < 3; i++) igual(Battle.comprar(0), 'ok', `compra ${i + 1}`);
    igual(Battle.comprar(0), 'cheio', 'limite');
    run.p.creditos = 10;
    igual(Battle.comprar(1), 'sem credito', 'sem crédito');
    igual(run.p.creditos, 10, 'créditos intactos');
  });

  teste('upgrades: sorteio sem repetição, respeitando o máximo de cada um', () => {
    novaBatalha(0);
    for (let i = 0; i < 300; i++) {
      const c = Battle.sortearCartas(3);
      igual(c.length, 3, 'sempre 3 cartas');
      igual(new Set(c.map(u => u.id)).size, 3, 'sem repetir');
    }
    UPGRADES.forEach(u => { Battle.run.upgrades[u.id] = u.max; });
    igual(Battle.sortearCartas(3).length, 0, 'tudo no máximo = nenhuma carta');
  });

  teste('upgrades: efeitos de todas as cartas', () => {
    novaBatalha(0);
    const p = Battle.run.p;
    const pega = id => Battle.aplicarUpgrade(UPGRADES.find(u => u.id === id));
    pega('overclock'); igual(p.atk, 12.5, 'overclock');
    pega('firewall'); igual(p.maxHp, 125, 'firewall máx'); igual(p.hp, 125, 'firewall cura');
    pega('ssd'); igual(p.velInimigos, 0.88, 'ssd');
    pega('mineracao'); igual(p.multCreditos, 1.5, 'mineração');
    pega('cache'); igual(p.escudoInicial, 1, 'cache');
    pega('exploit'); afirmar(Math.abs(p.crit - 0.18) < 1e-9, 'exploit');
    pega('criptografia'); igual(p.bloqueio, 0.15, 'criptografia');
    pega('garbage'); igual(p.vidaPorAbate, 4, 'garbage');
    pega('multithread'); igual(p.ganhoCombo, 2, 'multithread');
    pega('corretor'); igual(p.perdoaErro, true, 'corretor');
    pega('vpn'); igual(p.danoChefe, 0.7, 'vpn');
    pega('autocomplete'); igual(p.autocomplete, true, 'autocomplete');
    pega('backup'); igual(p.reviver, 1, 'backup');
    pega('zeroday'); igual(p.critMult, 3, 'zeroday');
    Battle.iniciarAndar();
    igual(Battle.estado.escudo, 1, 'cache dá escudo no início do andar');
  });

  teste('upgrades: Autocomplete — 1ª letra pronta e digitá-la por hábito não é erro', () => {
    novaBatalha(0, { autocomplete: true });
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 999;
    afirmar(e.dig === 1 || e.texto.length <= 3, 'deveria começar na 2ª letra');
    if (e.dig === 1) {
      Battle.digitar(e.texto[0]);
      igual(n('erro'), 0, 'digitar a 1ª letra por hábito não é erro');
      digitar(e.texto.slice(1));
      igual(n('erro'), 0, 'resto da palavra');
    }
  });

  teste('upgrades: Corretor Ortográfico perdoa só o 1º erro', () => {
    novaBatalha(0, { perdoaErro: true });
    ateInimigos(1);
    const e = vivos()[0];
    Battle.digitar(e.texto[0]);
    Battle.estado.combo = 5;
    Battle.digitar('#');
    igual(Battle.estado.combo, 5, '1º erro perdoado');
    Battle.digitar('#');
    igual(Battle.estado.combo, 0, '2º erro zera');
  });

  teste('render: todos os andares, chefões, falas, glitch, café e escudo sem erro', () => {
    for (let k = 0; k < 9; k++) {
      novaBatalha(k, { maxHp: 1e6, hp: 1e6 });
      ateInimigos(1);
      Battle.estado.lento = 5;
      Battle.estado.escudo = 1;
      Battle.estado.alvo = vivos()[0];
      for (let i = 0; i < 5; i++) desenhar(i);
      ateChefe();
      Battle.estado.chefe.fala = 'TESTE DE FALA BEM COMPRIDA PARA VER O LIMITE DO BALÃO';
      Battle.estado.chefe.falaT = 2;
      for (let i = 0; i < 40; i++) desenhar(i * 0.1);
    }
  });

  // =====================================================================
  //  INTERFACE (fluxo real de telas, com teclado simulado)
  // =====================================================================
  const NICK30 = 'Hacker Supremo da Computação 1';
  const quadros = seg => { for (let t = 0; t < seg; t += 0.05) INVASAO._quadro(0.05, t); };

  teste('interface: título → nick inválido → nick de 30 caracteres → tutorial → batalha', async () => {
    Ranking.limpar();
    UI.irTitulo();
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'nick', 'estado após ENTER no título');
    await espera(700);
    $('nick-input').value = 'a';
    tecla('Enter');
    afirmar($('nick-error').textContent.length > 0, 'deveria mostrar erro de nick');
    igual(UI.estado, 'nick', 'continua no nick');
    $('nick-input').value = NICK30;
    tecla('Enter');
    igual(UI.estado, 'modo', 'nick de 30 caracteres aceito → escolha do modo');
    await espera(700);
    tecla('1');
    igual(UI.estado, 'tutorial', 'modo normal escolhido');
    igual(Battle.run.nick, NICK30, 'nick salvo');
    igual(Battle.run.modo, 'normal', 'modo da partida');
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'banner', 'banner do andar');
    await espera(3800);
    igual(UI.estado, 'batalha', 'batalha começou');
    quadros(0.5);
    const top = $('hud-top');
    afirmar(top.scrollWidth <= top.clientWidth + 1, `HUD estourou com nick longo (${top.scrollWidth} > ${top.clientWidth})`);
    afirmar($('hud-nick').offsetWidth <= 250, 'nick no HUD deveria ser cortado com reticências');
  });

  teste('interface: digitação pelo campo escondido (input, acento composto, NFD, colar bloqueado)', async () => {
    igual(UI.estado, 'batalha', 'pré-condição');
    const entrada = $('type-input');
    quadros(3);
    zerar();
    const e = vivos()[0];
    afirmar(e, 'precisa de um inimigo');
    e.hp = e.maxHp = 999;
    e.texto = 'ação'; e.dig = 0;
    Battle.soltarAlvo();
    const enviar = (valor, opts) => { entrada.value = valor; entrada.dispatchEvent(new InputEvent('input', Object.assign({ bubbles: true }, opts))); };
    enviar('a');
    igual(e.dig, 1, 'input simples');
    // tecla morta: durante a composição nada é processado
    entrada.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    enviar('´', { isComposing: true });
    igual(e.dig, 1, 'nada processado durante a composição');
    entrada.value = 'ç';
    entrada.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ç' }));
    igual(e.dig, 2, 'ç processado no fim da composição');
    enviar('', {});
    igual(e.dig, 2, 'input vazio depois da composição não duplica');
    enviar('ã'.normalize('NFD'));
    igual(e.dig, 3, 'ã em NFD (a + til combinante) é aceito');
    const colar = new Event('paste', { bubbles: true, cancelable: true });
    entrada.dispatchEvent(colar);
    afirmar(colar.defaultPrevented, 'colar deveria ser bloqueado');
    igual(n('erro'), 0, 'nenhum erro na sequência');
  });

  teste('interface: itens pelas teclas, ESC pausa, som liga/desliga, continuar', async () => {
    igual(UI.estado, 'batalha', 'pré-condição');
    Battle.run.inventario.cafe = 1;
    tecla('1');
    afirmar(Battle.estado.lento > 0, 'tecla 1 usa café');
    igual(Battle.run.inventario.cafe, 0, 'café consumido');
    tecla('Escape');
    igual(UI.estado, 'pausa', 'ESC pausa');
    await espera(700);
    tecla('2');
    igual($('pause-sound').textContent, '[2] Som: OFF', 'som desligado');
    tecla('2');
    igual($('pause-sound').textContent, '[2] Som: ON', 'som ligado');
    tecla('1');
    igual(UI.estado, 'batalha', 'continuar');
  });

  teste('interface: não dá para pausar durante a vitória ou a derrota', () => {
    const b = Battle.estado;
    const etapa = b.etapa;
    for (const et of ['vitoria', 'morte']) {
      b.etapa = et;
      tecla('Escape');
      igual(UI.estado, 'batalha', `não pausa em ${et}`);
    }
    b.etapa = etapa;
  });

  teste('interface: andar concluído → curiosidade → carta → loja → próximo andar', async () => {
    const b = Battle.estado;
    b.etapa = 'vitoria'; b.tempoEtapa = 0; b.avisou = false;
    quadros(3);
    igual(UI.estado, 'concluido', 'tela de andar concluído');
    afirmar($('clear-fact').textContent.length > 20, 'curiosidade sobre o curso');
    await espera(1000);
    tecla('Enter');
    igual(UI.estado, 'upgrade', 'cartas');
    igual(document.querySelectorAll('.card').length, 3, '3 cartas');
    await espera(700);
    tecla('1');
    await espera(700);
    igual(UI.estado, 'loja', 'loja');
    Battle.run.p.creditos = 100;
    await espera(700);
    tecla('1');
    igual(Battle.run.inventario.cafe, 1, 'comprou café');
    igual(Battle.run.p.creditos, 70, 'pagou 30');
    tecla('Enter');
    igual(UI.estado, 'banner', 'banner do próximo andar');
    igual(Battle.run.andar, 1, 'andar 2');
    await espera(3800);
  });

  teste('interface: desistir pela pausa salva no ranking e mostra fim → ranking → título', async () => {
    igual(UI.estado, 'batalha', 'pré-condição');
    tecla('Escape');
    await espera(700);
    tecla('3');
    igual(UI.estado, 'fim', 'tela de fim');
    const salvo = Ranking.carregar().find(r => r.nick === NICK30);
    afirmar(salvo, 'resultado salvo no ranking');
    igual(salvo.andar, 2, 'andar salvo');
    igual(salvo.total, 9, 'total de andares salvo');
    await espera(1600);
    tecla('Enter');
    igual(UI.estado, 'relatorio', 'relatório de desempenho');
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'ranking', 'tela de ranking');
    afirmar(document.querySelector('#rank-table tr.eu'), 'linha do jogador destacada');
    const tab = $('rank-table');
    afirmar(tab.scrollWidth <= tab.parentElement.clientWidth, 'tabela do ranking não pode estourar');
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'titulo', 'volta ao título');
    afirmar($('title-rank-normal').textContent.includes('Hacker'), 'nick aparece no top do modo normal no título');
  });

  teste('interface: visitante que abandona um menu → jogo volta sozinho', async () => {
    CONFIG.ociosoSeg = 1;
    UI.irTitulo();
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'nick', 'nick');
    await espera(2600);
    igual(UI.estado, 'titulo', 'nick abandonado volta ao título');
    UI.inicioDebug(1);
    await espera(3800);
    tecla('Escape');
    igual(UI.estado, 'pausa', 'pausado');
    await espera(2600);
    igual(UI.estado, 'fim', 'pausa abandonada encerra a partida');
    CONFIG.ociosoSeg = 99999;
  });

  teste('interface: ESPAÇO também inicia no título', async () => {
    UI.irTitulo();
    await espera(700);
    tecla(' ');
    igual(UI.estado, 'nick', 'espaço inicia');
    tecla('Escape');
  });

  // =====================================================================
  //  RODADA 2 — casos-limite e layout no pior caso
  // =====================================================================
  teste('nick: exige 2 letras/números e junta espaços repetidos', () => {
    for (const nk of ['..', '- -', '_.', 'a.', '  .  ']) afirmar(Nick.validar(nk) !== null, `"${nk}" deveria ser bloqueado`);
    igual(Nick.limpar('  Ana    Clara  '), 'Ana Clara', 'espaços');
    igual(Nick.validar('Ana' + ' '.repeat(40) + 'Clara'), null, 'espaços repetidos não contam para o limite');
  });

  const cabeNaTela = (el, nome) => {
    afirmar(el.offsetTop >= 0, `${nome}: começa acima da tela (${el.offsetTop}px)`);
    afirmar(el.offsetTop + el.offsetHeight <= ALTURA, `${nome}: termina abaixo da tela (${el.offsetTop + el.offsetHeight}px)`);
  };

  teste('layout: banners com todos os nomes de andar e de chefão cabem', () => {
    const el = $('banner');
    for (const [nome, chefe] of ANDARES.flatMap(A => [[A.nome, false], [A.chefe.nome, true]])) {
      el.className = chefe ? 'chefe' : '';
      $('banner-top').textContent = 'ANDAR 9/9';
      $('banner-title').textContent = nome;
      $('banner-sub').textContent = 'O último andar. O chefe final está esperando... e ele tem um prazo.';
      $('banner-tip').textContent = 'Use as teclas de acento: ´ + a = á   ~ + a = ã   ^ + e = ê   e a tecla ç';
      const t = $('banner-title');
      afirmar(t.scrollWidth <= t.clientWidth + 1, `"${nome}" estoura o banner`);
      afirmar(el.offsetTop + el.offsetHeight <= 440, `"${nome}": banner desce até o prompt (${el.offsetTop + el.offsetHeight}px)`);
    }
    el.classList.add('hidden');
  });

  teste('layout: HUD com nick de 30, andar de nome mais longo e números grandes', () => {
    UI.inicioDebug(8);
    Battle.run.nick = NICK30;
    Battle.run.pontos = 9999999;
    Battle.run.p.creditos = 99999;
    INVASAO._quadro(0.05, 0);
    const top = $('hud-top');
    afirmar(top.scrollWidth <= top.clientWidth + 1, `HUD estourou (${top.scrollWidth} > ${top.clientWidth})`);
    for (const id of ['hud-score', 'hud-cred']) {
      const el = $(id);
      afirmar(el.scrollWidth <= el.clientWidth + 1, `${id} cortado: números precisam aparecer inteiros`);
    }
  });

  teste('layout: a frase mais longa de chefão cabe no prompt sem cobrir o chefão', () => {
    const longa = ANDARES.flatMap(A => A.chefe.frases).sort((a, b) => b.length - a.length)[0];
    const original = Battle.prompt;
    Battle.prompt = () => ({ texto: longa, dig: 12, nome: 'x', ativo: true });
    try {
      INVASAO._quadro(0.05, 0);
      const pr = $('prompt');
      afirmar(pr.scrollWidth <= pr.clientWidth + 1, 'frase estoura o prompt na horizontal');
      afirmar(pr.offsetTop >= 400, `prompt sobe demais e cobre o chefão (topo em ${pr.offsetTop}px)`);
    } finally {
      Battle.prompt = original;
    }
  });

  teste('layout: palavra mais longa de cada andar cabe no rótulo do canvas', () => {
    const ctx = INVASAO._ctx;
    ctx.font = `26px ${FONTE}`;
    ANDARES.forEach((A, i) => {
      const maior = A.palavras.slice().sort((a, b) => b.length - a.length)[0];
      const w = [...maior].reduce((s, ch) => s + ctx.measureText(ch).width, 0);
      afirmar(w + 16 + 34 + 10 <= LARGURA, `andar ${i + 1}: "${maior}" (${Math.round(w)}px) não cabe`);
    });
  });

  teste('layout: todas as 14 cartas de upgrade cabem no cartão', async () => {
    const original = Battle.sortearCartas;
    try {
      for (let i = 0; i < UPGRADES.length; i += 3) {
        const grupo = UPGRADES.slice(i, i + 3);
        Battle.sortearCartas = () => grupo;
        UI.inicioDebug(1);
        await espera(3800);
        const b = Battle.estado;
        b.etapa = 'vitoria'; b.tempoEtapa = 0; b.avisou = false;
        quadros(3);
        await espera(1000);
        tecla('Enter');
        igual(UI.estado, 'upgrade', 'tela de cartas');
        document.querySelectorAll('.card').forEach((c, j) => {
          const desc = c.querySelector('.card-desc'), lvl = c.querySelector('.card-lvl');
          afirmar(c.scrollHeight <= c.clientHeight + 1, `carta "${grupo[j].nome}" transborda`);
          afirmar(desc.offsetTop + desc.offsetHeight <= lvl.offsetTop, `carta "${grupo[j].nome}": descrição encosta no nível`);
        });
        cabeNaTela($('cards'), 'cartas');
      }
    } finally {
      Battle.sortearCartas = original;
    }
  });

  teste('layout: fim de jogo e ranking cheio (nicks de 30, jogador fora do top 10) cabem', async () => {
    Ranking.limpar();
    for (let i = 0; i < 14; i++) {
      Ranking.adicionar({ nick: `${NICK30.slice(0, 27)} ${String(i).padStart(2, '0')}`, pontos: 99999 - i, andar: 9, venceu: i < 2, ppm: 120, precisao: 100 });
    }
    UI.inicioDebug(8);
    Battle.run.debug = false;
    Battle.run.nick = NICK30;
    await espera(3800);
    tecla('Escape');
    await espera(700);
    // pior caso do relatório: 9 andares no histórico, muitas teclas erradas, todas as conquistas
    const run = Battle.run;
    for (let i = 0; i < 8; i++) run.historico.push({ nome: ANDARES[i].nome, concluido: true, ppm: 40 + i * 9, precisao: 90 + i, tempo: 60 });
    'çãéêíóõú '.split('').forEach((ch, i) => { run.stats.errosTecla[ch] = 20 - i; });
    CONQUISTAS.forEach(c => run.conquistas.includes(c.id) || run.conquistas.push(c.id));
    tecla('3');
    igual(UI.estado, 'fim', 'tela de fim');
    cabeNaTela(document.querySelector('#screen-end .terminal-box'), 'tela de fim');
    await espera(1600);
    tecla('Enter');
    igual(UI.estado, 'relatorio', 'relatório');
    cabeNaTela(document.querySelector('#screen-report .terminal-box'), 'relatório no pior caso');
    igual(document.querySelectorAll('#rel-barras .rel-linha').length, 9, 'uma barra por andar');
    igual(document.querySelectorAll('#rel-conquistas .conq.on').length, CONQUISTAS.length, 'todas as conquistas acesas');
    await espera(700);
    tecla('Enter');
    igual(UI.estado, 'ranking', 'ranking');
    igual(document.querySelectorAll('#rank-table tr').length, 1 + 10 + 1 + 1, 'cabeçalho + top 10 + separador + jogador');
    cabeNaTela(document.querySelector('#screen-ranking .terminal-box'), 'ranking');
    const tab = $('rank-table');
    afirmar(tab.scrollWidth <= tab.parentElement.clientWidth, 'tabela estoura na horizontal');
    document.querySelectorAll('#rank-table td:nth-child(2)').forEach(td => {
      if (td.colSpan > 1) return;
      afirmar(td.scrollWidth <= td.clientWidth, `nick de 30 caracteres cortado no ranking: "${td.textContent}"`);
    });
    Ranking.limpar();
  });

  // =====================================================================
  //  RODADA 3 — desempenho
  // =====================================================================
  teste('desempenho: cena pesada roda sem erro (o tempo real é medido pelo validar.ps1)', () => {
    rodarCenaPesada(240);
  });

  // =====================================================================
  //  CONQUISTAS
  // =====================================================================
  teste('conquistas: 12 definições válidas e sem id repetido', () => {
    igual(CONQUISTAS.length, 12, 'quantidade');
    igual(new Set(CONQUISTAS.map(c => c.id)).size, 12, 'ids únicos');
    CONQUISTAS.forEach(c => afirmar(c.nome && c.icone && c.desc, `${c.id}: dados faltando`));
  });

  teste('conquistas: desbloqueiam uma vez só, dão bônus e aparecem na tela', async () => {
    const run = novaBatalha(0);
    const p0 = run.pontos;
    afirmar(Battle.conquista('primeiro'), 'deveria desbloquear');
    afirmar(!Battle.conquista('primeiro'), 'não pode desbloquear duas vezes');
    afirmar(!Battle.conquista('nao_existe'), 'id inválido é ignorado');
    igual(run.pontos - p0, CONFIG.bonusConquista, 'bônus de pontos');
    igual(n('conquista'), 1, 'evento uma vez');
    await espera(50);
    afirmar(!$('toast').classList.contains('hidden'), 'aviso na tela');
    afirmar($('toast').textContent.includes('Primeiro Commit'), 'nome no aviso');
  });

  teste('conquistas: avisos de uma partida não vazam para a próxima e rajadas passam rápido', async () => {
    novaBatalha(0);
    for (const id of ['chefe', 'limpo', 'intocavel', 'raiz', 'acentos', 'porumfio']) Battle.conquista(id);
    const t0 = performance.now();
    while (!$('toast').classList.contains('hidden') && performance.now() - t0 < 20000) await espera(200);
    const seg = (performance.now() - t0) / 1000;
    afirmar(seg <= 10, `6 avisos seguidos levaram ${seg.toFixed(1)} s (limite 10 s)`);
    Battle.conquista('combo10');
    Battle.conquista('combo20');
    UI.irTitulo();  // próximo visitante
    afirmar($('toast').classList.contains('hidden'), 'aviso some ao voltar ao título');
    novaBatalha(0);
    Battle.conquista('primeiro');
    await espera(50);
    afirmar($('toast').textContent.includes('Primeiro Commit'), 'o novo jogador vê a própria conquista');
    await espera(3000);
    afirmar($('toast').classList.contains('hidden'), 'sem avisos antigos depois');
  });

  teste('conquistas: primeiro inimigo, combo x10/x20 e investidor', () => {
    const run = novaBatalha(0, { crit: 0 });
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 1e6;
    for (let i = 0; i < 20; i++) { e.texto = 'cabos'; e.dig = 0; digitar('cabos'); }
    afirmar(run.conquistas.includes('combo10') && run.conquistas.includes('combo20'), 'combos');
    afirmar(!run.conquistas.includes('primeiro'), 'ainda não removeu ninguém');
    run.p.creditos = 195;
    e.hp = 1; e.texto = 'cabos'; e.dig = 0; digitar('cabos');
    afirmar(run.conquistas.includes('primeiro'), 'primeiro inimigo removido');
    afirmar(run.conquistas.includes('investidor'), '200 créditos');
  });

  teste('conquistas: chefão perfeito (limpo, intocável, raiz, acentos) e "por um fio"', () => {
    const run = novaBatalha(4, { maxHp: 1e6, hp: 1e6 });
    ateChefe();
    Battle.estado.chefe.hp = 1;
    digitar(Battle.estado.chefe.texto);
    for (const id of ['chefe', 'limpo', 'intocavel', 'raiz', 'acentos'])
      afirmar(run.conquistas.includes(id), `deveria ter "${id}"`);
    afirmar(!run.conquistas.includes('porumfio'), 'vida cheia não é "por um fio"');
    // agora o contrário: com erro, dano, item e vida baixa
    const r2 = novaBatalha(0, { maxHp: 100 });
    ateChefe();
    const c = Battle.estado.chefe;
    Battle.digitar('#');                         // erro
    c.atk = c.intervalo; Battle.atualizar(0.05); // dano
    r2.inventario.cafe = 1; Battle.usarItem(0);  // item
    r2.p.hp = 5;
    c.hp = 1;
    digitar(c.texto.slice(c.dig));
    afirmar(r2.conquistas.includes('porumfio'), 'menos de 10% de vida');
    for (const id of ['limpo', 'intocavel', 'raiz', 'acentos'])
      afirmar(!r2.conquistas.includes(id), `não deveria ter "${id}"`);
  });

  teste('conquistas: "Fibra Óptica" mede a velocidade real da frase do chefão', () => {
    const run = novaBatalha(0, { maxHp: 1e6, hp: 1e6, crit: 0 });
    ateChefe();
    const c = Battle.estado.chefe;
    c.hp = 1e6;
    // devagar: 1 letra a cada 0,5 s (24 ppm) → não ganha
    for (const ch of c.texto.slice(c.dig)) { Battle.digitar(ch); Battle.atualizar(0.5); }
    afirmar(!run.conquistas.includes('veloz'), 'devagar não ganha');
    // rápido: 1 letra a cada 0,1 s (120 ppm) → ganha
    for (const ch of c.texto.slice(c.dig)) { Battle.digitar(ch); Battle.atualizar(0.1); }
    afirmar(run.conquistas.includes('veloz'), 'rápido ganha');
  });

  // =====================================================================
  //  MODO RÁPIDO
  // =====================================================================
  teste('modo rápido: rota de 3 andares (Suporte, Banco de Dados, Diretoria) e menos inimigos', () => {
    UI.irTitulo();
    Battle.novaPartida('x', 'rapido');
    const run = Battle.run;
    igual(run.rota.join(','), '0,3,8', 'rota');
    igual(Battle.totalAndares(), 3, 'total');
    igual(run.andar, 0, 'começa no Suporte');
    Battle.iniciarAndar();
    igual(Battle.estado.restante, Math.round(ANDARES[0].inimigos * MODOS.rapido.fatorInimigos), 'menos inimigos');
    ateInimigos(1);
    igual(vivos()[0].maxHp, Math.round(ANDARES[0].hp * MODOS.rapido.fatorVida), 'inimigo com menos vida');
    ateChefe();
    igual(Battle.estado.chefe.maxHp, Math.round(ANDARES[0].chefe.hp * MODOS.rapido.fatorVida), 'chefão com menos vida');
    Battle.avancar();
    igual(run.andar, 3, '2º andar = Banco de Dados');
    igual(Battle.posicao(), 2, 'posição');
    afirmar(!Battle.ehUltimo(), 'ainda não é o último');
    Battle.avancar();
    igual(run.andar, 8, '3º andar = Diretoria');
    afirmar(Battle.ehUltimo(), 'último');
    Battle.novaPartida('x', 'qualquer-coisa');
    igual(Battle.run.modo, 'normal', 'modo inválido vira normal');
  });

  teste('modo rápido: partida completa pela interface até a vitória, com ranking próprio', async () => {
    Ranking.limpar();
    Ranking.adicionar({ nick: 'NoRankingNormal', pontos: 999999, andar: 9, total: 9, venceu: true, ppm: 90, precisao: 99, modo: 'normal' });
    UI.irTitulo();
    await espera(700);
    tecla('Enter');
    await espera(700);
    $('nick-input').value = 'Visitante Rápido';
    tecla('Enter');
    igual(UI.estado, 'modo', 'escolha do modo');
    await espera(700);
    tecla('2');
    igual(Battle.run.modo, 'rapido', 'modo rápido');
    await espera(700);
    tecla('Enter');
    for (let i = 0; i < 3; i++) {
      await espera(3800);
      igual(UI.estado, 'batalha', `batalha ${i + 1}`);
      quadros(0.1);
      igual($('hud-andar').textContent.startsWith(`RÁPIDO · ANDAR ${i + 1}/3`), true, `HUD mostra andar ${i + 1}/3`);
      const b = Battle.estado;
      b.etapa = 'vitoria'; b.tempoEtapa = 0; b.avisou = false;
      quadros(3);
      if (i < 2) {
        igual(UI.estado, 'concluido', 'andar concluído');
        await espera(1000); tecla('Enter');
        await espera(700); tecla('1');
        await espera(1300); tecla('Enter');
      }
    }
    igual(UI.estado, 'fim', 'fim de jogo');
    afirmar($('end-title').textContent.includes('RESTAURADO'), 'venceu');
    afirmar($('end-stats').textContent.includes('3/3'), 'andar 3/3');
    afirmar(Battle.run.conquistas.includes('zerou'), 'conquista "Sistema Restaurado"');
    const salvo = Ranking.carregar().find(r => r.nick === 'Visitante Rápido');
    igual(salvo.modo, 'rapido', 'ranking salvo no modo rápido');
    igual(salvo.total, 3, 'total 3');
    afirmar($('end-rank').textContent.includes('1º'), '1º lugar no rápido (o recorde do normal não conta)');
    await espera(1600); tecla('Enter');
    igual(UI.estado, 'relatorio', 'relatório');
    igual(document.querySelectorAll('#rel-barras .rel-linha').length, 3, '3 andares no relatório');
    await espera(700); tecla('Enter');
    igual(UI.estado, 'ranking', 'ranking');
    afirmar($('rank-title').textContent.includes('RÁPIDO'), 'ranking do modo rápido');
    afirmar(!$('rank-table').textContent.includes('NoRankingNormal'), 'ranking do rápido não mostra o normal');
    await espera(700); tecla('Enter');
    afirmar($('title-rank-rapido').textContent.includes('Visitante'), 'título mostra o top do rápido');
    afirmar($('title-rank-normal').textContent.includes('NoRankingNormal'), 'título mostra o top do normal');
    Ranking.limpar();
  });

  // =====================================================================
  //  RELATÓRIO DE DESEMPENHO
  // =====================================================================
  teste('relatório: velocidade por andar, teclas mais erradas, acentos e análise', async () => {
    const run = novaBatalha(4, { maxHp: 1e6, hp: 1e6 });
    run.debug = true;
    ateInimigos(1);
    const e = vivos()[0];
    e.hp = e.maxHp = 1e6;
    e.texto = 'ação'; e.dig = 0;
    Battle.digitar('a'); Battle.digitar('c'); Battle.digitar('c'); Battle.digitar('ç');
    Battle.digitar('a'); Battle.digitar('ã'); Battle.digitar('o');
    igual(run.stats.errosTecla['ç'], 2, 'erros no ç');
    igual(run.stats.errosTecla['ã'], 1, 'erros no ã');
    igual(run.stats.acentoOk, 2, 'acentos certos');
    igual(run.stats.acentoErro, 3, 'acentos errados');
    simular(30);
    run.p.hp = 0;
    UI.irTitulo();
    Battle.estado.etapa = 'morte';
    Battle.estado.avisou = false; Battle.estado.tempoEtapa = 0;
    Battle.atualizar(2.5);
    igual(UI.estado, 'fim', 'fim de jogo');
    igual(run.historico.length, 1, 'andar registrado uma vez');
    afirmar(run.historico[0].ppm >= 0 && run.historico[0].precisao > 0, 'números do andar');
    await espera(1600); tecla('Enter');
    igual(UI.estado, 'relatorio', 'relatório');
    igual($('rel-teclas').querySelector('.chip').textContent.trim()[0], 'ç', 'tecla mais errada primeiro');
    afirmar($('rel-insight').textContent.includes('acentos'), 'análise aponta os acentos');
    afirmar($('rel-resumo').textContent.includes('40%'), 'precisão nos acentos 2/5 = 40%');
  });

  // =====================================================================
  //  PAINEL DO ORGANIZADOR
  // =====================================================================
  const ctrlO = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));

  teste('painel: só abre no título, com Ctrl+Shift+O e o PIN certo', async () => {
    UI.irTitulo();
    await espera(700);
    tecla('Enter');
    await espera(700);
    ctrlO();
    igual(UI.estado, 'nick', 'não abre fora do título');
    UI.irTitulo();
    await espera(700);
    tecla('O');
    igual(UI.estado, 'titulo', 'O sozinho não abre');
    ctrlO();
    igual(UI.estado, 'pin', 'pede o PIN');
    await espera(700);
    $('pin-input').value = '0000';
    tecla('Enter');
    igual(UI.estado, 'pin', 'PIN errado não entra');
    afirmar($('pin-error').textContent.includes('incorreto'), 'mensagem de PIN errado');
    $('pin-input').value = CONFIG.pinOrganizador;
    tecla('Enter');
    igual(UI.estado, 'painel', 'PIN certo entra');
    cabeNaTela(document.querySelector('#screen-panel .terminal-box'), 'painel');
  });

  teste('painel: modo fixo, som e volume ficam salvos e são aplicados', async () => {
    igual(UI.estado, 'painel', 'pré-condição');
    await espera(700);
    tecla('1');
    igual(CONFIG.modoFixo, 'normal', '1º toque: sempre normal');
    tecla('1');
    igual(CONFIG.modoFixo, 'rapido', '2º toque: sempre rápido');
    igual(Ajustes.carregar().modoFixo, 'rapido', 'salvo');
    const som = Sound.ligado;
    tecla('2');
    igual(Sound.ligado, !som, 'som alternado');
    igual(Ajustes.carregar().som, !som, 'som salvo');
    tecla('2');
    const v0 = Sound.volume;
    tecla('3');
    afirmar(Sound.volume !== v0, 'volume mudou');
    igual(Ajustes.carregar().volume, Sound.volume, 'volume salvo');
    // com modo fixo "rápido", o jogador nem vê a escolha de modo
    tecla('Escape');
    igual(UI.estado, 'titulo', 'ESC volta ao título');
    await espera(700);
    tecla('Enter');
    await espera(700);
    $('nick-input').value = 'Fila Grande';
    tecla('Enter');
    igual(UI.estado, 'tutorial', 'pulou a escolha de modo');
    igual(Battle.run.modo, 'rapido', 'partida no modo fixo');
    CONFIG.modoFixo = null;
    Ajustes.salvar({ modoFixo: null, som: somOriginal, volume: volumeOriginal });
    // ajustes corrompidos não quebram
    localStorage.setItem(Ajustes.CHAVE, '{"modoFixo":"hack","volume":7,"som":"sim"}');
    const a = Ajustes.carregar();
    afirmar(a.modoFixo === null && a.volume === 0.75 && a.som === true, 'ajustes corrompidos viram o padrão');
  });

  teste('painel: exportar CSV para o Excel e apagar ranking só com confirmação', async () => {
    Ranking.limpar();
    Ranking.adicionar({ nick: 'Ana; "A"', pontos: 10, andar: 1, total: 9, venceu: false, ppm: 10, precisao: 50, modo: 'normal', conquistas: ['primeiro'] });
    Ranking.adicionar({ nick: 'Bruno', pontos: 20, andar: 3, total: 3, venceu: true, ppm: 30, precisao: 90, modo: 'rapido', conquistas: [] });
    const csv = UI.gerarCsv();
    igual(csv.charCodeAt(0), 0xFEFF, 'BOM para o Excel reconhecer os acentos');
    const linhas = csv.slice(1).split(String.fromCharCode(13, 10));
    igual(linhas.length, 3, 'cabeçalho + 2 linhas');
    afirmar(linhas[0].startsWith('posicao;nick;pontos;modo'), 'cabeçalho com ;');
    afirmar(linhas[1].startsWith('1;Bruno;20;rapido;3;3;sim'), 'linha do Bruno');
    afirmar(linhas[2].includes('"Ana; ""A"""'), 'campo com ; e aspas é protegido');
    // exportar pelo painel (o download é interceptado)
    const clickOriginal = HTMLAnchorElement.prototype.click;
    let baixado = null;
    HTMLAnchorElement.prototype.click = function () { baixado = this.download; };
    try {
      UI.irTitulo(); await espera(700); ctrlO(); await espera(700);
      $('pin-input').value = CONFIG.pinOrganizador; tecla('Enter');
      afirmar($('painel-stats').textContent.includes('2 (normal 1 · rápido 1)'), 'estatísticas do dia');
      afirmar($('painel-stats').textContent.includes('Bruno · 20'), 'líder do rápido');
      afirmar($('painel-stats').textContent.includes('Ana; "A" · 10'), 'líder do normal (os modos não se misturam)');
      await espera(700);
      tecla('4');
      afirmar(baixado && /^ranking-invasao-\d{4}-\d{2}-\d{2}\.csv$/.test(baixado), `arquivo exportado: ${baixado}`);
    } finally {
      HTMLAnchorElement.prototype.click = clickOriginal;
    }
    tecla('5');
    igual(Ranking.carregar().length, 2, '1º toque no 5 só pede confirmação');
    afirmar($('painel-msg').textContent.includes('certeza'), 'pede confirmação');
    tecla('5');
    igual(Ranking.carregar().length, 0, '2º toque apaga');
    tecla('Escape');
  });

  teste('layout: escolha de modo, tutorial e aviso de conquista cabem na tela', async () => {
    UI.irTitulo(); await espera(700); tecla('Enter'); await espera(700);
    $('nick-input').value = 'Layout'; tecla('Enter');
    igual(UI.estado, 'modo', 'tela de modo');
    cabeNaTela($('modos'), 'cartões de modo');
    await espera(700); tecla('1');
    cabeNaTela(document.querySelector('#screen-tutorial .terminal-box'), 'tutorial');
    const t = $('toast');
    t.classList.remove('hidden');
    t.innerHTML = '<b>9/9</b><div><small>★ CONQUISTA DESBLOQUEADA · +300</small>Multithread Humano<i>Digite uma frase de chefão a 60 ppm ou mais.</i></div>';
    afirmar(t.offsetLeft - t.offsetWidth / 2 >= 0 && t.offsetLeft + t.offsetWidth / 2 <= LARGURA, 'aviso dentro da tela');
    t.classList.add('hidden');
  });

  // =====================================================================
  //  RODADA 11 — conteúdo: toda conquista de habilidade é alcançável
  // =====================================================================
  // Um jogador perfeito (sem erros, 20 letras/s, sem comprar nada) joga a partida inteira
  function jogadorPerfeito(modo) {
    UI.irTitulo();
    Battle.novaPartida('perfeito', modo);
    const run = Battle.run;
    run.debug = true;
    run.p.maxHp = run.p.hp = 1e6;
    for (let k = 0; k < run.rota.length; k++) {
      Battle.iniciarAndar();
      zerar();
      const fim = simular(900, () => { botTecla(); return n('andarConcluido') > 0; });
      afirmar(fim, `${modo}: andar ${k + 1} não terminou`);
      if (k < run.rota.length - 1) Battle.avancar();
    }
    return run;
  }

  teste('conteúdo: no modo rápido, um jogador perfeito alcança as conquistas de habilidade', () => {
    const run = jogadorPerfeito('rapido');
    for (const id of ['primeiro', 'combo10', 'combo20', 'chefe', 'limpo', 'raiz', 'acentos', 'veloz', 'investidor', 'zerou'])
      afirmar(run.conquistas.includes(id), `modo rápido: "${id}" ficou impossível`);
    afirmar(run.stats.maiorCombo >= 20, `maior combo ${run.stats.maiorCombo}`);
  });

  teste('conteúdo: no modo normal, um jogador perfeito também alcança todas as de habilidade', () => {
    const run = jogadorPerfeito('normal');
    for (const id of ['primeiro', 'combo10', 'combo20', 'chefe', 'limpo', 'raiz', 'acentos', 'veloz', 'investidor', 'zerou'])
      afirmar(run.conquistas.includes(id), `modo normal: "${id}" ficou impossível`);
  });

  teste('conteúdo: o combo continua de um andar para o outro, mas zera numa partida nova', () => {
    novaBatalha(0);
    Battle.estado.combo = 7;
    Battle.registrarAndar(true);
    Battle.avancar();
    Battle.iniciarAndar();
    igual(Battle.estado.combo, 7, 'combo levado para o próximo andar');
    Battle.novaPartida('outro', 'normal');
    Battle.iniciarAndar();
    igual(Battle.estado.combo, 0, 'nova partida começa do zero');
  });

  // =====================================================================
  //  RODADA 10 — robustez
  // =====================================================================
  teste('robustez: navegador sem armazenamento (anônimo/disco cheio) — o jogo segue até o fim', async () => {
    const setOriginal = Storage.prototype.setItem, getOriginal = Storage.prototype.getItem;
    let erros = 0;
    const capturar = () => { erros++; };
    window.addEventListener('error', capturar);
    Storage.prototype.setItem = () => { throw new DOMException('cheio', 'QuotaExceededError'); };
    Storage.prototype.getItem = () => { throw new DOMException('negado', 'SecurityError'); };
    try {
      UI.irTitulo();
      igual(UI.estado, 'titulo', 'título abre');
      await espera(700); tecla('Enter'); await espera(700);
      $('nick-input').value = 'Sem Disco'; tecla('Enter');
      await espera(700); tecla('2');
      await espera(700); tecla('Enter');
      await espera(3800);
      igual(UI.estado, 'batalha', 'batalha começa');
      tecla('Escape'); await espera(700); tecla('3');
      igual(UI.estado, 'fim', 'fim de jogo mesmo sem conseguir salvar');
      await espera(1600); tecla('Enter');
      igual(UI.estado, 'relatorio', 'relatório');
      await espera(700); tecla('Enter');
      igual(UI.estado, 'ranking', 'ranking (vazio) abre');
      await espera(700); tecla('Enter');
      await espera(700);  // trava de 600 ms da tela título
      ctrlO(); await espera(700);
      $('pin-input').value = CONFIG.pinOrganizador; tecla('Enter');
      await espera(700); tecla('1'); tecla('3');
      igual(UI.estado, 'painel', 'painel funciona sem salvar ajustes');
      igual(erros, 0, 'nenhum erro de JavaScript');
    } finally {
      Storage.prototype.setItem = setOriginal;
      Storage.prototype.getItem = getOriginal;
      window.removeEventListener('error', capturar);
      CONFIG.modoFixo = null;
      UI.irTitulo();
    }
  });

  teste('robustez: ranking com 1000 jogadores — ordem, posição e tela continuam certas', async () => {
    const lista = [];
    for (let i = 0; i < 1000; i++) lista.push({ id: i, nick: `Jogador ${i}`, pontos: 1000 - i, andar: 1, total: 9, modo: 'normal', venceu: false, ppm: 30, precisao: 90, conquistas: [] });
    localStorage.setItem(Ranking.CHAVE, JSON.stringify(lista));
    const r = Ranking.adicionar({ nick: 'No Meio', pontos: 500.4, andar: 2, total: 9, modo: 'normal', venceu: false, ppm: 40, precisao: 95 });
    igual(r.posicao, 501, 'posição no meio de 1000');
    igual(Ranking.carregar().length, 1000, 'limite de 1000 registros mantido');
    igual(Ranking.top(1, 'normal')[0].nick, 'Jogador 0', 'líder');
    UI.irTitulo();
    afirmar($('title-rank-normal').textContent.includes('Jogador 0'), 'título com top 3');
    Ranking.limpar();
  });

  teste('robustez: Ctrl+Shift+O é "consumido" (o navegador não abre os favoritos por cima do jogo)', async () => {
    UI.irTitulo();
    await espera(700);
    const ev = new KeyboardEvent('keydown', { key: 'O', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    afirmar(ev.defaultPrevented, 'preventDefault no atalho do painel');
    tecla('Escape');
  });

  teste('robustez: ENTER ou número apertado duas vezes seguidas não pula telas', async () => {
    novaBatalha(0);
    Battle.estado.etapa = 'morte'; Battle.estado.tempoEtapa = 0; Battle.estado.avisou = false;
    Battle.atualizar(2.5);
    igual(UI.estado, 'fim', 'fim');
    await espera(1600);
    tecla('Enter'); tecla('Enter');
    igual(UI.estado, 'relatorio', 'o 2º ENTER não pula o relatório');
    // carta escolhida com "1" duplo não compra item na loja
    UI.inicioDebug(1);
    Battle.run.p.creditos = 500;
    await espera(3800);
    const b = Battle.estado;
    b.etapa = 'vitoria'; b.tempoEtapa = 0; b.avisou = false;
    quadros(3);
    await espera(1000); tecla('Enter');
    await espera(700);
    tecla('1');
    await espera(550);  // a loja abre aos 500 ms; o "1" repetido chega logo depois
    igual(UI.estado, 'loja', 'loja aberta');
    tecla('1');
    igual(Battle.run.inventario.cafe, 0, 'o "1" duplicado não comprou nada');
  });

  // =====================================================================
  //  RODADA 4 — "teclado esmagado" (fuzz): teclas aleatórias em todas as telas
  // =====================================================================
  teste('fuzz: 3000 teclas aleatórias em todas as telas sem erro, sem estado inválido e sem trapaça', async () => {
    const ESTADOS = ['titulo', 'nick', 'modo', 'tutorial', 'banner', 'batalha', 'pausa', 'concluido', 'upgrade',
      'escolhendo', 'loja', 'fim', 'relatorio', 'ranking'];
    const TECLAS = [...'abcdefghijklmnopqrstuvwxyzáéíóúâêôãõç ,.!?:*-', 'Enter', 'Enter', 'Escape', 'Backspace',
      '1', '2', '3', '4', '5', '0', 'Tab', 'Dead', 'Shift', 'F5', 'ArrowUp', ' '];
    const NICKS = ['Ana', 'porra', '..', 'Computação', 'x'.repeat(31), '<b>oi</b>', 'Visitante 07'];
    let s = 20261017;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    let erros = 0;
    const capturar = () => { erros++; };
    window.addEventListener('error', capturar);
    CONFIG.ociosoSeg = 4;  // também exercita o vigia de inatividade
    const entrada = $('type-input');
    const visitados = new Set();
    try {
      UI.irTitulo();
      for (let i = 0; i < 3000; i++) {
        const k = pick(TECLAS);
        if (UI.estado === 'nick' && rnd() < 0.3) $('nick-input').value = pick(NICKS);
        tecla(k);
        if (k.length === 1 && UI.estado === 'batalha') {
          entrada.value = k;
          entrada.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        // de vez em quando acerta de propósito, para a partida avançar
        if (UI.estado === 'batalha' && rnd() < 0.5) botTecla();
        // a cada ~150 passos força uma vitória, para o fuzz também martelar cartas e loja
        if (UI.estado === 'batalha' && i % 150 === 75) {
          const b = Battle.estado;
          if (b.etapa === 'ondas' || b.etapa === 'chefe') { b.etapa = 'vitoria'; b.tempoEtapa = 0; b.avisou = false; }
        }
        INVASAO._quadro(0.05, i * 0.05);
        visitados.add(UI.estado);
        afirmar(ESTADOS.includes(UI.estado), `estado inválido: ${UI.estado}`);
        const run = Battle.run;
        if (run) {
          afirmar(run.p.hp <= run.p.maxHp, 'vida acima do máximo');
          afirmar(run.p.creditos >= 0, 'créditos negativos');
          afirmar(Object.values(run.inventario).every(q => q >= 0 && q <= ITEM_MAX), 'inventário fora do limite');
          afirmar(Number.isFinite(run.pontos) && run.pontos >= 0, 'pontuação inválida');
        }
        if (i % 15 === 0) await espera(250);
      }
      igual(erros, 0, 'erros de JavaScript durante o fuzz');
      const faltando = ESTADOS.filter(e => !visitados.has(e));
      afirmar(faltando.length <= 1, `o fuzz não passou pelas telas: ${faltando.join(', ')}`);
      UI.irTitulo();
      igual(UI.estado, 'titulo', 'o jogo volta ao normal depois do fuzz');
      Ranking.carregar().forEach(r => afirmar(Nick.validar(r.nick) === null, `nick inválido entrou no ranking: "${r.nick}"`));
      console.info(`[INVASAO] fuzz visitou: ${[...visitados].join(', ')}`);
    } finally {
      window.removeEventListener('error', capturar);
      CONFIG.ociosoSeg = 99999;
    }
  });

  // =====================================================================
  //  EXECUÇÃO
  // =====================================================================
  const painel = document.createElement('div');
  painel.id = 'resultado-testes';
  painel.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#000;color:#39ff14;font:16px Consolas,monospace;padding:16px';
  document.body.appendChild(painel);
  const linha = (txt, cor) => {
    const d = document.createElement('div');
    d.textContent = txt;
    if (cor) d.style.color = cor;
    painel.appendChild(d);
  };
  linha('INVASÃO.EXE — bateria de testes automatizados', '#fff');

  let ok = 0;
  const falhas = [];
  for (const t of testes) {
    try {
      await t.fn();
      ok++;
      linha(`[OK]     ${t.nome}`);
    } catch (err) {
      falhas.push(t.nome);
      linha(`[FALHOU] ${t.nome} :: ${err.message}`, '#ff3355');
      console.error(t.nome, err);
    } finally {
      Math.random = rngOriginal;
    }
  }

  // restaura tudo
  if (backupRanking === null) localStorage.removeItem(Ranking.CHAVE);
  else localStorage.setItem(Ranking.CHAVE, backupRanking);
  if (backupAjustes === null) localStorage.removeItem(Ajustes.CHAVE);
  else localStorage.setItem(Ajustes.CHAVE, backupAjustes);
  Object.assign(CONFIG, configOriginal);
  Sound.definirLigado(somOriginal);
  Sound.definirVolume(volumeOriginal);
  UI.irTitulo();

  const resumo = `RESULTADO: ${ok}/${testes.length} testes OK` + (falhas.length ? ` — ${falhas.length} FALHA(S)` : ' — TUDO CERTO');
  linha(resumo, falhas.length ? '#ff3355' : '#fff');
  painel.dataset.ok = ok;
  painel.dataset.total = testes.length;
  document.title = resumo;
  console.log(resumo);
})();
