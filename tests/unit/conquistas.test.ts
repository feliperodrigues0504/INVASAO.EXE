import { describe, expect, it } from 'vitest';
import { BAL } from '../../src/content';
import { Battle } from '../../src/game/battle';
import { novaBatalha } from './ajuda';

const HABILIDADE = [
  'primeiro',
  'combo10',
  'combo20',
  'chefe',
  'limpo',
  'raiz',
  'acentos',
  'veloz',
  'investidor',
  'zerou',
];

describe('conquistas', () => {
  it('desbloqueiam uma vez só e dão bônus', () => {
    const t = novaBatalha(0);
    const p0 = t.run.pontos;
    expect(t.battle.conquista('primeiro')).toBe(true);
    expect(t.battle.conquista('primeiro')).toBe(false);
    expect(t.battle.conquista('nao_existe')).toBe(false);
    expect(t.run.pontos - p0).toBe(BAL.bonusConquista);
    expect(t.n('conquista')).toBe(1);
  });

  it('primeiro inimigo, combo x10/x20 e investidor', () => {
    const t = novaBatalha(0, { crit: 0 });
    t.ateInimigos(1);
    const e = t.vivos()[0];
    e.hp = e.maxHp = 1e6;
    for (let i = 0; i < 20; i++) {
      e.texto = 'cabos';
      e.dig = 0;
      t.digitar('cabos');
    }
    expect(t.run.conquistas).toEqual(expect.arrayContaining(['combo10', 'combo20']));
    expect(t.run.conquistas).not.toContain('primeiro');
    t.run.p.creditos = 195;
    e.hp = 1;
    e.texto = 'cabos';
    e.dig = 0;
    t.digitar('cabos');
    expect(t.run.conquistas).toEqual(expect.arrayContaining(['primeiro', 'investidor']));
  });

  it('chefão perfeito (limpo, intocável, raiz, acentos) e "por um fio"', () => {
    const t = novaBatalha(4, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    t.b().chefe!.hp = 1;
    t.digitar(t.b().chefe!.texto);
    expect(t.run.conquistas).toEqual(expect.arrayContaining(['chefe', 'limpo', 'intocavel', 'raiz', 'acentos']));
    expect(t.run.conquistas).not.toContain('porumfio');

    // o contrário: com erro, dano, item e vida baixa
    const t2 = novaBatalha(0, { maxHp: 100 });
    t2.ateChefe();
    const c = t2.b().chefe!;
    t2.battle.digitar('#'); // erro
    c.atk = c.intervalo;
    t2.battle.atualizar(0.05); // dano
    t2.run.inventario.cafe = 1;
    t2.battle.usarItem(0); // item
    t2.run.p.hp = 5;
    c.hp = 1;
    t2.digitar(c.texto.slice(c.dig));
    expect(t2.run.conquistas).toContain('porumfio');
    for (const id of ['limpo', 'intocavel', 'raiz', 'acentos']) expect(t2.run.conquistas).not.toContain(id);
  });

  it('"Fibra Óptica" mede a velocidade real da frase do chefão', () => {
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6, crit: 0 });
    t.ateChefe();
    const c = t.b().chefe!;
    c.hp = 1e6;
    // devagar: 1 letra a cada 0,5 s (24 ppm) → não ganha
    for (const ch of c.texto.slice(c.dig)) {
      t.battle.digitar(ch);
      t.battle.atualizar(0.5);
    }
    expect(t.run.conquistas).not.toContain('veloz');
    // rápido: 1 letra a cada 0,1 s (120 ppm) → ganha
    for (const ch of c.texto.slice(c.dig)) {
      t.battle.digitar(ch);
      t.battle.atualizar(0.1);
    }
    expect(t.run.conquistas).toContain('veloz');
  });
});

// Um jogador perfeito (sem erros, 20 letras/s, sem comprar nada) joga a partida inteira
function jogadorPerfeito(modo: 'normal' | 'rapido') {
  const battle = new Battle();
  const run = battle.novaPartida('perfeito', modo, { semente: 2026 });
  run.p.maxHp = run.p.hp = 1e6;
  let concluidos = 0;
  battle.on('andarConcluido', () => concluidos++);
  for (let k = 0; k < run.rota.length; k++) {
    battle.iniciarAndar();
    const antes = concluidos;
    for (let t = 0; t < 900 && concluidos === antes; t += 0.05) {
      const b = battle.estado!;
      if (b.etapa === 'ondas' || b.etapa === 'chefe') {
        const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : b.inimigos.find(e => !e.morrendo);
        if (alvo) battle.digitar(alvo.texto[alvo.dig]);
      }
      battle.atualizar(0.05);
    }
    expect(concluidos, `${modo}: andar ${k + 1} não terminou`).toBe(antes + 1);
    battle.registrarAndar(true);
    if (k < run.rota.length - 1) battle.avancar();
  }
  battle.encerrar(true);
  return run;
}

describe('conteúdo: toda conquista de habilidade é alcançável', () => {
  it.each(['rapido', 'normal'] as const)('no modo %s, um jogador perfeito alcança todas', modo => {
    const run = jogadorPerfeito(modo);
    for (const id of HABILIDADE) expect(run.conquistas, `"${id}" ficou impossível`).toContain(id);
    expect(run.stats.maiorCombo).toBeGreaterThanOrEqual(20);
  });
});
