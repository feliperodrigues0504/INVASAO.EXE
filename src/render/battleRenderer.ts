// =====================================================================
//  Desenho da batalha no canvas. Só LÊ o estado da batalha (nunca altera).
// =====================================================================

import { ALTURA, LARGURA, POS_JOGADOR, type Battle, type Inimigo } from '../game/battle';
import { rv } from './aleatorio';
import { FONTE } from './fx';
import { sprite, type Sprite } from './sprites';

export const ESCALA_JOGADOR = 6;
export const spriteDe = (e: Inimigo): Sprite => sprite(e.sprite, e.escala, e.paleta);

// ctx = camada base (fundo, sprites, barras) em 960x540; txt = camada de TEXTO, na
// resolução real da tela (palavras e números nítidos). Em 960x540 as duas são a mesma.
export function desenharBatalha(
  ctx: CanvasRenderingContext2D,
  battle: Battle,
  t: number,
  txt: CanvasRenderingContext2D = ctx,
) {
  const b = battle.estado;
  if (!b) return;
  // jogador
  if (b.etapa !== 'morte') {
    const spr = sprite('hacker', ESCALA_JOGADOR);
    const bob = Math.sin(t * 2.5) * 2;
    const x = Math.round(POS_JOGADOR.x - spr.w / 2),
      y = Math.round(POS_JOGADOR.y - spr.h + bob);
    sombra(ctx, POS_JOGADOR.x, POS_JOGADOR.y, 44);
    ctx.drawImage(spr.canvas, x, y);
    // brilho da tela do notebook
    ctx.save();
    const brilho = ctx.createRadialGradient(x + 78, y + 75, 2, x + 78, y + 75, 34);
    brilho.addColorStop(0, `rgba(57,255,20,${0.3 + Math.sin(t * 8) * 0.08})`);
    brilho.addColorStop(1, 'rgba(57,255,20,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(x + 40, y + 40, 76, 70);
    ctx.restore();
    if (b.escudo > 0) {
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      hexagono(ctx, POS_JOGADOR.x, POS_JOGADOR.y - 55, 72);
      ctx.stroke();
      ctx.restore();
    }
  }

  const ordenados = b.inimigos.slice().sort((x, y) => x.y - y.y);
  for (const e of ordenados) desenharInimigo(ctx, e, t);
  for (const e of ordenados) if (!e.chefe && !e.morrendo) desenharRotulo(ctx, txt, e, b.alvo === e);
  if (b.chefe && (b.etapa === 'chefe' || b.etapa === 'vitoria')) desenharBarraChefe(ctx, txt, b.chefe, t);
  for (const e of ordenados) if (e.fala && e.falaT > 0 && !e.morrendo) desenharFala(ctx, txt, e);

  // filtro azul enquanto o café está ativo
  if (b.lento > 0) {
    ctx.fillStyle = `rgba(0, 120, 255, ${0.08 + Math.sin(t * 6) * 0.03})`;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }
}

function sombra(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexagono(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + Math.cos(a) * r,
      y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
}

function desenharInimigo(ctx: CanvasRenderingContext2D, e: Inimigo, t: number) {
  if (e.morrendo) return;
  const spr = spriteDe(e);
  let x = e.x - spr.w / 2;
  let y = e.y - spr.h + Math.sin(t * 3 + e.bob) * (e.chefe ? 4 : 3);
  if (e.tremor > 0) {
    x += (rv() - 0.5) * 10;
    y += (rv() - 0.5) * 6;
  }
  if (e.investida > 0) x -= Math.sin((1 - e.investida / 0.35) * Math.PI) * (e.chefe ? 60 : 45);
  x = Math.round(x);
  y = Math.round(y);

  sombra(ctx, e.x, e.y, spr.w * 0.4);
  // inimigo de elite (rota de elite): aura dourada pulsando
  if (e.elite) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, spr.w * 0.48, spr.w * 0.13, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  if (e.nascendo > 0) ctx.globalAlpha = rv() < 0.5 ? 0.3 : 0.8;
  const img = e.flash > 0 ? spr.flash : spr.canvas;
  const glitch = e.chefe && e.truques.includes('glitch') && rv() < 0.12;
  if (glitch) {
    // fatias deslocadas + separação de cor
    const fatias = 6,
      hF = spr.h / fatias;
    for (let i = 0; i < fatias; i++) {
      const dx = (rv() - 0.5) * 24;
      ctx.drawImage(img, 0, i * hF, spr.w, hF, x + dx, y + i * hF, spr.w, hF);
    }
    ctx.globalAlpha = 0.4;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, x + 6, y);
  } else {
    ctx.drawImage(img, x, y);
  }
  ctx.restore();

  // barras: vida e ataque
  const larg = e.chefe ? 170 : 84;
  const bx = Math.round(e.x - larg / 2),
    by = e.y + 8;
  if (!e.chefe) barra(ctx, bx, by, larg, 6, e.hp / e.maxHp, '#39ff14');
  const prop = Math.max(0, e.atk / e.intervalo);
  const perigo = prop > 0.8 && Math.floor(t * 10) % 2 === 0;
  barra(ctx, bx, by + (e.chefe ? 0 : 9), larg, e.chefe ? 7 : 5, prop, perigo ? '#ffffff' : '#ff3355');
}

function barra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, prop: number, cor: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, prop))), h);
}

