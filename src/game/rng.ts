// =====================================================================
//  Gerador de números aleatórios com semente (mulberry32).
//  Mesma semente = mesma partida: um bug pode ser reproduzido com exatidão
//  (?semente=123 na URL) e os testes não precisam trocar o Math.random.
// =====================================================================

export type Rng = () => number;

export function criarRng(semente: number): Rng {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sementeAleatoria = (): number => (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;

export const sortear = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
