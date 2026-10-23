// Mecânicas da versão 4: inimigos com comportamento próprio, truques dos chefões,
// contra-ataque, palavras especiais, overdrive, cartas novas, sinergias, rota de
// elite, servidor misterioso e a trilha do fantasma do recordista.

import { describe, expect, it } from 'vitest';
import { ANDARES, MEC, SINERGIAS, UPGRADES } from '../../src/content';
import { Battle, CHEGADA_PACOTE, PASSO_TRILHA } from '../../src/game/battle';
import { novaBatalha } from './ajuda';

const carta = (id: string) => UPGRADES.find(u => u.id === id)!;
const umInimigo = (t: ReturnType<typeof novaBatalha>) => {
  t.ateInimigos(1);
  const e = t.vivos()[0];
  e.hp = e.maxHp = 9999;
  return e;
};

describe('inimigos com mecânica própria', () => {
  it('phishing: completar a palavra-armadilha fere VOCÊ, zera o combo e não fere o inimigo', () => {
    const t = novaBatalha(6, { crit: 0 });
    const e = umInimigo(t);
    Object.assign(e, { mecanica: 'armadilha', armadilha: true, armadilhaT: 99, texto: 'senha', dig: 0 });
    t.b().combo = 8;
    t.digitar('senha');
    expect(t.run.p.hp).toBe(100 - e.dano);
    expect(t.b().combo).toBe(0);
    expect(e.hp).toBe(9999);
    expect(e.armadilha).toBe(false); // a próxima palavra é normal
  });

  it('phishing: a armadilha some sozinha depois de alguns segundos', () => {
    const t = novaBatalha(6);
    const e = umInimigo(t);
    Object.assign(e, { mecanica: 'armadilha', armadilha: true, armadilhaT: MEC.armadilha.duracao, texto: 'senha' });
    t.simular(MEC.armadilha.duracao - 0.3);
    expect(e.armadilha).toBe(true);
    t.simular(0.6);
    expect(e.armadilha).toBe(false);
    expect(e.texto).not.toBe('senha');
  });

  it('worm: se replica uma vez num espaço livre (a cópia não se replica)', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    const e = umInimigo(t);
    Object.assign(e, { mecanica: 'replicar', timerMec: 0.1, replica: false });
    t.simular(0.2);
    const worms = t.vivos().filter(o => o.nome === 'worm.bat');
    expect(worms).toHaveLength(1);
    expect(worms[0].replica).toBe(true);
    expect(worms[0].maxHp).toBe(Math.round(ANDARES[0].hp * MEC.replicar.fracaoVida));
    t.simular(MEC.replicar.tempo + 1);
    expect(t.vivos().filter(o => o.nome === 'worm.bat')).toHaveLength(1);
  });

  it('glitch: embaralha a palavra se ninguém começar; começada, ela fica', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    const e = umInimigo(t);
    Object.assign(e, { mecanica: 'embaralhar', timerMec: 0.1, texto: 'teclado', dig: 0 });
    t.simular(0.2);
    expect(e.texto).not.toBe('teclado');
    e.timerMec = 0.1;
    t.battle.digitar(e.texto[0]); // começou
    const palavra = e.texto;
    t.simular(0.5);
    expect(e.texto).toBe(palavra);
  });

  it('pacote: atravessa a tela e, se chegar, causa dano extra e some', () => {
    const t = novaBatalha(3, { maxHp: 1000, hp: 1000 });
    const e = umInimigo(t);
    Object.assign(e, { mecanica: 'atravessar', avanco: 0, origemX: e.x });
    const x0 = e.x;
    t.simular(0.5);
    expect(e.x).toBeLessThan(x0);
    t.simular(e.intervalo * MEC.atravessar.fatorTempo + 1);
    expect(e.morrendo).toBe(true);
    expect(1000 - t.run.p.hp).toBe(Math.round(e.dano * MEC.atravessar.multDano));
    expect(t.n('dano')).toBe(1); // não ataca de longe: só ao chegar
    expect(CHEGADA_PACOTE).toBeLessThan(x0);
  });

  it('vírus: ao morrer, infecta o vizinho mais próximo com uma palavra longa', () => {
    const t = novaBatalha(1, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t.ateInimigos(2);
    const [a, b] = t.vivos();
    Object.assign(a, { mecanica: 'infectar', hp: 1, texto: 'abc', dig: 0 });
    Object.assign(b, { mecanica: 'nenhuma', texto: 'xyz', dig: 0 });
    let infectou = 0;
    t.battle.on('infectou', () => infectou++);
    t.digitar('abc');
    expect(infectou).toBe(1);
    const tamanhos = ANDARES[1].palavras.map(w => w.length).sort((x, y) => x - y);
    expect(b.texto.length).toBeGreaterThanOrEqual(tamanhos[Math.floor(tamanhos.length * 0.7)]);
  });
});

