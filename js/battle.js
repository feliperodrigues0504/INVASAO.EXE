// =====================================================================
//  Batalha: inimigos, digitação, dano, chefões e itens.
//  A interface (ui.js) escuta os eventos emitidos aqui.
// =====================================================================

const Battle = (() => {
  // Posições (centro x, "pé" y) — o canvas tem 960x540
  const SLOTS = [{ x: 520, y: 400 }, { x: 700, y: 270 }, { x: 850, y: 405 }];
  const SLOTS_CHEFE = [{ x: 430, y: 335 }, { x: 480, y: 215 }];
  const POS_CHEFE = { x: 700, y: 380 };
  const POS_JOGADOR = { x: 150, y: 400 };

  let run = null;  // dados da partida inteira
  let b = null;    // estado do andar atual

  // ---------------- eventos ----------------
  const ouvintes = {};
  const on = (ev, fn) => { (ouvintes[ev] = ouvintes[ev] || []).push(fn); };
  const emit = (ev, ...args) => (ouvintes[ev] || []).forEach(fn => fn(...args));
  const log = (msg, cor) => emit('log', msg, cor);

  const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const temAcento = ch => !!ch && ch.normalize('NFD').length > 1;
  const sortear = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------------- partida / andar ----------------
  function novaPartida(nick, modo) {
    modo = MODOS[modo] ? modo : 'normal';
    const p = Object.assign({}, JOGADOR_BASE);
    p.maxHp = p.hp;
    const rota = MODOS[modo].rota.slice();
    run = {
      nick, p, modo, rota, passo: 0, andar: rota[0], pontos: 0, venceu: false,
      inventario: { cafe: 0, patch: 0, antivirus: 0, escudo: 0 },
      upgrades: {},
      conquistas: [],   // ids desbloqueados nesta partida
      historico: [],    // um registro por andar jogado (para o relatório de desempenho)
      stats: { acertos: 0, erros: 0, tempo: 0, palavras: 0, maiorCombo: 0, abates: 0,
        errosTecla: {}, acentoOk: 0, acentoErro: 0 },
    };
    return run;
  }

  // ---------------- rota de andares (modo normal = 9, rápido = 3) ----------------
  const totalAndares = () => run.rota.length;
  const posicao = () => run.passo + 1;
  const ehUltimo = () => run.passo >= run.rota.length - 1;
  function avancar() { run.passo++; run.andar = run.rota[run.passo]; }
  // usado pelo modo de teste ?andar=N (rota normal)
  function irParaAndar(idx) { run.passo = Math.max(0, Math.min(run.rota.length - 1, idx)); run.andar = run.rota[run.passo]; }

  function iniciarAndar() {
    const A = ANDARES[run.andar];
    b = {
      A, inimigos: [], restante: Math.max(2, Math.round(A.inimigos * MODOS[run.modo].fatorInimigos)),
      cooldown: 0.8, etapa: 'ondas', tempoEtapa: 0,
      // o combo continua de um andar para o outro (no modo rápido, 1 andar não tem palavras para x20)
      alvo: null, combo: run.comboSalvo || 0, escudo: run.p.escudoInicial, lento: 0, chefe: null,
      tempoInvocar: 0, recentes: [], avisou: false, registrado: false,
      stats: { abates: 0, acertos: 0, erros: 0, inicioPontos: run.pontos, tempo: 0, danoRecebido: 0, itensUsados: 0 },
    };
    FX.limpar();
  }

  // ---------------- conquistas ----------------
  function conquista(id) {
    if (!run || run.conquistas.includes(id)) return false;
    const def = CONQUISTAS.find(c => c.id === id);
    if (!def) return false;
    run.conquistas.push(id);
    run.pontos += CONFIG.bonusConquista;
    log(`> [★] conquista: ${def.nome} (+${CONFIG.bonusConquista})`, '#ffd700');
    emit('conquista', def);
    return true;
  }

  // Guarda os números do andar atual para o relatório de desempenho (uma vez por andar)
  function registrarAndar(concluido) {
    if (!b || b.registrado) return;
    b.registrado = true;
    run.comboSalvo = concluido ? b.combo : 0;
    const s = b.stats;
    const total = s.acertos + s.erros;
    run.historico.push({
      nome: b.A.nome, concluido: !!concluido,
      ppm: s.tempo > 1 ? Math.round(s.acertos / 5 / (s.tempo / 60)) : 0,
      precisao: total ? Math.round(s.acertos / total * 100) : 0,
      tempo: Math.round(s.tempo),
    });
  }

  // ---------------- criação de inimigos ----------------
  function baseInimigo(extra) {
    return Object.assign({
      dig: 0, erros: 0, imperfeito: false, atk: 0, intervalo: 5, flash: 0, tremor: 0,
      investida: 0, nascendo: 0.5, morrendo: false, morteT: 0, bob: Math.random() * 6,
      fala: null, falaT: 0,
    }, extra);
  }

  function slotLivre(slots, limite) {
    for (let i = 0; i < Math.min(limite, slots.length); i++) {
      if (!b.inimigos.some(e => !e.chefe && e.slot === i)) return i;
    }
    return -1;
  }

  function criarInimigo(slots, slot, fracoHp) {
    const A = b.A;
    const tipo = TIPOS_INIMIGO[sortear(A.tipos)];
    const spr = Sprites.get(tipo.sprite, 6, { A: A.cores[0], B: A.cores[1] });
    const hp = Math.round(A.hp * (fracoHp || 1) * MODOS[run.modo].fatorVida);
    const e = baseInimigo({
      chefe: false, nome: tipo.arquivo, spr, slot, x: slots[slot].x, y: slots[slot].y,
      hp, maxHp: hp, dano: A.dano, recompensa: Math.round(A.recompensa * (fracoHp || 1)),
    });
    b.inimigos.push(e);
    novoTexto(e);
    e.atk = -0.6; // pequena folga ao aparecer
    return e;
  }

  function criarChefe() {
    const C = b.A.chefe;
    const hp = Math.round(C.hp * MODOS[run.modo].fatorVida);
    const e = baseInimigo({
      chefe: true, nome: C.arquivo, titulo: C.nome, spr: Sprites.get(C.sprite, 7),
      x: POS_CHEFE.x, y: POS_CHEFE.y, hp, maxHp: hp, dano: C.dano,
      recompensa: C.recompensa, intervaloBase: C.intervalo, frases: C.frases, fraseIdx: 0,
      metade: false, truque: C.truque, nascendo: 1.2,
    });
    b.chefe = e;
    b.inimigos.push(e);
    novoTexto(e);
    e.atk = -2;
    falar(e, C.falas.intro);
    log(`> [!] ${C.arquivo} em execução`, '#ff3355');
    Sound.tocarMusica('chefe');
  }

  // Próxima letra que o jogador precisa digitar para "mirar" no texto
  const inicioTexto = txt => (run.p.autocomplete && txt.length > 3 && txt[1] !== ' ') ? 1 : 0;

  function novoTexto(e) {
    if (e.chefe) {
      e.texto = e.frases[e.fraseIdx % e.frases.length];
      e.fraseIdx++;
    } else {
      // evita repetir palavras e evita que dois inimigos comecem com a mesma letra
      const proximas = b.inimigos.filter(o => o !== e && !o.morrendo && o.texto)
        .map(o => semAcento(o.texto[o.dig] || ''));
      const livre = w => !proximas.includes(semAcento(w[inicioTexto(w)]));
      const palavras = b.A.palavras;
      let cands = palavras.filter(w => livre(w) && !b.recentes.includes(w));
      if (!cands.length) cands = palavras.filter(livre);
      if (!cands.length) cands = palavras;
      e.texto = sortear(cands);
      b.recentes.push(e.texto);
      if (b.recentes.length > 10) b.recentes.shift();
    }
    e.dig = inicioTexto(e.texto);
    e.erros = 0;
    e.imperfeito = false;
    e.t0 = null;
    calcularIntervalo(e);
  }

  function calcularIntervalo(e) {
    if (e.chefe) {
      let i = e.intervaloBase;
      if (e.metade) i *= 0.85;
      if (e.truque === 'acelerar') i *= 0.6 + 0.4 * (e.hp / e.maxHp);
      e.intervalo = i;
    } else {
      e.intervalo = b.A.atkBase + e.texto.length * b.A.porLetra;
    }
  }

  function falar(e, txt) { e.fala = txt; e.falaT = 3; }

  // ---------------- loop ----------------
  function atualizar(dt) {
    if (!b) return;
    b.tempoEtapa += dt;
    const emCombate = b.etapa === 'ondas' || b.etapa === 'chefe';
    if (emCombate) { run.stats.tempo += dt; b.stats.tempo += dt; }
    if (b.lento > 0) b.lento -= dt;

    switch (b.etapa) {
      case 'ondas': {
        b.cooldown -= dt;
        const vivos = b.inimigos.filter(e => !e.morrendo).length;
        if (b.restante > 0 && b.cooldown <= 0 && vivos < b.A.maxTela) {
          const slot = slotLivre(SLOTS, b.A.maxTela);
          if (slot >= 0) {
            criarInimigo(SLOTS, slot);
            b.restante--;
            b.cooldown = 0.9 + Math.random() * 0.9;
          }
        }
        if (b.restante === 0 && b.inimigos.length === 0) {
          b.etapa = 'alerta'; b.tempoEtapa = 0;
          Sound.pararMusica();
          Sound.sfx.alerta();
          emit('alertaChefe', b.A.chefe);
        }
        break;
      }
      case 'alerta':
        if (b.tempoEtapa > 3.2) { b.etapa = 'chefe'; b.tempoEtapa = 0; criarChefe(); }
        break;
      case 'chefe':
        if (b.chefe && b.chefe.truque === 'invocar' && !b.chefe.morrendo) {
          b.tempoInvocar += dt;
          const minions = b.inimigos.filter(e => !e.chefe && !e.morrendo).length;
          if (b.tempoInvocar > 10 && minions < 2) {
            const slot = slotLivre(SLOTS_CHEFE, 2);
            if (slot >= 0) {
              criarInimigo(SLOTS_CHEFE, slot, 0.5);
              b.tempoInvocar = 0;
              falar(b.chefe, sortear(['REFORÇOS!', 'ATAQUEM!', 'MAIS PROCESSOS!']));
            }
          }
        }
        break;
      case 'vitoria':
        if (b.tempoEtapa > 2.4 && !b.avisou) { b.avisou = true; emit('andarConcluido'); }
        break;
      case 'morte':
        if (b.tempoEtapa > 2 && !b.avisou) { b.avisou = true; emit('gameOver'); }
        break;
    }

    const fatorVel = (b.lento > 0 ? 0.4 : 1) * run.p.velInimigos;
    for (let i = b.inimigos.length - 1; i >= 0; i--) {
      const e = b.inimigos[i];
      e.flash = Math.max(0, e.flash - dt);
      e.tremor = Math.max(0, e.tremor - dt);
      e.investida = Math.max(0, e.investida - dt);
      e.nascendo = Math.max(0, e.nascendo - dt);
      if (e.falaT > 0) e.falaT -= dt;
      if (e.morrendo) {
        e.morteT += dt;
        if (e.morteT > 0.15) b.inimigos.splice(i, 1);
        continue;
      }
      // a etapa é conferida a cada inimigo: se um ataque matar o jogador,
      // os próximos inimigos do mesmo quadro não podem atacar de novo
      if ((b.etapa === 'ondas' || b.etapa === 'chefe') && e.nascendo <= 0) {
        e.atk += dt * fatorVel;
        if (e.atk >= e.intervalo) { e.atk = 0; atacar(e); }
      }
    }
  }

  // ---------------- digitação ----------------
  function compara(c, esperado) {
    if (!esperado) return false;
    const e = esperado.toLowerCase();
    if (c === e) return 'exato';
    if (b.A.acentos === 'leniente' && semAcento(c) === semAcento(e)) return 'leniente';
    return false;
  }

  function podeDigitar() { return b && (b.etapa === 'ondas' || b.etapa === 'chefe'); }

  function digitar(ch) {
    if (!podeDigitar()) return;
    const c = ch.toLowerCase();
    let alvo = b.alvo;
    if (alvo && (alvo.morrendo || !b.inimigos.includes(alvo))) alvo = b.alvo = null;

    if (!alvo) {
      if (c === ' ') return; // espaço sem alvo não conta como erro
      const cands = b.inimigos.filter(e => !e.morrendo && compara(c, e.texto[e.dig]));
      if (!cands.length) {
        // com Autocomplete a 1ª letra já vem pronta; digitá-la por hábito só escolhe o alvo
        const habito = run.p.autocomplete && b.inimigos.find(e => !e.morrendo && e.dig === 1
          && inicioTexto(e.texto) === 1 && compara(c, e.texto[0]));
        if (habito) { b.alvo = habito; return; }
        erro(null);
        return;
      }
      // prioriza quem está mais perto de atacar
      cands.sort((x, y) => (y.atk / y.intervalo) - (x.atk / x.intervalo));
      alvo = b.alvo = cands[0];
    }

    const res = compara(c, alvo.texto[alvo.dig]);
    if (!res) { erro(alvo); return; }
    if (res === 'leniente') alvo.imperfeito = true;
    if (res === 'exato' && temAcento(alvo.texto[alvo.dig])) run.stats.acentoOk++;
    if (alvo.t0 == null) alvo.t0 = run.stats.tempo;  // início da palavra (conquista "Fibra Óptica")
    alvo.dig++;
    run.stats.acertos++;
    b.stats.acertos++;
    Sound.sfx.tecla();
    const topo = alvo.y - alvo.spr.h / 2;
    FX.laser(POS_JOGADOR.x + 45, POS_JOGADOR.y - 38, alvo.x + (Math.random() - 0.5) * 30, topo + (Math.random() - 0.5) * 30);
    if (alvo.dig >= alvo.texto.length) completar(alvo);
  }

  function erro(alvo) {
    run.stats.erros++;
    b.stats.erros++;
    Sound.sfx.erro();
    emit('erro');
    if (alvo) {
      // estatística para o relatório: qual letra a pessoa errou
      const esperado = alvo.texto[alvo.dig];
      if (esperado) {
        run.stats.errosTecla[esperado] = (run.stats.errosTecla[esperado] || 0) + 1;
        if (temAcento(esperado)) run.stats.acentoErro++;
      }
      alvo.erros++;
      if (run.p.perdoaErro && alvo.erros === 1) return;
    }
    if (b.combo >= 5) log(`> combo x${b.combo} perdido`, '#ff3355');
    b.combo = 0;
  }

  function soltarAlvo() {
    if (b && b.alvo) { b.alvo = null; Sound.sfx.selecao(); }
  }

  function completar(e) {
    const p = run.p;
    const perfeito = e.erros === 0 && !e.imperfeito;
    if (perfeito) b.combo += p.ganhoCombo;
    run.stats.maiorCombo = Math.max(run.stats.maiorCombo, b.combo);
    run.stats.palavras++;
    b.alvo = null;

    const len = e.texto.length;
    const fatorTexto = e.chefe ? Math.max(1, len / 8) : 1 + Math.max(0, len - 5) * 0.08;
    const multCombo = 1 + Math.min(b.combo, COMBO_MAX) * COMBO_PASSO;
    const crit = Math.random() < p.crit;
    const dano = Math.round(p.atk * fatorTexto * multCombo * (crit ? p.critMult : 1));
    run.pontos += Math.round(len * 10 * multCombo * (crit ? 1.5 : 1) * (perfeito ? 1 : 0.6));

    if (b.combo >= 10) conquista('combo10');
    if (b.combo >= 20) conquista('combo20');
    if (e.chefe && e.t0 != null) {
      const seg = run.stats.tempo - e.t0;
      if (seg > 0.5 && (len / 5) / (seg / 60) >= 60) conquista('veloz');
    }

    if (perfeito && b.combo > 0 && b.combo % 10 === 0) {
      FX.texto(POS_JOGADOR.x, POS_JOGADOR.y - 140, `COMBO x${b.combo}!`, '#ffd23f', 30, 1.3);
      log(`> combo x${b.combo}! dano +${Math.round(Math.min(b.combo, COMBO_MAX) * COMBO_PASSO * 100)}%`, '#ffd23f');
    }
    aplicarDano(e, dano, crit);
  }

  function aplicarDano(e, dano, crit) {
    e.hp -= dano;
    e.flash = 0.12;
    e.tremor = 0.25;
    const topo = e.y - e.spr.h;
    FX.texto(e.x + (Math.random() - 0.5) * 30, topo - 10, `-${dano}`, crit ? '#ff2bd6' : '#ffffff', crit ? 38 : 28);
    if (crit) {
      FX.texto(e.x, topo - 44, 'CRÍTICO!', '#ff2bd6', 30, 0.9);
      Sound.sfx.critico();
      FX.tremer(9);
    } else {
      Sound.sfx.golpe();
      FX.tremer(3);
    }
    FX.faiscas(e.x, e.y - e.spr.h / 2, '#39ff14', crit ? 24 : 12);

    if (e.hp <= 0) { matar(e); return; }
    if (b.alvo === e) b.alvo = null;
    novoTexto(e);
    if (e.chefe) {
      if (!e.metade && e.hp <= e.maxHp / 2) {
        e.metade = true;
        calcularIntervalo(e);
        falar(e, b.A.chefe.falas.metade);
        log(`> [!] ${e.nome} está furioso!`, '#ff3355');
        FX.tremer(14);
      } else if (Math.random() < 0.3) {
        falar(e, sortear(['ARGH!', 'ERRO 500!', 'IMPOSSÍVEL!', 'VOCÊ NÃO VAI PASSAR!', 'kernel panic...']));
      }
    }
  }

  function matar(e) {
    e.hp = 0;
    e.morrendo = true;
    if (b.alvo === e) b.alvo = null;
    FX.explodir(e.spr, e.x - e.spr.w / 2, e.y - e.spr.h);
    const p = run.p;
    const cred = Math.round(e.recompensa * p.multCreditos);
    p.creditos += cred;
    run.pontos += (e.chefe ? 500 : 50) * (run.andar + 1);
    run.stats.abates++;
    b.stats.abates++;
    if (p.vidaPorAbate) p.hp = Math.min(p.maxHp, p.hp + p.vidaPorAbate);
    if (cred) FX.texto(e.x, e.y - e.spr.h - 30, `+${cred} ₿`, '#ffb000', 24, 1.2);
    conquista('primeiro');
    if (p.creditos >= 200) conquista('investidor');

    if (e.chefe) {
      conquista('chefe');
      if (b.stats.erros === 0) conquista('limpo');
      if (b.stats.danoRecebido === 0) conquista('intocavel');
      if (b.stats.itensUsados === 0) conquista('raiz');
      if (p.hp < p.maxHp * 0.1) conquista('porumfio');
      if (b.A.acentos === 'estrito') conquista('acentos');
      Sound.sfx.chefeMorre();
      Sound.pararMusica();
      FX.tremer(20);
      log(`> [OK] ${e.nome} DERROTADO!`, '#39ff14');
      emit('chefeDerrotado', b.A.chefe);
      // remove os capangas junto
      for (const o of b.inimigos) if (!o.morrendo && o !== e) { o.morrendo = true; FX.explodir(o.spr, o.x - o.spr.w / 2, o.y - o.spr.h); }
      b.etapa = 'vitoria';
      b.tempoEtapa = 0;
    } else {
      Sound.sfx.abate();
      log(`> [OK] ${e.nome} removido (+${cred}₿)`, '#39ff14');
    }
  }

  // ---------------- ataques inimigos ----------------
  function atacar(e) {
    if (b.etapa !== 'ondas' && b.etapa !== 'chefe') return;
    const p = run.p;
    e.investida = 0.35;
    const px = POS_JOGADOR.x, py = POS_JOGADOR.y - 120;
    if (b.escudo > 0) {
      b.escudo--;
      FX.texto(px, py, 'BLOQUEADO!', '#00e5ff', 28);
      Sound.sfx.bloqueio();
      log(`> firewall bloqueou ${e.nome}`, '#00e5ff');
      return;
    }
    if (Math.random() < p.bloqueio) {
      FX.texto(px, py, 'CRIPTOGRAFADO!', '#00e5ff', 26);
      Sound.sfx.bloqueio();
      return;
    }
    const dano = Math.round(e.dano * (e.chefe ? p.danoChefe : 1));
    p.hp -= dano;
    b.stats.danoRecebido += dano;
    FX.texto(px + (Math.random() - 0.5) * 30, py, `-${dano}`, '#ff3355', 34);
    FX.faiscas(px, POS_JOGADOR.y - 50, '#ff3355', 16);
    FX.tremer(e.chefe ? 16 : 10);
    Sound.sfx.dano();
    emit('dano');
    log(`> [!] ${e.nome} atacou: -${dano}`, '#ff3355');
    if (b.combo >= 5) log(`> combo reduzido`, '#ff3355');
    b.combo = Math.floor(b.combo / 2);

    if (p.hp <= 0) {
      if (p.reviver > 0) {
        p.reviver--;
        p.hp = Math.round(p.maxHp * 0.5);
        FX.texto(px, py - 30, 'BACKUP RESTAURADO!', '#ff2bd6', 30, 1.6);
        Sound.sfx.levelUp();
        log('> backup na nuvem restaurado!', '#ff2bd6');
      } else {
        p.hp = 0;
        morrer();
      }
    }
  }

  function morrer() {
    b.etapa = 'morte';
    b.tempoEtapa = 0;
    b.alvo = null;
    Sound.pararMusica();
    Sound.sfx.gameOver();
    const spr = Sprites.get('hacker', 6);
    FX.explodir(spr, POS_JOGADOR.x - spr.w / 2, POS_JOGADOR.y - spr.h);
    FX.tremer(20);
    log('> CONEXÃO PERDIDA', '#ff3355');
  }

  // ---------------- itens ----------------
  function usarItem(idx) {
    if (!podeDigitar()) return;
    const it = ITENS[idx];
    if (!it || run.inventario[it.id] <= 0) { Sound.sfx.negado(); return; }
    const p = run.p;
    const px = POS_JOGADOR.x, py = POS_JOGADOR.y - 140;
    switch (it.id) {
      case 'cafe':
        b.lento = 8;
        FX.texto(px, py, 'CAFEÍNA!', '#ffb000', 30);
        break;
      case 'patch': {
        const antes = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + 35);
        FX.texto(px, py, `+${p.hp - antes}`, '#39ff14', 32);
        break;
      }
      case 'antivirus':
        FX.tremer(12);
        FX.texto(480, 200, 'VARREDURA COMPLETA!', '#00e5ff', 34);
        for (const e of b.inimigos.slice()) if (!e.morrendo && e.nascendo <= 0) aplicarDano(e, 40, false);
        break;
      case 'escudo':
        b.escudo += 2;
        FX.texto(px, py, 'FIREWALL +2', '#00e5ff', 30);
        break;
    }
    run.inventario[it.id]--;
    b.stats.itensUsados++;
    Sound.sfx.item();
    log(`> ${it.nome.toLowerCase()} executado`, '#ffb000');
  }

  // ---------------- desenho ----------------
  function desenhar(ctx, t) {
    if (!b) return;
    // jogador
    if (b.etapa !== 'morte') {
      const spr = Sprites.get('hacker', 6);
      const bob = Math.sin(t * 2.5) * 2;
      const x = Math.round(POS_JOGADOR.x - spr.w / 2), y = Math.round(POS_JOGADOR.y - spr.h + bob);
      sombra(ctx, POS_JOGADOR.x, POS_JOGADOR.y, 44);
      ctx.drawImage(spr.canvas, x, y);
      // brilho da tela do notebook
      ctx.save();
      const brilho = ctx.createRadialGradient(x + 78, y + 75, 2, x + 78, y + 75, 34);
      brilho.addColorStop(0, `rgba(57,255,20,${0.3 + Math.sin(t * 8) * 0.08})`);
      brilho.addColorStop(1, 'rgba(57,255,20,0)');
      ctx.fillStyle = brilho;
      ctx.fillRect(x + 40, y + 40, 76, 70);
      ctx.restore();
      if (b.escudo > 0) {
        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        hexagono(ctx, POS_JOGADOR.x, POS_JOGADOR.y - 55, 72);
        ctx.stroke();
        ctx.restore();
      }
    }

    const ordenados = b.inimigos.slice().sort((x, y) => x.y - y.y);
    for (const e of ordenados) desenharInimigo(ctx, e, t);
    for (const e of ordenados) if (!e.chefe && !e.morrendo) desenharRotulo(ctx, e);
    if (b.chefe && (b.etapa === 'chefe' || b.etapa === 'vitoria')) desenharBarraChefe(ctx, b.chefe, t);
    for (const e of ordenados) if (e.fala && e.falaT > 0 && !e.morrendo) desenharFala(ctx, e);

    // filtro azul enquanto o café está ativo
    if (b.lento > 0) {
      ctx.fillStyle = `rgba(0, 120, 255, ${0.08 + Math.sin(t * 6) * 0.03})`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }
  }

  function sombra(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function hexagono(ctx, cx, cy, r) {
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  }

  function desenharInimigo(ctx, e, t) {
    const spr = e.spr;
    let x = e.x - spr.w / 2;
    let y = e.y - spr.h + Math.sin(t * 3 + e.bob) * (e.chefe ? 4 : 3);
    if (e.tremor > 0) { x += (Math.random() - 0.5) * 10; y += (Math.random() - 0.5) * 6; }
    if (e.investida > 0) x -= Math.sin((1 - e.investida / 0.35) * Math.PI) * (e.chefe ? 60 : 45);
    x = Math.round(x); y = Math.round(y);
    if (e.morrendo) return;

    sombra(ctx, e.x, e.y, spr.w * 0.4);
    ctx.save();
    if (e.nascendo > 0) ctx.globalAlpha = Math.random() < 0.5 ? 0.3 : 0.8;
    const img = e.flash > 0 ? spr.flash : spr.canvas;
    const glitch = e.chefe && e.truque === 'glitch' && Math.random() < 0.12;
    if (glitch) {
      // fatias deslocadas + separação de cor
      const fatias = 6, hF = spr.h / fatias;
      for (let i = 0; i < fatias; i++) {
        const dx = (Math.random() - 0.5) * 24;
        ctx.drawImage(img, 0, i * hF, spr.w, hF, x + dx, y + i * hF, spr.w, hF);
      }
      ctx.globalAlpha = 0.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, x + 6, y);
    } else {
      ctx.drawImage(img, x, y);
    }
    ctx.restore();

    // barras: vida e ataque
    const larg = e.chefe ? 170 : 84;
    const bx = Math.round(e.x - larg / 2), by = e.y + 8;
    if (!e.chefe) {
      barra(ctx, bx, by, larg, 6, e.hp / e.maxHp, '#39ff14');
    }
    const prop = Math.max(0, e.atk / e.intervalo);
    const perigo = prop > 0.8 && Math.floor(t * 10) % 2 === 0;
    barra(ctx, bx, by + (e.chefe ? 0 : 9), larg, e.chefe ? 7 : 5, prop, perigo ? '#ffffff' : '#ff3355');
  }

  function barra(ctx, x, y, w, h, prop, cor) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = cor;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, prop))), h);
  }

  // Caixa com a palavra sobre o inimigo (parte digitada em verde)
  function desenharRotulo(ctx, e) {
    ctx.font = `26px ${FONTE}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const larguras = [...e.texto].map(ch => ctx.measureText(ch).width);
    const total = larguras.reduce((a, c) => a + c, 0);
    const alvo = b.alvo === e;
    let x = e.x - total / 2;
    x = Math.max(34, Math.min(LARGURA - total - 10, x)); // 34px de folga para a seta ▶
    const y = e.y - e.spr.h - 24;
    ctx.fillStyle = alvo ? 'rgba(0,40,0,0.92)' : 'rgba(0,0,0,0.8)';
    ctx.fillRect(x - 8, y - 15, total + 16, 30);
    ctx.strokeStyle = alvo ? '#39ff14' : 'rgba(57,255,20,0.35)';
    ctx.lineWidth = alvo ? 2 : 1;
    ctx.strokeRect(x - 8 + 0.5, y - 15 + 0.5, total + 16, 30);
    if (alvo) {
      ctx.fillStyle = '#39ff14';
      ctx.fillText('▶', x - 26, y);
    }
    let cx = x;
    for (let i = 0; i < e.texto.length; i++) {
      if (i < e.dig) ctx.fillStyle = '#39ff14';
      else if (i === e.dig) ctx.fillStyle = alvo ? '#ffffff' : '#e6ffe6';
      else ctx.fillStyle = alvo ? '#d0ffd0' : '#9fbf9f';
      ctx.fillText(e.texto[i], cx, y + 1);
      if (i === e.dig && alvo) ctx.fillRect(cx, y + 12, larguras[i], 2);
      cx += larguras[i];
    }
  }

  function desenharBarraChefe(ctx, e, t) {
    const x = 280, y = 66, w = 380, h = 16;
    ctx.font = `18px "SilkscreenL", "Silkscreen", ${FONTE}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ff3355';
    ctx.fillText(e.titulo, x, y - 4, w); // maxWidth: nomes longos são comprimidos, nunca vazam
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `20px ${FONTE}`;
    ctx.fillStyle = '#ff99aa';
    ctx.fillText(`${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`, x + w, y + h + 2);
    barra(ctx, x, y, w, h, e.hp / e.maxHp, e.metade && Math.floor(t * 4) % 2 ? '#ff6680' : '#ff3355');
    // segmentos
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (w / 10) * i, y, 1, h);
  }

  function desenharFala(ctx, e) {
    ctx.font = `20px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(380, ctx.measureText(e.fala).width + 24);
    let x = e.x - w / 2;
    x = Math.max(10, Math.min(LARGURA - w - 10, x));
    const y = e.y - e.spr.h - (e.chefe ? 46 : 70);
    ctx.globalAlpha = Math.min(1, e.falaT * 2);
    ctx.fillStyle = 'rgba(30,0,5,0.92)';
    ctx.fillRect(x, y - 16, w, 32);
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y - 15.5, w, 32);
    ctx.fillStyle = '#ffccd5';
    ctx.fillText(e.fala, x + w / 2, y + 1, w - 16);
    ctx.globalAlpha = 1;
  }

  // ---------------- consultas para a interface ----------------
  function prompt() {
    if (!b) return null;
    const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : null;
    if (alvo) return { texto: alvo.texto, dig: alvo.dig, nome: alvo.nome, ativo: true };
    if (b.chefe && !b.chefe.morrendo && b.etapa === 'chefe') {
      return { texto: b.chefe.texto, dig: b.chefe.dig, nome: b.chefe.nome, ativo: false };
    }
    return { texto: '', dig: 0, nome: '', ativo: false };
  }

  // Upgrades: sorteia 3 cartas diferentes, respeitando raridade e limite
  function sortearCartas(n = 3) {
    const disponiveis = UPGRADES.filter(u => (run.upgrades[u.id] || 0) < u.max);
    const escolhidas = [];
    while (escolhidas.length < n && disponiveis.length) {
      const total = disponiveis.reduce((s, u) => s + RARIDADES[u.raridade].peso, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < disponiveis.length; idx++) {
        r -= RARIDADES[disponiveis[idx].raridade].peso;
        if (r <= 0) break;
      }
      escolhidas.push(disponiveis.splice(Math.min(idx, disponiveis.length - 1), 1)[0]);
    }
    return escolhidas;
  }

  function aplicarUpgrade(u) {
    u.aplicar(run.p);
    run.p.hp = Math.min(run.p.hp, run.p.maxHp);
    run.upgrades[u.id] = (run.upgrades[u.id] || 0) + 1;
  }

  function comprar(idx) {
    const it = ITENS[idx];
    if (!it) return 'invalido';
    if (run.inventario[it.id] >= ITEM_MAX) return 'cheio';
    if (run.p.creditos < it.preco) return 'sem credito';
    run.p.creditos -= it.preco;
    run.inventario[it.id]++;
    return 'ok';
  }

  return {
    on, novaPartida, iniciarAndar, atualizar, desenhar, digitar, soltarAlvo, usarItem,
    prompt, sortearCartas, aplicarUpgrade, comprar,
    conquista, registrarAndar, totalAndares, posicao, ehUltimo, avancar, irParaAndar, temAcento,
    get run() { return run; },
    get estado() { return b; },
  };
})();
