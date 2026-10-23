import { describe, expect, it } from 'vitest';
import { ANDARES, BAL, MODOS, UPGRADES } from '../../src/content';
import { Battle } from '../../src/game/battle';
import { novaBatalha } from './ajuda';

describe('digitação', () => {
  it('palavra completa derrota inimigo do andar 1 e dá créditos/pontos', () => {
    const t = novaBatalha(0);
    expect(t.ateInimigos(1)).toBe(true);
    const e = t.vivos()[0];
    t.digitar(e.texto);
    expect(e.morrendo).toBe(true);
    expect(t.run.p.creditos).toBeGreaterThan(0);
    expect(t.run.pontos).toBeGreaterThan(0);
    expect(t.n('erro')).toBe(0);
  });

  it('erro não avança, conta erro e zera o combo', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.battle.digitar(e.texto[0]);
    t.b().combo = 7;
    t.battle.digitar('#');
    expect(e.dig).toBe(1);
    expect(t.n('erro')).toBe(1);
    expect(t.b().combo).toBe(0);
  });

  it('espaço sem alvo é ignorado e maiúsculas são aceitas', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.battle.digitar(' ');
    expect(t.n('erro')).toBe(0);
    t.battle.digitar(e.texto[0].toUpperCase());
    expect(e.dig).toBe(1);
  });

  it('modo leniente (andar 3) aceita sem acento, mas não soma combo', () => {
    const t = novaBatalha(2, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'função';
    e.dig = 0;
    t.digitar('funcao');
    expect(t.n('erro')).toBe(0);
    expect(t.b().combo).toBe(0);
    expect(e.texto !== 'função' || e.dig === 0).toBe(true);
  });

  it('modo estrito (andar 5) exige o acento', () => {
    const t = novaBatalha(4);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'conexão';
    e.dig = 0;
    t.digitar('conex');
    t.battle.digitar('a');
    expect(t.n('erro')).toBe(1);
    expect(e.dig).toBe(5);
    t.battle.digitar('ã');
    expect(e.dig).toBe(6);
  });

  it('BACKSPACE solta o alvo e mantém o progresso', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'teclado';
    e.dig = 0;
    t.digitar('te');
    t.battle.soltarAlvo();
    expect(t.b().alvo).toBeNull();
    expect(e.dig).toBe(2);
    t.battle.digitar('c');
    expect(e.dig).toBe(3);
  });
});