// Margens do rótulo: 34px de folga à esquerda para a seta ▶, 10px à direita
export const ROTULO = { fonte: 26, folgaEsq: 34, folgaDir: 10, padding: 8 };

// Caixa com a palavra sobre o inimigo (parte digitada em verde)
function desenharRotulo(ctx: CanvasRenderingContext2D, txt: CanvasRenderingContext2D, e: Inimigo, alvo: boolean) {
  txt.font = `${ROTULO.fonte}px ${FONTE}`;
  txt.textBaseline = 'middle';
  txt.textAlign = 'left';
  const larguras = [...e.texto].map(ch => txt.measureText(ch).width);
  const total = larguras.reduce((a, c) => a + c, 0);
  let x = e.x - total / 2;
  x = Math.max(ROTULO.folgaEsq, Math.min(LARGURA - total - ROTULO.folgaDir, x));
  const y = e.y - spriteDe(e).h - 24;
  // cor da moldura: armadilha (vermelho), palavras especiais, alvo (verde) ou normal
  const estilo = estiloRotulo(e);
  ctx.fillStyle = e.armadilha ? 'rgba(60,0,8,0.92)' : alvo ? 'rgba(0,40,0,0.92)' : 'rgba(0,0,0,0.8)';
  ctx.fillRect(x - 8, y - 15, total + 16, 30);
  ctx.strokeStyle = estilo?.cor ?? (alvo ? '#39ff14' : 'rgba(57,255,20,0.35)');
  ctx.lineWidth = alvo || estilo ? 2 : 1;
  ctx.strokeRect(x - 8 + 0.5, y - 15 + 0.5, total + 16, 30);
  if (estilo) {
    // selo à direita da palavra: ⚠ armadilha, $ dourada, ✹ explosiva, ☣ corrompida
    txt.font = `18px ${FONTE}`;
    txt.fillStyle = estilo.cor;
    txt.fillText(estilo.selo, x + total + 12, y - 12);
    txt.font = `${ROTULO.fonte}px ${FONTE}`;
  }
  if (alvo) {
    txt.fillStyle = e.armadilha ? '#ff3355' : '#39ff14';
    txt.fillText('▶', x - 26, y);
  }
  let cx = x;
  for (let i = 0; i < e.texto.length; i++) {
    if (e.armadilha) txt.fillStyle = i < e.dig ? '#ff99aa' : '#ff3355';
    else if (i < e.dig) txt.fillStyle = '#39ff14';
    else if (i === e.dig) txt.fillStyle = alvo ? '#ffffff' : '#e6ffe6';
    else txt.fillStyle = alvo ? '#d0ffd0' : '#9fbf9f';
    txt.fillText(e.texto[i], cx, y + 1);
    if (i === e.dig && alvo) txt.fillRect(cx, y + 12, larguras[i], 2);
    cx += larguras[i];
  }
}