describe('truques dos chefões', () => {
  it('impressora: a frase chega aos poucos; letra que não chegou não conta como erro', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe({ manterTruques: true });
    const c = t.b().chefe!;
    expect(c.truques).toContain('impressao');
    // logo depois de aparecer, nada foi impresso
    const erros = t.run.stats.erros;
    t.battle.digitar(c.texto[0]);
    expect(c.dig).toBe(0);
    expect(t.run.stats.erros).toBe(erros);
    t.simular(MEC.impressao.atraso + 1);
    expect(c.visivel).toBeGreaterThanOrEqual(Math.floor(MEC.impressao.letrasPorSeg * 0.9));
    t.battle.digitar(c.texto[0]);
    expect(c.dig).toBe(1);
  });

  it('Wi-Fi: a frase chega em rajadas (lag)', () => {
    const t = novaBatalha(4, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe({ manterTruques: true });
    const c = t.b().chefe!;
    expect(c.truques).toContain('lag');
    const vistos: number[] = [];
    for (let i = 0; i < 40; i++) {
      t.battle.atualizar(0.05);
      vistos.push(c.visivel ?? c.texto.length);
    }
    const saltos = vistos
      .slice(1)
      .map((v, i) => v - vistos[i])
      .filter(d => d > 0);
    expect(saltos.length).toBeGreaterThan(0);
    expect(Math.max(...saltos)).toBeLessThanOrEqual(MEC.lag.pacoteMax);
  });

  it('DROP TABLE: parar de digitar no meio da frase desfaz as últimas letras (rollback)', () => {
    const t = novaBatalha(3, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    const c = t.b().chefe!;
    expect(c.truques).toContain('rollback');
    t.digitar(c.texto.slice(0, 6));
    expect(c.dig).toBe(6);
    t.simular(MEC.rollback.ocioso - 0.3);
    expect(c.dig).toBe(6);
    t.simular(0.5);
    expect(c.dig).toBe(6 - MEC.rollback.letras);
  });

  it('Ransomware: a partir da 2ª frase, só a próxima letra aparece', () => {
    const t = novaBatalha(6, { maxHp: 1e6, hp: 1e6, crit: 0 });
    t.ateChefe({ manterTruques: true });
    const c = t.b().chefe!;
    expect(c.cifrado).toBe(false); // a 1ª frase é legível
    c.hp = c.maxHp = 1e6;
    t.digitar(c.texto.slice(c.dig));
    expect(c.cifrado).toBe(true);
    const mascara = Battle.mascarar(c);
    expect(mascara[c.dig]).toBe(c.texto[c.dig]);
    expect(mascara.slice(c.dig + 1).replace(/ /g, '')).toMatch(/^\**$/);
  });

  it('I.A. Rebelde: escolhe a frase com as letras que você mais errou', () => {
    const t = novaBatalha(7, { maxHp: 1e6, hp: 1e6, crit: 0 });
    t.ateChefe();
    const c = t.b().chefe!;
    c.hp = c.maxHp = 1e6;
    t.run.stats.errosTecla = { ç: 50, ã: 50 };
    const alvo = c.frases.reduce((melhor, f) => {
      const nota = (x: string) => [...x].filter(ch => ch === 'ç' || ch === 'ã').length / x.length;
      return nota(f) > nota(melhor) ? f : melhor;
    });
    t.digitar(c.texto.slice(c.dig));
    expect(c.texto).toBe(alvo);
  });

  it('Prazo de Entrega: quando o relógio zera, ataca mais rápido e mais forte', () => {
    const t = novaBatalha(8, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    const c = t.b().chefe!;
    const intervalo = c.intervalo;
    const dano = c.dano;
    let estourou = 0;
    t.battle.on('prazoEstourado', () => estourou++);
    t.simular(MEC.prazo.segundos + 0.5);
    expect(estourou).toBe(1);
    expect(c.estourado).toBe(true);
    expect(c.dano).toBe(Math.round(dano * MEC.prazo.multDano));
    expect(c.intervalo).toBeLessThan(intervalo);
  });
});

describe('contra-ataque, palavras especiais e overdrive', () => {
  it('contra-ataque: terminar com a barra quase cheia anula o ataque e dá dano extra', () => {
    const t = novaBatalha(0, { crit: 0 });
    const e = umInimigo(t);
    e.texto = 'cabos';
    e.dig = 0;
    e.atk = e.intervalo * (MEC.parry.limite + 0.01);
    t.digitar('cabos');
    expect(e.atk).toBe(0);
    expect(9999 - e.hp).toBe(Math.round(10 * 1.05) + Math.round(e.dano * MEC.parry.bonusDano));
    expect(t.run.stats.parries).toBe(1);
    // com a barra baixa, não há contra-ataque
    e.texto = 'cabos';
    e.dig = 0;
    e.atk = e.intervalo * 0.5;
    const antes = e.hp;
    t.digitar('cabos');
    expect(antes - e.hp).toBe(Math.round(10 * 1.1));
  });

  it('palavra dourada rende créditos extras; explosiva fere os vizinhos; corrompida cura se errar', () => {
    const t = novaBatalha(1, { crit: 0, maxHp: 1e6, hp: 1e6 });
    t.ateInimigos(2);
    const [a, b] = t.vivos();
    a.hp = a.maxHp = b.hp = b.maxHp = 9999;
    Object.assign(a, { texto: 'abcde', dig: 0, especial: 'dourada' });
    const cred = t.run.p.creditos;
    t.digitar('abcde');
    expect(t.run.p.creditos - cred).toBe(Math.round(a.recompensa * MEC.especiais.multCreditosDourada));
    Object.assign(a, { texto: 'abcde', dig: 0, especial: 'explosiva' });
    const hpB = b.hp;
    t.digitar('abcde');
    expect(hpB - b.hp).toBe(Math.round(Math.round(10 * 1.1) * MEC.especiais.fracaoExplosao));
    Object.assign(a, { texto: 'abcde', dig: 0, especial: 'corrompida', hp: 5000 });
    t.digitar('a#');
    expect(a.hp).toBe(5000 + Math.round(a.maxHp * MEC.especiais.curaCorrompida));
    expect(a.especial).toBe(null);
  });

  it('overdrive: ao chegar no combo x20, o próximo golpe causa dano triplo (uma vez)', () => {
    const t = novaBatalha(0, { crit: 0 });
    const e = umInimigo(t);
    t.b().combo = 19;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos');
    expect(t.b().overdrive).toBe(true);
    const antes = e.hp;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos');
    expect(antes - e.hp).toBe(Math.round(Math.round(10 * (1 + 20 * 0.05)) * MEC.overdrive.multDano));
    expect(t.b().overdrive).toBe(false);
  });
});

describe('cartas de risco e recompensa, sinergias e rerrolar', () => {
  it('Modo Root: cada letra errada custa 2 de integridade', () => {
    const t = novaBatalha(0);
    t.battle.aplicarUpgrade(carta('modoroot'));
    umInimigo(t);
    t.battle.digitar('#');
    expect(t.run.p.hp).toBe(98);
  });

  it('Deploy na Sexta: levar dano zera o combo (em vez de cortar pela metade)', () => {
    const t = novaBatalha(0);
    t.battle.aplicarUpgrade(carta('deploysexta'));
    const e = umInimigo(t);
    t.b().combo = 10;
    e.atk = e.intervalo;
    t.battle.atualizar(0.001);
    expect(t.b().combo).toBe(0);
  });

  it('Café Duplo: a manutenção entre andares cura metade', () => {
    const t = novaBatalha(0, { hp: 10 });
    t.battle.aplicarUpgrade(carta('cafeduplo'));
    expect(t.battle.curarEntreAndares()).toBe(Math.round(100 * 0.25 * 0.5));
    const t2 = novaBatalha(0, { hp: 10 });
    expect(t2.battle.curarEntreAndares()).toBe(25);
  });

  it('sinergia: N cartas da mesma área ativam o bônus uma única vez', () => {
    const t = novaBatalha(0);
    const s = SINERGIAS.find(x => x.area === 'seguranca')!;
    const ativadas: string[] = [];
    t.battle.on('sinergia', x => ativadas.push(x.nome));
    const cartas = UPGRADES.filter(u => u.area === 'seguranca');
    expect(cartas.length).toBeGreaterThan(s.minimo);
    // as N-1 primeiras não ativam; a N-ésima ativa
    for (let i = 0; i < s.minimo - 1; i++) expect(t.battle.aplicarUpgrade(cartas[i])).toBe(null);
    const antes = { ...t.run.p };
    expect(t.battle.aplicarUpgrade(cartas[s.minimo - 1])?.nome).toBe(s.nome);
    // o efeito da sinergia foi somado ao da própria carta
    const depoisDaCarta = { ...antes };
    for (const ef of cartas[s.minimo - 1].efeitos)
      (depoisDaCarta as Record<string, unknown>)[ef.atributo] =
        ef.op === 'set'
          ? ef.valor
          : ef.op === 'add'
            ? (antes as never)[ef.atributo] + (ef.valor as number)
            : (antes as never)[ef.atributo] * (ef.valor as number);
    for (const ef of s.efeitos)
      expect((t.run.p as never)[ef.atributo], ef.atributo).toBeCloseTo(
        (depoisDaCarta as never)[ef.atributo] + (ef.valor as number),
      );
    t.battle.aplicarUpgrade(cartas[s.minimo]);
    expect(ativadas).toEqual([s.nome]);
    expect(t.battle.progressoAreas().seguranca).toBe(s.minimo + 1);
  });

  it('rerrolar: troca as cartas por créditos, e o preço sobe a cada uso', () => {
    const t = novaBatalha(0);
    t.run.p.creditos = MEC.rerrolar.custo + MEC.rerrolar.custo + MEC.rerrolar.aumento - 1;
    expect(t.battle.rerrolar()).toHaveLength(3);
    expect(t.battle.custoRerrolar()).toBe(MEC.rerrolar.custo + MEC.rerrolar.aumento);
    expect(t.battle.rerrolar()).toBe(null); // falta 1 crédito
  });
});

describe('rota de elite, servidor misterioso e fantasma', () => {
  it('rota de elite: inimigos mais fortes, mais créditos e mais pontos, só no andar escolhido', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.battle.escolherRota(true);
    t.battle.iniciarAndar();
    t.ateInimigos(1);
    const e = t.vivos()[0];
    expect(e.elite).toBe(true);
    expect(e.maxHp).toBe(Math.round(ANDARES[0].hp * MEC.elite.multVida));
    expect(e.dano).toBe(Math.round(ANDARES[0].dano * MEC.elite.multDano));
    expect(e.recompensa).toBe(Math.round(ANDARES[0].recompensa * MEC.elite.multRecompensa));
    const antes = t.run.pontos;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos');
    expect(t.run.pontos - antes).toBe(Math.round(5 * 10 * 1.05 * MEC.elite.multPontos));
    t.battle.iniciarAndar(); // o andar seguinte volta a ser normal
    expect(t.b().elite).toBe(false);
  });

  it('servidor misterioso: aposta dobra ou perde; sem créditos não dá para apostar', () => {
    const t = novaBatalha(0);
    t.run.p.creditos = 10;
    expect(t.battle.apostarServidor()).toEqual({ resultado: 'sem credito' });
    const resultados = new Set<string>();
    for (let i = 0; i < 30; i++) {
      t.run.p.creditos = 100;
      const r = t.battle.apostarServidor();
      resultados.add(r.resultado);
      expect(t.run.p.creditos).toBe(r.resultado === 'ganhou' ? 150 : 50);
    }
    expect(resultados).toEqual(new Set(['ganhou', 'perdeu']));
  });

  it('a trilha do fantasma anota a pontuação a cada intervalo de batalha', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    t.simular(PASSO_TRILHA * 3 + 0.1);
    expect(t.run.trilha.length).toBeGreaterThanOrEqual(4);
    expect(t.run.trilha.every(v => Number.isFinite(v))).toBe(true);
  });
});
