import { describe, expect, it } from 'vitest';
import { ESTADOS, MENUS_DA_PARTIDA, TRANSICOES, transicaoValida, type Estado } from '../../src/ui/estados';

describe('máquina de estados das telas', () => {
  it('toda transição aponta para um estado que existe', () => {
    for (const [de, paras] of Object.entries(TRANSICOES))
      for (const para of paras) expect(ESTADOS, `${de} → ${para}`).toContain(para);
  });

  it('todas as telas são alcançáveis a partir do título', () => {
    const visitados = new Set<Estado>(['titulo']);
    const fila: Estado[] = ['titulo'];
    while (fila.length)
      for (const p of TRANSICOES[fila.shift()!])
        if (!visitados.has(p)) {
          visitados.add(p);
          fila.push(p);
        }
    const faltam = ESTADOS.filter(e => e !== 'carregando' && !visitados.has(e));
    expect(faltam).toEqual([]);
  });

  it('de qualquer tela é possível voltar ao título (o quiosque nunca fica preso)', () => {
    for (const e of ESTADOS) expect(transicaoValida(e, 'titulo')).toBe(true);
  });

  it('o ciclo completo de um visitante é válido', () => {
    const ciclo: Estado[] = [
      'titulo',
      'nick',
      'modo',
      'tutorial',
      'banner',
      'batalha',
      'concluido',
      'upgrade',
      'escolhendo',
      'loja',
      'banner',
      'batalha',
      'pausa',
      'fim',
      'relatorio',
      'ranking',
      'titulo',
    ];
    for (let i = 1; i < ciclo.length; i++)
      expect(transicaoValida(ciclo[i - 1], ciclo[i]), `${ciclo[i - 1]} → ${ciclo[i]}`).toBe(true);
  });

  it('pulos proibidos são rejeitados', () => {
    expect(transicaoValida('titulo', 'batalha')).toBe(false);
    expect(transicaoValida('fim', 'ranking')).toBe(false); // relatório não pode ser pulado
    expect(transicaoValida('upgrade', 'loja')).toBe(false); // passa por "escolhendo"
    expect(transicaoValida('nick', 'painel')).toBe(false);
  });

  it('abandonar um menu da partida sempre pode encerrar a partida', () => {
    for (const e of MENUS_DA_PARTIDA) expect(transicaoValida(e, 'fim'), e).toBe(true);
  });
});