describe('dano e combo', () => {
  it('combo cresce com palavras perfeitas e aumenta o dano (fórmula)', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    const danos: number[] = [];
    for (let i = 0; i < 6; i++) {
      e.texto = 'cabos';
      e.dig = 0;
      const antes = e.hp;
      t.digitar('cabos');
      danos.push(antes - e.hp);
    }
    expect(t.b().combo).toBe(6);
    danos.forEach((d, i) => expect(d).toBe(Math.round(t.run.p.atk * (1 + (i + 1) * BAL.comboPasso))));
  });

  it('acerto crítico dobra o dano', () => {
    const t = novaBatalha(0, { crit: 1 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos');
    expect(9999 - e.hp).toBe(Math.round(10 * 1.05 * 2));
  });

  it('pontuação exata: palavra perfeita, palavra sem acento (60%), abate e chefão (AUD-04)', () => {
    // a pontuação decide o ranking do evento: a fórmula precisa estar travada por teste
    const t = novaBatalha(2, { crit: 0 }); // andar 3: aceita sem acento
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    const pontos = () => t.run.pontos;
    let antes = pontos();
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos'); // combo 1 → x1,05 · 5 letras · 10 pontos por letra
    expect(pontos() - antes).toBe(Math.round(5 * 10 * 1.05));
    antes = pontos();
    e.texto = 'função';
    e.dig = 0;
    t.digitar('funcao'); // sem acento: combo continua 1 e vale 60%
    expect(pontos() - antes).toBe(Math.round(6 * 10 * 1.05 * 0.6));
    antes = pontos();
    const conquistasAntes = t.run.conquistas.length;
    e.hp = 1;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos'); // abate no andar 3: + 50 x 3 (+ 300 da conquista "Primeiro Commit")
    const bonus = (t.run.conquistas.length - conquistasAntes) * 300;
    expect(pontos() - antes - bonus).toBe(Math.round(5 * 10 * 1.1) + 50 * 3);
    const t2 = novaBatalha(2, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t2.ateChefe();
    const c = t2.b().chefe!;
    c.hp = 1;
    antes = t2.run.pontos;
    t2.digitar(c.texto.slice(c.dig)); // chefão no andar 3: + 500 x 3, mais a frase e as conquistas
    const conquistas = t2.run.conquistas.length * 300;
    expect(t2.run.pontos - antes - conquistas).toBe(Math.round(c.texto.length * 10 * 1.05) + 500 * 3);
  });

  it('palavras e frases longas causam mais dano (AUD-04)', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    e.texto = 'computador'; // 10 letras: +8% por letra acima de 5
    e.dig = 0;
    t.digitar('computador');
    expect(9999 - e.hp).toBe(Math.round(10 * (1 + 5 * 0.08) * 1.05));
    const t2 = novaBatalha(0, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t2.ateChefe();
    const c = t2.b().chefe!;
    c.hp = c.maxHp = 9999;
    c.texto = 'abcdefghijklmnop'; // chefão: dano x (letras / 8)
    c.dig = 0;
    t2.digitar(c.texto);
    expect(9999 - c.hp).toBe(Math.round(10 * 2 * 1.05));
  });

  it('maior combo guarda o recorde mesmo depois de um erro, e as palavras são contadas', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    for (let i = 0; i < 6; i++) {
      e.texto = 'cabos';
      e.dig = 0;
      t.digitar('cabos');
    }
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('#');
    expect(t.b().combo).toBe(0);
    expect(t.run.stats.maiorCombo).toBe(6);
    expect(t.run.stats.palavras).toBe(6);
  });

  it('marco de combo só a cada 10 palavras perfeitas', () => {
    const t = novaBatalha(0, { crit: 0 });
    const marcos: number[] = [];
    t.battle.on('comboMarco', c => marcos.push(c));
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 9999;
    for (let i = 0; i < 21; i++) {
      e.texto = 'cabos';
      e.dig = 0;
      t.digitar('cabos');
    }
    expect(marcos).toEqual([10, 20]);
  });

  it('palavra imperfeita (com erro) não soma combo', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('ca#bos');
    expect(t.b().combo).toBe(0);
  });
});

