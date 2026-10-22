// Aleatoriedade só VISUAL (partículas, chuva Matrix, tremidas). Fica separada
// da aleatoriedade do jogo para que o visual nunca mude o resultado de uma partida.
// Com ?semente=N na URL, o visual também fica idêntico (screenshots de teste).

import { criarRng, sementeAleatoria, type Rng } from '../game/rng';

let rng: Rng = criarRng(sementeAleatoria());

export const rv = (): number => rng();
export function semearVisual(semente: number): void {
  rng = criarRng(semente);
}