const ESTILOS_ESPECIAIS = {
  dourada: { cor: '#ffd700', selo: '$' },
  explosiva: { cor: '#ff8c1a', selo: '✹' },
  corrompida: { cor: '#b46cff', selo: '☣' },
} as const;

export function estiloRotulo(e: Inimigo): { cor: string; selo: string } | null {
  if (e.armadilha) return { cor: '#ff3355', selo: '⚠' };
  return e.especial ? ESTILOS_ESPECIAIS[e.especial] : null;
}

function desenharBarraChefe(ctx: CanvasRenderingContext2D, txt: CanvasRenderingContext2D, e: Inimigo, t: number) {
  const x = 280,
    y = 66,
    w = 380,
    h = 16;
  txt.font = `18px "SilkscreenL", "Silkscreen", ${FONTE}`;
  txt.textAlign = 'left';
  txt.textBaseline = 'bottom';
  txt.fillStyle = '#ff3355';
  txt.fillText(e.titulo ?? e.nome, x, y - 4, w); // maxWidth: nomes longos são comprimidos, nunca vazam
  txt.textAlign = 'right';
  txt.textBaseline = 'top';
  txt.font = `20px ${FONTE}`;
  txt.fillStyle = '#ff99aa';
  txt.fillText(`${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`, x + w, y + h + 2);
  // Prazo de Entrega: relógio regressivo (pisca nos últimos 10 s)
  if (e.truques.includes('prazo')) {
    const seg = Math.max(0, Math.ceil(e.prazoT));
    const urgente = e.estourado || (seg <= 10 && Math.floor(t * 4) % 2 === 0);
    txt.textAlign = 'left';
    txt.fillStyle = urgente ? '#ff3355' : '#ffd23f';
    txt.fillText(
      e.estourado ? 'PRAZO ESTOURADO!' : `PRAZO ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`,
      x,
      y + h + 2,
    );
  }
  if (e.elite) {
    txt.textAlign = 'right';
    txt.fillStyle = '#ffd700';
    txt.font = `14px "SilkscreenL", "Silkscreen", ${FONTE}`;
    txt.fillText('ELITE', x + w, y - 22);
  }
  barra(ctx, x, y, w, h, e.hp / e.maxHp, e.metade && Math.floor(t * 4) % 2 ? '#ff6680' : '#ff3355');
  // segmentos
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + (w / 10) * i, y, 1, h);
}

function desenharFala(ctx: CanvasRenderingContext2D, txt: CanvasRenderingContext2D, e: Inimigo) {
  const fala = e.fala ?? '';
  txt.font = `20px ${FONTE}`;
  txt.textAlign = 'center';
  txt.textBaseline = 'middle';
  const w = Math.min(380, txt.measureText(fala).width + 24);
  let x = e.x - w / 2;
  x = Math.max(10, Math.min(LARGURA - w - 10, x));
  const y = e.y - spriteDe(e).h - (e.chefe ? 46 : 70);
  const alfa = Math.min(1, e.falaT * 2);
  ctx.globalAlpha = alfa;
  ctx.fillStyle = 'rgba(30,0,5,0.92)';
  ctx.fillRect(x, y - 16, w, 32);
  ctx.strokeStyle = '#ff3355';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y - 15.5, w, 32);
  ctx.globalAlpha = 1;
  txt.globalAlpha = alfa;
  txt.fillStyle = '#ffccd5';
  txt.fillText(fala, x + w / 2, y + 1, w - 16);
  txt.globalAlpha = 1;
}