describe('ataques inimigos', () => {
  it('inimigo ataca quando a barra enche; escudo e criptografia bloqueiam', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    const atacar = () => {
      e.atk = e.intervalo - 0.001;
      t.battle.atualizar(0.05);
    };
    atacar();
    expect(t.run.p.hp).toBe(100 - ANDARES[0].dano);
    t.b().escudo = 1;
    atacar();
    expect(t.run.p.hp).toBe(100 - ANDARES[0].dano);
    expect(t.b().escudo).toBe(0);
    t.run.p.bloqueio = 1;
    atacar();
    expect(t.run.p.hp).toBe(100 - ANDARES[0].dano);
  });

  it('3 inimigos atacando no mesmo quadro matam o jogador uma única vez', () => {
    const t = novaBatalha(6);
    expect(t.ateInimigos(3)).toBe(true);
    t.zerar();
    t.run.p.hp = 1;
    t.vivos().forEach(e => (e.atk = e.intervalo));
    t.battle.atualizar(0.05);
    expect(t.n('dano')).toBe(1);
    expect(t.b().etapa).toBe('morte');
    t.simular(3);
    expect(t.n('gameOver')).toBe(1);
  });

  it('Backup na Nuvem revive uma única vez', () => {
    const t = novaBatalha(0, { reviver: 1 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.run.p.hp = 1;
    e.atk = e.intervalo;
    t.battle.atualizar(0.05);
    expect(t.run.p.hp).toBe(50);
    expect(t.run.p.reviver).toBe(0);
    t.run.p.hp = 1;
    e.atk = e.intervalo;
    t.battle.atualizar(0.05);
    expect(t.b().etapa).toBe('morte');
  });
});

describe('progressão', () => {
  it.each(ANDARES.map((A, i) => [i + 1, A.nome, i] as const))(
    'andar %i (%s): ondas → alerta → chefão → vitória sem travar',
    (_n, _nome, k) => {
      const t = novaBatalha(k, { maxHp: 1e6, hp: 1e6 });
      let viuChefe = false;
      const fim = t.simular(900, () => {
        t.botTecla();
        if (t.b().chefe) viuChefe = true;
        return t.n('andarConcluido') > 0;
      });
      expect(fim, `etapa ${t.b().etapa}`).toBe(true);
      expect(viuChefe).toBe(true);
      expect(t.n('alertaChefe')).toBe(1);
      expect(t.n('chefeDerrotado')).toBe(1);
      t.simular(5);
      expect(t.n('andarConcluido')).toBe(1);
      expect(t.run.stats.abates).toBeGreaterThanOrEqual(ANDARES[k].inimigos + 1);
    },
  );

  it('o combo continua de um andar para o outro, mas zera numa partida nova', () => {
    const t = novaBatalha(0);
    t.b().combo = 7;
    t.battle.registrarAndar(true);
    t.battle.avancar();
    t.battle.iniciarAndar();
    expect(t.b().combo).toBe(7);
    t.battle.novaPartida('outro', 'normal');
    t.battle.iniciarAndar();
    expect(t.b().combo).toBe(0);
  });

  it('registra cada andar uma única vez no histórico', () => {
    const t = novaBatalha(0);
    t.battle.registrarAndar(true);
    t.battle.registrarAndar(true);
    expect(t.run.historico).toHaveLength(1);
  });
});

describe('chefões', () => {
  it('truque "invocar" chama capangas com letras que não conflitam', () => {
    const t = novaBatalha(2, { maxHp: 1e6, hp: 1e6 });
    expect(t.ateChefe()).toBe(true);
    t.simular(22);
    const capangas = t.vivos().filter(e => !e.chefe);
    expect(capangas.length).toBeGreaterThanOrEqual(1);
    const chefe = t.b().chefe!;
    const ini = (s: string) => s.normalize('NFD')[0];
    capangas.forEach(c => expect(ini(c.texto[c.dig])).not.toBe(ini(chefe.texto[chefe.dig])));
  });

  it('frase nova do chefão nunca começa com a mesma letra de um capanga (a mira ficaria ambígua)', () => {
    // Bug da auditoria (AUD-01): o chefão troca de frase a cada golpe, sem conferir os capangas.
    // Ex.: andar 3, chefão "funciona na minha máquina" + capanga "função": digitar "f" podia
    // mirar no capanga, e a 5ª letra ("i" no lugar de "ã") virava erro e zerava o combo.
    const t = novaBatalha(2, { maxHp: 1e6, hp: 1e6, crit: 0 });
    t.ateChefe();
    t.simular(22);
    const chefe = t.b().chefe!;
    const capanga = t.vivos().find(e => !e.chefe)!;
    expect(capanga, 'o chefão do andar 3 deveria ter invocado um capanga').toBeDefined();
    chefe.hp = chefe.maxHp = 1e6;
    capanga.hp = capanga.maxHp = 1e6;
    capanga.texto = 'função';
    capanga.dig = 0;
    chefe.texto = 'quem escreveu esse código';
    chefe.dig = 0;
    chefe.fraseIdx = chefe.frases.indexOf('funciona na minha máquina'); // a próxima frase começa com "f"
    t.battle.soltarAlvo();
    t.digitar(chefe.texto);
    expect(chefe.texto).toBe('funciona na minha máquina');
    const letra = (s: string, i: number) => s[i].normalize('NFD')[0];
    for (const o of t.vivos().filter(e => !e.chefe))
      expect(letra(o.texto, o.dig), `capanga "${o.texto}" disputa a letra com o chefão`).not.toBe(
        letra(chefe.texto, chefe.dig),
      );
    // e digitar a frase do chefão acerta o chefão, sem erro
    const erros = t.run.stats.erros;
    t.digitar(chefe.texto.slice(0, 6));
    expect(t.b().alvo).toBe(chefe);
    expect(t.run.stats.erros).toBe(erros);
  });

  it('truque "acelerar" encurta o intervalo de ataque com a vida baixa', () => {
    const t = novaBatalha(3, { maxHp: 1e6, hp: 1e6, crit: 0 });
    t.ateChefe();
    const chefe = t.b().chefe!;
    const i0 = chefe.intervalo;
    chefe.hp = Math.round(chefe.maxHp * 0.3);
    t.digitar(chefe.texto.slice(chefe.dig));
    expect(chefe.intervalo).toBeLessThan(i0 * 0.8);
    expect(chefe.metade).toBe(true);
  });
});

describe('itens e loja', () => {
  it('café, patch, antivírus e firewall funcionam e consomem 1 unidade', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    Object.assign(t.run.inventario, { cafe: 1, patch: 1, antivirus: 1, escudo: 1 });
    t.run.p.hp = 50;
    t.battle.usarItem(0);
    expect(t.b().lento).toBeGreaterThan(0);
    t.battle.usarItem(1);
    expect(t.run.p.hp).toBe(85);
    t.battle.usarItem(2);
    expect(e.hp).toBe(959);
    t.battle.usarItem(3);
    expect(t.b().escudo).toBe(2);
    expect(Object.values(t.run.inventario)).toEqual([0, 0, 0, 0]);
    t.battle.usarItem(1);
    expect(t.run.p.hp).toBe(85);
    t.run.p.hp = 90;
    t.run.inventario.patch = 1;
    t.battle.usarItem(1);
    expect(t.run.p.hp).toBe(100);
  });

  it('antivírus pode derrotar o chefão e concluir o andar', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    t.b().chefe!.hp = 10;
    t.run.inventario.antivirus = 1;
    t.battle.usarItem(2);
    expect(t.b().etapa).toBe('vitoria');
    t.simular(3);
    expect(t.n('andarConcluido')).toBe(1);
  });

  it('loja: compra, limite de 3 por item e créditos insuficientes', () => {
    const t = novaBatalha(0);
    t.run.p.creditos = 1000;
    for (let i = 0; i < 3; i++) expect(t.battle.comprar(0)).toBe('ok');
    expect(t.battle.comprar(0)).toBe('cheio');
    t.run.p.creditos = 10;
    expect(t.battle.comprar(1)).toBe('sem credito');
    expect(t.run.p.creditos).toBe(10);
    expect(t.battle.comprar(9)).toBe('invalido');
  });
});

