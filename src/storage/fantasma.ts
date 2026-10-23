// =====================================================================
//  Fantasma do recordista: a trilha de pontos da melhor partida de cada
//  modo. Durante a batalha, o HUD compara você com o recordista no
//  mesmo momento da partida dele.
// =====================================================================

import type { ModoId } from '../content';
import { lerJson, type Armazenamento } from './armazenamento';
import { NICK_MAX } from './nick';

export const CHAVE_FANTASMA = 'invasao_exe_fantasma_v1';
const TRILHA_MAX = 2000; // ~2,7 h de batalha com um ponto a cada 5 s: mais que suficiente

export interface Fantasma {
  nick: string;
  pontos: number;
  trilha: number[];
}

type Fantasmas = Partial<Record<ModoId, Fantasma>>;

function valido(f: unknown): f is Fantasma {
  if (!f || typeof f !== 'object') return false;
  const x = f as Record<string, unknown>;
  return (
    typeof x.nick === 'string' &&
    typeof x.pontos === 'number' &&
    Number.isFinite(x.pontos) &&
    Array.isArray(x.trilha) &&
    x.trilha.every(v => typeof v === 'number' && Number.isFinite(v))
  );
}

export function criarFantasmas(arm: Armazenamento) {
  function todos(): Fantasmas {
    const d = lerJson(arm, CHAVE_FANTASMA);
    const saida: Fantasmas = {};
    if (d && typeof d === 'object') {
      for (const modo of ['normal', 'rapido'] as const) {
        const f = (d as Record<string, unknown>)[modo];
        if (valido(f)) saida[modo] = { nick: f.nick.slice(0, NICK_MAX), pontos: f.pontos, trilha: f.trilha };
      }
    }
    return saida;
  }

  const carregar = (modo: ModoId): Fantasma | null => todos()[modo] ?? null;

  // Guarda a partida se ela bateu o recorde do modo. Devolve true se virou o novo fantasma.
  function registrar(modo: ModoId, nick: string, pontos: number, trilha: number[]): boolean {
    const atual = todos();
    if ((atual[modo]?.pontos ?? -1) >= pontos) return false;
    atual[modo] = { nick, pontos, trilha: trilha.slice(0, TRILHA_MAX) };
    arm.gravar(CHAVE_FANTASMA, JSON.stringify(atual));
    return true;
  }

  const limpar = () => arm.gravar(CHAVE_FANTASMA, JSON.stringify({}));

  // Pontos que o recordista tinha nesse ponto da batalha
  function pontosNoMomento(f: Fantasma, segundos: number, passo: number): number {
    if (!f.trilha.length) return 0;
    const i = Math.min(f.trilha.length - 1, Math.floor(segundos / passo));
    return f.trilha[i];
  }

  return { carregar, registrar, limpar, pontosNoMomento, CHAVE: CHAVE_FANTASMA };
}

export type GerenciadorFantasmas = ReturnType<typeof criarFantasmas>;
