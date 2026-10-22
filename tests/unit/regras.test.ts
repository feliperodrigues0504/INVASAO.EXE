// Regras finas que decidem o ranking e o equilíbrio do jogo. Escritos na auditoria
// AUD-04, a partir dos mutantes que o Stryker mostrou que "sobreviviam": sem estes
// testes, trocar um ++ por -- na contagem de acertos não reprovava nada.

import { describe, expect, it } from 'vitest';
import { ANDARES } from '../../src/content';
import { novaBatalha } from './ajuda';

describe('estatísticas que vão para o ranking e o relatório', () => {
  it('acertos, erros, PPM e precisão finais saem exatos', () => {
    const t = novaBatalha(0, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 1e6;
    const tempo0 = t.run.stats.tempo;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cab');
    t.battle.digitar('#'); // 1 erro
    t.digitar('os');
    expect(t.run.stats.acertos).toBe(5);
    expect(t.run.stats.erros).toBe(1);
    expect(t.b().stats.acertos).toBe(5);
    expect(t.b().stats.erros).toBe(1);
    // 60 s de batalha: 5 acertos = 1 "palavra" (5 toques) por minuto
    t.run.stats.tempo = tempo0 + 60;
    const fim = t.battle.encerrar(false);
    expect(fim.precisao).toBe(Math.round((5 / 6) * 100));
    expect(fim.ppm).toBe(1);
  });

  it('relatório: PPM e precisão do andar, teclas erradas e acentos', () => {
    const t = novaBatalha(4, { crit: 0, maxHp: 1e6, hp: 1e6 }); // andar 5: acentos contam
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 1e6;
    e.texto = 'ação';
    e.dig = 0;
    t.battle.soltarAlvo();
    for (const ch of ['a', 'c', 'c', 'ç', 'a', 'ã', 'o']) t.battle.digitar(ch);
    expect(t.run.stats.errosTecla).toEqual({ ç: 2, ã: 1 });
    expect([t.run.stats.acentoOk, t.run.stats.acentoErro]).toEqual([2, 3]);
    t.b().stats.tempo = 120; // 2 min
    t.battle.registrarAndar(true);
    const h = t.run.historico[0];
    expect(h).toMatchObject({ nome: ANDARES[4].nome, concluido: true, tempo: 120 });
    expect(h.ppm).toBe(Math.round(t.b().stats.acertos / 5 / 2));
    expect(h.precisao).toBe(Math.round((t.b().stats.acertos / (t.b().stats.acertos + 3)) * 100));
  });

  it('andar curto demais (menos de 1 s) registra 0 ppm em vez de um número absurdo', () => {
    const t = novaBatalha(0);
    t.b().stats.acertos = 5;
    t.b().stats.tempo = 0.5;
    t.battle.registrarAndar(false);
    expect(t.run.historico[0]).toMatchObject({ ppm: 0, concluido: false });
  });
});

describe('dano recebido', () => {
  const atacar = (t: ReturnType<typeof novaBatalha>, e = t.vivos()[0]) => {
    e.atk = e.intervalo;
    t.battle.atualizar(0.001);
  };

  it('VPN reduz só o dano de chefões, e levar dano corta o combo pela metade', () => {
    const t = novaBatalha(0, { danoChefe: 0.7 });
    t.ateInimigos(1);
    t.b().combo = 7;
    atacar(t);
    expect(t.run.p.hp).toBe(100 - ANDARES[0].dano); // inimigo comum: dano cheio
    expect(t.b().combo).toBe(3);
    expect(t.b().stats.danoRecebido).toBe(ANDARES[0].dano);
    const t2 = novaBatalha(0, { danoChefe: 0.7, maxHp: 1000, hp: 1000 });
    t2.ateChefe();
    atacar(t2, t2.b().chefe!);
    expect(1000 - t2.run.p.hp).toBe(Math.round(ANDARES[0].chefe.dano * 0.7));
  });
});

describe('velocidade de ataque dos inimigos', () => {
  const tempoAteAtacar = (extra: Parameters<typeof novaBatalha>[1], lento = 0) => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6, ...extra });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.atk = 0;
    t.b().lento = lento;
    let seg = 0;
    while (t.run.p.hp === 1e6 && seg < 60) {
      t.battle.atualizar(0.01);
      seg += 0.01;
      if (lento) t.b().lento = lento; // mantém o café ativo durante a medição
    }
    return { seg, intervalo: e.intervalo };
  };

  it('o intervalo cresce com o tamanho da palavra (tempo para digitar)', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    expect(e.intervalo).toBeCloseTo(ANDARES[0].atkBase + e.texto.length * ANDARES[0].porLetra);
  });

  it('sem upgrades, o inimigo ataca quando a barra enche (o intervalo da palavra)', () => {
    const { seg, intervalo } = tempoAteAtacar({});
    expect(seg).toBeCloseTo(intervalo, 1);
  });

  it('café: inimigos atacam 60% mais devagar (fator 0,4)', () => {
    const { seg, intervalo } = tempoAteAtacar({}, 99);
    expect(seg).toBeCloseTo(intervalo / 0.4, 0);
  });

  it('SSD NVMe: o multiplicador de velocidade vale de verdade no ataque', () => {
    const { seg, intervalo } = tempoAteAtacar({ velInimigos: 0.5 });
    expect(seg).toBeCloseTo(intervalo / 0.5, 0);
  });

  it('chefão furioso (abaixo de 50%) ataca 15% mais rápido', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6, crit: 0 }); // andar 1: chefão sem truque
    t.ateChefe();
    const c = t.b().chefe!;
    const base = ANDARES[0].chefe.intervalo;
    expect(c.intervalo).toBeCloseTo(base);
    c.hp = Math.floor(c.maxHp / 2) + 1;
    t.digitar(c.texto.slice(c.dig));
    expect(c.metade).toBe(true);
    expect(c.intervalo).toBeCloseTo(base * 0.85);
  });
});