describe('upgrades', () => {
  it('sorteio sem repetição, respeitando o máximo de cada um', () => {
    const t = novaBatalha(0);
    for (let i = 0; i < 300; i++) {
      const c = t.battle.sortearCartas(3);
      expect(c).toHaveLength(3);
      expect(new Set(c.map(u => u.id)).size).toBe(3);
    }
    UPGRADES.forEach(u => (t.run.upgrades[u.id] = u.max));
    expect(t.battle.sortearCartas(3)).toHaveLength(0);
  });

  it('efeitos de todas as cartas', () => {
    const t = novaBatalha(0);
    const p = t.run.p;
    const pega = (id: string) => t.battle.aplicarUpgrade(UPGRADES.find(u => u.id === id)!);
    pega('overclock');
    expect(p.atk).toBe(12.5);
    pega('firewall');
    expect([p.maxHp, p.hp]).toEqual([125, 125]);
    pega('ssd');
    expect(p.velInimigos).toBe(0.88);
    pega('mineracao');
    expect(p.multCreditos).toBe(1.5);
    pega('cache');
    expect(p.escudoInicial).toBe(1);
    pega('exploit');
    expect(p.crit).toBeCloseTo(0.18);
    pega('criptografia');
    expect(p.bloqueio).toBe(0.15);
    pega('garbage');
    expect(p.vidaPorAbate).toBe(4);
    pega('multithread');
    expect(p.ganhoCombo).toBe(2);
    pega('corretor');
    expect(p.perdoaErro).toBe(true);
    pega('vpn');
    expect(p.danoChefe).toBe(0.7);
    pega('autocomplete');
    expect(p.autocomplete).toBe(true);
    pega('backup');
    expect(p.reviver).toBe(1);
    pega('zeroday');
    expect(p.critMult).toBe(3);
    t.battle.iniciarAndar();
    expect(t.b().escudo).toBe(1);
  });

  it('Autocomplete: 1ª letra pronta e digitá-la por hábito não é erro', () => {
    const t = novaBatalha(0, { autocomplete: true });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    expect(e.dig === 1 || e.texto.length <= 3).toBe(true);
    if (e.dig === 1) {
      t.battle.digitar(e.texto[0]);
      expect(t.n('erro')).toBe(0);
      t.digitar(e.texto.slice(1));
      expect(t.n('erro')).toBe(0);
    }
  });

  it('Corretor Ortográfico perdoa só o 1º erro', () => {
    const t = novaBatalha(0, { perdoaErro: true });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.battle.digitar(e.texto[0]);
    t.b().combo = 5;
    t.battle.digitar('#');
    expect(t.b().combo).toBe(5);
    t.battle.digitar('#');
    expect(t.b().combo).toBe(0);
  });
});

