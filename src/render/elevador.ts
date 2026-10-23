// =====================================================================
//  Transição de elevador entre os andares: portas fechadas com o painel
//  subindo de andar, depois as portas se abrem para o andar novo.
//  Desenhada por cima da batalha enquanto o banner do andar está na tela.
// =====================================================================

import { ALTURA, LARGURA } from '../game/battle';
import { COR } from '../paleta';
import { FONTE } from './fx';

export const DURACAO_ELEVADOR = 2.2; // segundos (o banner dura 3,6 s)
const FECHADO_ATE = 0.55; // fração do tempo com as portas fechadas
const ABERTO_EM = 0.9; // fração em que as portas terminam de abrir

const METAL = '#2a2f37';
const METAL_CLARO = '#4a525e';
const METAL_ESCURO = '#16191e';

function porta(ctx: CanvasRenderingContext2D, x: number, w: number, espelhar: boolean) {
  if (w <= 0) return;
  ctx.fillStyle = METAL;
  ctx.fillRect(x, 0, w, ALTURA);
  // frisos verticais de metal escovado
  ctx.fillStyle = METAL_CLARO;
  for (let fx = 24; fx < LARGURA / 2; fx += 48) {
    const px = espelhar ? x + w - fx : x + fx;
    if (px > x && px < x + w) ctx.fillRect(px, 40, 4, ALTURA - 80);
  }
  // borda da porta (onde as duas se encontram)
  ctx.fillStyle = METAL_ESCURO;
  ctx.fillRect(espelhar ? x : x + w - 6, 0, 6, ALTURA);
}

// progresso: 0 = portas fechadas, 1 = transição terminou
export function desenharElevador(ctx: CanvasRenderingContext2D, progresso: number, de: number, para: number) {
  const rotulo = (n: number) => (n <= 0 ? 'T' : String(n)); // T = térreo
  if (progresso >= ABERTO_EM) return;
  const abertura = progresso <= FECHADO_ATE ? 0 : Math.min(1, (progresso - FECHADO_ATE) / (ABERTO_EM - FECHADO_ATE));
  // aceleração suave na abertura
  const suave = abertura * abertura * (3 - 2 * abertura);
  const meio = LARGURA / 2;
  const w = meio * (1 - suave);
  ctx.save();
  porta(ctx, 0, w, false);
  porta(ctx, LARGURA - w, w, true);

  if (abertura === 0) {
    // painel do elevador: o número sobe de "de" para "para"
    const subindo = Math.min(1, progresso / FECHADO_ATE);
    const andar = rotulo(subindo < 0.6 ? de : para);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(meio - 70, 54, 140, 64);
    ctx.strokeStyle = COR.verde;
    ctx.lineWidth = 2;
    ctx.strokeRect(meio - 70 + 1, 54 + 1, 138, 62);
    ctx.fillStyle = COR.verde;
    ctx.font = `40px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${andar}`, meio + 16, 88);
    // seta "subindo" piscando
    if (Math.floor(progresso * 12) % 2 === 0) ctx.fillText('▲', meio - 28, 86);
  }
  ctx.restore();
}

// fração da transição a partir do tempo desde o início do banner
export const progressoElevador = (segundos: number) => Math.max(0, segundos / DURACAO_ELEVADOR);
