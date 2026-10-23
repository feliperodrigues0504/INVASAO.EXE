// Design da versão 4: cenários por andar, elevador, entrada do chefão, ícones e paleta
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANDARES } from '../../src/content';
import { EMOJI_PARA_ICONE, ICONES } from '../../src/content/icones';
import { SPRITES } from '../../src/content/sprites';
import { COR, COR_CSS } from '../../src/paleta';
import { desenharEntradaChefe } from '../../src/render/battleRenderer';
import { CENARIOS, desenharCenario } from '../../src/render/cenarios';
import { DURACAO_ELEVADOR, desenharElevador, progressoElevador } from '../../src/render/elevador';
import { FX } from '../../src/render/fx';
import { sprite } from '../../src/render/sprites';
import { criarCtxFalso, usarCanvasFalso } from './ajuda';

beforeAll(usarCanvasFalso);

describe('cenários dos andares', () => {
  it('existe um cenário para cada andar', () => {
    expect(CENARIOS).toHaveLength(ANDARES.length);
  });

  it.each(ANDARES.map((A, i) => [i + 1, A.nome, i] as const))('andar %i (%s) desenha sem erro', (_n, _nome, k) => {
    const { ctx, contagem } = criarCtxFalso();
    for (let i = 0; i < 30; i++) desenharCenario(ctx, k, i * 0.37, ANDARES[k].cores);
    FX.desenharFundo(ctx, ANDARES[k].cores[0], 1, true, (c, tt) => desenharCenario(c, k, tt, ANDARES[k].cores));
    expect(contagem.fillRect).toBeGreaterThan(20);
  });
});

describe('elevador entre andares', () => {
  it('portas fechadas mostram o painel; depois de abrir, não desenha nada', () => {
    const fechado = criarCtxFalso();
    desenharElevador(fechado.ctx, 0.2, 0, 1);
    expect(fechado.contagem.fillText).toBeGreaterThan(0);
    const aberto = criarCtxFalso();
    desenharElevador(aberto.ctx, 0.95, 3, 4);
    expect(aberto.contagem.fillRect ?? 0).toBe(0);
    for (let p = 0; p <= 1; p += 0.05) desenharElevador(criarCtxFalso().ctx, p, 8, 9);
  });

  it('o progresso vai de 0 a 1 na duração da transição', () => {
    expect(progressoElevador(0)).toBe(0);
    expect(progressoElevador(DURACAO_ELEVADOR)).toBeCloseTo(1);
    expect(progressoElevador(-1)).toBe(0);
  });
});

describe('entrada do chefão', () => {
  it.each(ANDARES.map(A => [A.chefe.sprite] as const))('%s entra sem erro durante todo o alerta', nome => {
    const { ctx, contagem } = criarCtxFalso();
    for (let tempo = 0; tempo <= 3.4; tempo += 0.1) desenharEntradaChefe(ctx, nome, tempo, tempo);
    expect(contagem.drawImage).toBeGreaterThan(0);
  });
});

describe('ícones em pixel art', () => {
  it('cada emoji trocado aponta para um ícone que existe', () => {
    for (const [emoji, nome] of Object.entries(EMOJI_PARA_ICONE))
      expect(ICONES[nome as keyof typeof ICONES], emoji).toBeDefined();
  });

  it('ícones têm 8x8 e não colidem com nomes de sprites', () => {
    for (const nome of Object.keys(ICONES)) {
      expect(SPRITES[nome as keyof typeof SPRITES], nome).toBeUndefined();
      const s = sprite(nome, 1);
      expect([s.w, s.h], nome).toEqual([8, 8]);
    }
  });

  it('o jogador tem o quadro de digitação e a silhueta vermelha de dano', () => {
    const s = sprite('hacker_digita', 4);
    expect(s.w).toBe(sprite('hacker', 4).w);
    expect(sprite('hacker', 4).ferido).toBeDefined();
  });
});

describe('paleta centralizada', () => {
  it('as variáveis do CSS têm as mesmas cores de src/paleta.ts', () => {
    const css = readFileSync('src/styles/style.css', 'utf8');
    const raiz = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    for (const [variavel, nome] of Object.entries(COR_CSS)) {
      const m = raiz.match(new RegExp(`${variavel}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m?.[1].toLowerCase(), variavel).toBe(COR[nome].toLowerCase());
    }
  });
});