describe('modo rápido', () => {
  it('rota de 3 andares (Suporte, Banco de Dados, Diretoria) e menos inimigos', () => {
    const t = novaBatalha(0, {}, { modo: 'rapido' });
    expect(t.run.rota).toEqual([0, 3, 8]);
    expect(t.battle.totalAndares()).toBe(3);
    expect(t.b().restante).toBe(Math.round(ANDARES[0].inimigos * MODOS.rapido.fatorInimigos));
    t.ateInimigos(1);
    expect(t.vivos()[0].maxHp).toBe(Math.round(ANDARES[0].hp * MODOS.rapido.fatorVida));
    t.ateChefe();
    expect(t.b().chefe!.maxHp).toBe(Math.round(ANDARES[0].chefe.hp * MODOS.rapido.fatorVida));
    t.battle.avancar();
    expect([t.run.andar, t.battle.posicao(), t.battle.ehUltimo()]).toEqual([3, 2, false]);
    t.battle.avancar();
    expect([t.run.andar, t.battle.ehUltimo()]).toEqual([8, true]);
  });

  it('modo inválido vira normal', () => {
    expect(new Battle().novaPartida('x', 'qualquer-coisa').modo).toBe('normal');
  });
});

describe('fim de partida', () => {
  it('vitória dá bônus, conquista "zerou" e números finais', () => {
    const t = novaBatalha(8, { hp: 50 });
    const antes = t.run.pontos;
    const fim = t.battle.encerrar(true);
    expect(t.run.venceu).toBe(true);
    expect(t.run.conquistas).toContain('zerou');
    expect(t.run.pontos - antes).toBe(5000 + 50 * 20 + BAL.bonusConquista);
    expect(fim.andar).toBe(9);
    expect(fim.totalAndares).toBe(9);
  });
});

describe('reprodutibilidade (RNG com semente)', () => {
  const jogar = (semente: number) => {
    const t = novaBatalha(6, { maxHp: 1e6, hp: 1e6 }, { semente });
    const palavras: string[] = [];
    t.battle.on('acerto', e => {
      if (e.dig === 1) palavras.push(e.texto);
    });
    t.simular(120, () => {
      t.botTecla();
      return false;
    });
    return { palavras, pontos: t.run.pontos, hp: t.run.p.hp };
  };

  it('mesma semente = mesma partida, semente diferente = partida diferente', () => {
    expect(jogar(42)).toEqual(jogar(42));
    expect(jogar(42).palavras).not.toEqual(jogar(43).palavras);
  });
});
