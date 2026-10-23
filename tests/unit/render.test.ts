import { beforeAll, describe, expect, it } from 'vitest';
import { ANDARES } from '../../src/content';
import { desenharBatalha } from '../../src/render/battleRenderer';
import { ligarEfeitos } from '../../src/render/efeitosBatalha';
import { FX } from '../../src/render/fx';
import { sprite } from '../../src/render/sprites';
import { criarCtxFalso, novaBatalha, usarCanvasFalso } from './ajuda';

beforeAll(usarCanvasFalso);

describe('render da batalha', () => {
  it.each(ANDARES.map((A, i) => [i + 1, A.nome, i] as const))(
    'andar %i (%s): inimigos, chefão, falas, glitch, café e escudo desenham sem erro',
    (_n, _nome, k) => {
      const { ctx, contagem } = criarCtxFalso();
      const t = novaBatalha(k, { maxHp: 1e6, hp: 1e6 });
      t.ateInimigos(1);
      t.b().lento = 5;
      t.b().escudo = 1;
      t.b().alvo = t.vivos()[0];
      t.vivos()[0].tremor = 0.2;
      for (let i = 0; i < 5; i++) desenharBatalha(ctx, t.battle, i);
      t.ateChefe();
      const chefe = t.b().chefe!;
      chefe.fala = 'TESTE DE FALA BEM COMPRIDA PARA VER O LIMITE DO BALÃO';
      chefe.falaT = 2;
      chefe.investida = 0.2;
      for (let i = 0; i < 40; i++) {
        FX.desenharFundo(ctx, ANDARES[k].cores[0], i * 0.1, true);
        desenharBatalha(ctx, t.battle, i * 0.1);
        FX.desenharEfeitos(ctx);
      }
      expect(contagem.drawImage).toBeGreaterThan(0);
      expect(contagem.fillText).toBeGreaterThan(0);
    },
  );

  it('derrota e vitória (sem jogador / barra do chefão) desenham sem erro', () => {
    const { ctx } = criarCtxFalso();
    const t = novaBatalha(0, { maxHp: 1e6, hp: 1e6 });
    t.ateChefe();
    t.b().etapa = 'vitoria';
    desenharBatalha(ctx, t.battle, 1);
    t.b().etapa = 'morte';
    desenharBatalha(ctx, t.battle, 1);
  });

  it('palavra mais longa de cada andar cabe no rótulo (métrica aproximada)', () => {
    // A medição real (com a fonte) é feita no teste E2E; aqui é uma checagem rápida
    // com largura média de 13 px por letra da VT323 a 26 px.
    for (const A of ANDARES) {
      const maior = A.palavras.reduce((a, b) => (b.length > a.length ? b : a));
      expect([...maior].length * 13 + 16 + 34 + 10, `"${maior}"`).toBeLessThanOrEqual(960);
    }
  });
});

describe('efeitos ligados aos eventos da batalha', () => {
  it('acerto gera laser; golpe gera números e faíscas; abate explode o sprite', () => {
    const t = novaBatalha(0, { crit: 0 });
    ligarEfeitos(t.battle);
    FX.limpar();
    t.ateInimigos(1);
    const e = t.vivos()[0];
    t.battle.digitar(e.texto[0]);
    expect(FX.quantidade.lasers).toBe(1);
    t.digitar(e.texto.slice(1));
    expect(FX.quantidade.textos).toBeGreaterThan(0);
    expect(FX.quantidade.particulas).toBeGreaterThan(sprite(e.sprite, e.escala, e.paleta).pixels.length / 2);
  });

  it('com efeitos reduzidos, nada faz a tela tremer', () => {
    FX.definirReduzido(true);
    FX.tremer(20);
    expect(FX.offset()).toEqual({ x: 0, y: 0 });
    FX.definirReduzido(false);
    FX.tremer(20);
    expect(FX.offset()).not.toEqual({ x: 0, y: 0 });
  });
});