describe('recompensas e upgrades em ação', () => {
  it('Mineração multiplica os créditos; Garbage Collector cura a cada abate (sem passar do máximo)', () => {
    const t = novaBatalha(0, { crit: 0, multCreditos: 1.5, vidaPorAbate: 4, hp: 50 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.digitar(e.texto.slice(e.dig));
    expect(e.morrendo).toBe(true);
    expect(t.run.p.creditos).toBe(Math.round(ANDARES[0].recompensa * 1.5));
    expect(t.run.p.hp).toBe(54);
    const t2 = novaBatalha(0, { crit: 0, vidaPorAbate: 4, hp: 99 });
    t2.ateInimigos(1);
    const e2 = t2.vivos()[0];
    t2.digitar(e2.texto.slice(e2.dig));
    expect(t2.run.p.hp).toBe(100);
  });

  it('"Investidor" exige 200 créditos de uma vez, não 199', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.run.p.creditos = 199 - ANDARES[0].recompensa;
    t.digitar(e.texto.slice(e.dig));
    expect(t.run.p.creditos).toBe(199);
    expect(t.run.conquistas).not.toContain('investidor');
  });

  it('antivírus não acerta inimigo que ainda está surgindo', () => {
    const t = novaBatalha(0);
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 999;
    e.nascendo = 0.3;
    t.run.inventario.antivirus = 1;
    t.battle.usarItem(2);
    expect(e.hp).toBe(999);
  });
});

describe('ondas de inimigos', () => {
  it('nunca passa do limite de inimigos na tela do andar', () => {
    for (const k of [0, 1, 6]) {
      const t = novaBatalha(k, { maxHp: 1e6, hp: 1e6 });
      let maximo = 0;
      t.simular(60, () => {
        maximo = Math.max(maximo, t.vivos().length);
        return false;
      });
      expect(maximo, `andar ${k + 1}`).toBe(ANDARES[k].maxTela);
    }
  });

  it('não repete palavras recentes no mesmo andar', () => {
    const t = novaBatalha(0, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 1e6;
    const vistas: string[] = [];
    for (let i = 0; i < 10; i++) {
      vistas.push(e.texto);
      t.digitar(e.texto.slice(e.dig));
    }
    expect(new Set(vistas).size).toBe(10);
  });

  it('o chefão do truque "invocar" chama no máximo 2 capangas, a cada 10 s', () => {
    const t = novaBatalha(2, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    // o cronômetro conta desde que o chefão aparece (inclui os 1,2 s em que ele surge)
    t.simular(10 - t.b().tempoInvocar - 0.2);
    expect(t.vivos().filter(e => !e.chefe)).toHaveLength(0);
    t.simular(0.4);
    expect(t.vivos().filter(e => !e.chefe)).toHaveLength(1);
    let maximo = 0;
    t.simular(60, () => {
      maximo = Math.max(maximo, t.vivos().filter(e => !e.chefe).length);
      return false;
    });
    expect(maximo).toBe(2);
  });

  it('vitória avisa depois de 2,4 s e derrota depois de 2 s (uma vez só)', () => {
    const t = novaBatalha(0);
    Object.assign(t.b(), { etapa: 'vitoria', tempoEtapa: 0 });
    t.battle.atualizar(2.3);
    expect(t.n('andarConcluido')).toBe(0);
    t.battle.atualizar(0.2);
    t.battle.atualizar(1);
    expect(t.n('andarConcluido')).toBe(1);
    const t2 = novaBatalha(0);
    Object.assign(t2.b(), { etapa: 'morte', tempoEtapa: 0 });
    t2.battle.atualizar(1.9);
    expect(t2.n('gameOver')).toBe(0);
    t2.battle.atualizar(0.2);
    t2.battle.atualizar(1);
    expect(t2.n('gameOver')).toBe(1);
  });

  it('prompt mostra o alvo; sem alvo, a frase do chefão (inativa)', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    const c = t.b().chefe!;
    expect(t.battle.prompt()).toEqual({ texto: c.texto, dig: c.dig, nome: c.nome, ativo: false });
    t.battle.digitar(c.texto[c.dig]);
    expect(t.battle.prompt()).toMatchObject({ texto: c.texto, dig: c.dig, ativo: true });
  });
});
