// =====================================================================
//  Ranking salvo no computador do evento, separado por modo de jogo.
// =====================================================================

import type { ModoId } from '../content';
import { lerJson, type Armazenamento } from './armazenamento';
import { NICK_MAX } from './nick';

export const CHAVE_RANKING = 'invasao_exe_ranking_v1';
export const LIMITE_POR_MODO = 1000;

export interface Resultado {
  id: string | number;
  nick: string;
  pontos: number;
  andar: number;
  total: number;
  venceu: boolean;
  ppm: number;
  precisao: number;
  data: string;
  modo: ModoId;
  conquistas: string[];
}

export type NovoResultado = Omit<Resultado, 'id' | 'data' | 'modo' | 'total' | 'conquistas'> &
  Partial<Pick<Resultado, 'data' | 'modo' | 'total' | 'conquistas'>>;

export interface Posicao {
  posicao: number;
  total: number;
  id: Resultado['id'] | null;
  modo: ModoId;
}

const finito = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const novoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function criarRanking(arm: Armazenamento) {
  // Lê o ranking ignorando qualquer dado corrompido ou de versões antigas
  function carregar(): Resultado[] {
    const dados = lerJson(arm, CHAVE_RANKING);
    if (!Array.isArray(dados)) return [];
    return dados
      .filter(
        (e): e is Record<string, unknown> =>
          !!e && typeof e === 'object' && typeof e.nick === 'string' && Number.isFinite(e.pontos),
      )
      .map(e => ({
        id: typeof e.id === 'string' || typeof e.id === 'number' ? e.id : novoId(),
        nick: (e.nick as string).slice(0, NICK_MAX),
        pontos: Math.round(e.pontos as number),
        andar: finito(e.andar, 1),
        venceu: !!e.venceu,
        ppm: finito(e.ppm, 0),
        precisao: finito(e.precisao, 0),
        data: typeof e.data === 'string' ? e.data : '',
        modo: e.modo === 'rapido' ? ('rapido' as const) : ('normal' as const),
        total: finito(e.total, 9),
        conquistas: Array.isArray(e.conquistas) ? e.conquistas.filter((c): c is string => typeof c === 'string') : [],
      }))
      .sort((a, b) => b.pontos - a.pontos);
  }

  function salvar(lista: Resultado[]) {
    arm.gravar(CHAVE_RANKING, JSON.stringify(lista));
  }

  // Adiciona e devolve a posição dentro do ranking do mesmo modo (1 = primeiro lugar).
  // O limite é POR MODO: um dia cheio de partidas rápidas não apaga o ranking do normal.
  function adicionar(entrada: NovoResultado): Posicao {
    const modo: ModoId = entrada.modo === 'rapido' ? 'rapido' : 'normal';
    const novo: Resultado = {
      total: 9,
      conquistas: [],
      data: new Date().toISOString(),
      ...entrada,
      modo,
      id: novoId(),
    };
    const lista = carregar();
    lista.push(novo);
    lista.sort((a, b) => b.pontos - a.pontos);
    const doModo = lista.filter(e => e.modo === modo);
    const outros = lista.filter(e => e.modo !== modo);
    salvar([...doModo.slice(0, LIMITE_POR_MODO), ...outros].sort((a, b) => b.pontos - a.pontos));
    return { posicao: doModo.findIndex(e => e.id === novo.id) + 1, total: doModo.length, id: novo.id, modo };
  }

  const top = (n: number, modo?: ModoId) =>
    carregar()
      .filter(e => !modo || e.modo === modo)
      .slice(0, n);

  // Posição que uma pontuação teria, sem salvar (partidas de teste ?andar=N)
  function simular(pontos: number, modo: ModoId): Posicao {
    const doModo = carregar().filter(r => r.modo === modo);
    return { posicao: doModo.filter(r => r.pontos > pontos).length + 1, total: doModo.length, id: null, modo };
  }

  const limpar = () => salvar([]);

  return { carregar, adicionar, top, simular, limpar, CHAVE: CHAVE_RANKING };
}

export type Ranking = ReturnType<typeof criarRanking>;
