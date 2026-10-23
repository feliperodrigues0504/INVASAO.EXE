// =====================================================================
//  Converte a pixel art (content/sprites.ts) em canvas, uma vez só.
// =====================================================================

import { ICONES } from '../content/icones';
import { SPRITES } from '../content/sprites';
import { COR } from '../paleta';

export interface Sprite {
  canvas: CanvasImageSource;
  flash: CanvasImageSource; // silhueta branca (inimigo atingido)
  ferido: CanvasImageSource; // silhueta vermelha (jogador levou dano; chefão chegando)
  w: number;
  h: number;
  scale: number;
  pixels: { x: number; y: number; c: string }[]; // para a explosão em partículas
}

type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
type FabricaCanvas = (w: number, h: number) => CanvasLike;

let fabrica: FabricaCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// os testes no Node trocam a fábrica por um canvas falso
export function definirFabricaCanvas(f: FabricaCanvas): void {
  fabrica = f;
  cache.clear();
}

const cache = new Map<string, Sprite>();

export function sprite(nome: string, scale: number, palOverride?: Record<string, string>): Sprite {
  const key = `${nome}|${scale}|${palOverride ? JSON.stringify(palOverride) : ''}`;
  const pronto = cache.get(key);
  if (pronto) return pronto;
  const def = SPRITES[nome] ?? ICONES[nome];
  if (!def) throw new Error(`sprite inexistente: ${nome}`);
  const pal = { ...def.pal, ...palOverride };
  const h = def.grid.length;
  const w = Math.max(...def.grid.map(r => r.length));
  const canvas = fabrica(w * scale, h * scale);
  const flash = fabrica(w * scale, h * scale);
  const ferido = fabrica(w * scale, h * scale);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const fctx = flash.getContext('2d') as CanvasRenderingContext2D;
  fctx.fillStyle = '#ffffff';
  const rctx = ferido.getContext('2d') as CanvasRenderingContext2D;
  rctx.fillStyle = COR.perigo;
  const pixels: Sprite['pixels'] = [];
  for (let y = 0; y < h; y++) {
    const row = def.grid[y];
    for (let x = 0; x < row.length; x++) {
      const color = pal[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
      fctx.fillRect(x * scale, y * scale, scale, scale);
      rctx.fillRect(x * scale, y * scale, scale, scale);
      pixels.push({ x: x * scale, y: y * scale, c: color });
    }
  }
  const s: Sprite = { canvas, flash, ferido, w: w * scale, h: h * scale, pixels, scale };
  cache.set(key, s);
  return s;
}
