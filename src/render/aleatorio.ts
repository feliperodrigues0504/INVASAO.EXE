// Aleatoriedade só VISUAL (partículas, chuva Matrix, tremidas). Fica separada
// da aleatoriedade do jogo para que o visual nunca mude o resultado de uma partida.
// Com ?semente=N na URL, o visual também fica idêntico (screenshots de teste).
// A semente é lida aqui, na carga do módulo, porque a chuva Matrix é criada
// assim que o fx.ts é importado.

import { criarRng, sementeAleatoria, type Rng } from '../game/rng';

function sementeDaUrl(): number | null {
  if (typeof location === 'undefined') return null; // testes no Node
  const s = new URLSearchParams(location.search).get('semente');
  return s != null && /^\d+$/.test(s) ? Number(s) : null;
}

let rng: Rng = criarRng(sementeDaUrl() ?? sementeAleatoria());

export const rv = (): number => rng();
export function semearVisual(semente: number): void {
  rng = criarRng(semente);
}
