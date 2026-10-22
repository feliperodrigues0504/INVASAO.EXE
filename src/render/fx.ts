// =====================================================================
//  Efeitos visuais: chuva estilo Matrix, chão em grade, partículas,
//  números flutuantes, lasers e tremor de tela.
// =====================================================================

import { ALTURA, LARGURA } from '../game/battle';
import { rv } from './aleatorio';
import type { Sprite } from './sprites';

export const FONTE = '"VT323L", "VT323", "Consolas", monospace';

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  vida: number;
  max: number;
  cor: string;
  tam: number;
}
interface TextoFlutuante {
  x: number;
  y: number;
  str: string;
  cor: string;
  tam: number;
  vida: number;
}
interface Laser {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cor: string;
  vida: number;
  max: number;
}

const particulas: Particula[] = [];
const textos: TextoFlutuante[] = [];
const lasers: Laser[] = [];
let tremor = 0;
let reduzido = false; // efeitos reduzidos (painel do organizador): sem tremor de tela

// ---------------- chuva Matrix ----------------
const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ<>{}[]#$%&*+=/;:';
const COL = 16,
  RASTRO = 14;
const randChar = () => CHARS[Math.floor(rv() * CHARS.length)];
const colunas = Array.from({ length: LARGURA / COL }, () => ({
  y: rv() * ALTURA * 1.5,
  vel: 30 + rv() * 110,
  chars: Array.from({ length: RASTRO }, randChar),
}));

function atualizar(dt: number) {
  for (const c of colunas) {
    c.y += c.vel * dt;
    if (c.y - RASTRO * COL > ALTURA) {
      c.y = -rv() * 200;
      c.vel = 30 + rv() * 110;
    }
    if (rv() < 0.05) c.chars[Math.floor(rv() * RASTRO)] = randChar();
  }
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vida -= dt;
    if (p.vida <= 0) particulas.splice(i, 1);
  }
  for (let i = textos.length - 1; i >= 0; i--) {
    const t = textos[i];
    t.y -= 40 * dt;
    t.vida -= dt;
    if (t.vida <= 0) textos.splice(i, 1);
  }
  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].vida -= dt;
    if (lasers[i].vida <= 0) lasers.splice(i, 1);
  }
  tremor = Math.max(0, tremor - dt * 30);
}

function desenharFundo(ctx: CanvasRenderingContext2D, cor: string, t: number, comChao: boolean) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.font = `16px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < colunas.length; i++) {
    const c = colunas[i];
    for (let j = 0; j < RASTRO; j++) {
      const y = c.y - j * COL;
      if (y < -COL || y > ALTURA) continue;
      const a = j === 0 ? 0.55 : 0.28 * (1 - j / RASTRO);
      ctx.fillStyle = j === 0 ? `rgba(200,255,200,${a})` : `rgba(57,255,20,${a})`;
      ctx.fillText(c.chars[j], i * COL + COL / 2, y);
    }
  }
  if (comChao) desenharChao(ctx, cor, t);
}

// Chão em grade com perspectiva (estilo synthwave)
function desenharChao(ctx: CanvasRenderingContext2D, cor: string, t: number) {
  const horizonte = 250;
  const grad = ctx.createLinearGradient(0, horizonte, 0, ALTURA);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cx = LARGURA / 2;
  for (let i = -14; i <= 14; i++) {
    ctx.moveTo(cx + i * 12, horizonte);
    ctx.lineTo(cx + i * 140, ALTURA);
  }
  const off = (t * 0.6) % 1;
  for (let i = 0; i < 12; i++) {
    const k = (i + off) / 12;
    const y = horizonte + (ALTURA - horizonte) * k * k;
    ctx.moveTo(0, y);
    ctx.lineTo(LARGURA, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = cor;
  ctx.fillRect(0, horizonte, LARGURA, 1);
  ctx.restore();
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizonte, LARGURA, ALTURA - horizonte);
}

function desenharEfeitos(ctx: CanvasRenderingContext2D) {
  for (const l of lasers) {
    ctx.save();
    ctx.globalAlpha = l.vida / l.max;
    ctx.strokeStyle = l.cor;
    ctx.shadowColor = l.cor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    // pequeno zigue-zague "digital"
    const mx = (l.x1 + l.x2) / 2,
      my = (l.y1 + l.y2) / 2 + (rv() - 0.5) * 20;
    ctx.lineTo(mx, my);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.restore();
  }
  for (const p of particulas) {
    ctx.globalAlpha = Math.min(1, (p.vida / p.max) * 1.5);
    ctx.fillStyle = p.cor;
    ctx.fillRect(p.x, p.y, p.tam, p.tam);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of textos) {
    ctx.globalAlpha = Math.min(1, t.vida / 0.4);
    ctx.font = `${t.tam}px ${FONTE}`;
    ctx.fillStyle = '#000';
    ctx.fillText(t.str, t.x + 2, t.y + 2);
    ctx.fillStyle = t.cor;
    ctx.fillText(t.str, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

// Desfaz um sprite em partículas, pixel por pixel
function explodir(spr: Sprite, x: number, y: number) {
  const passo = spr.pixels.length > 300 ? 2 : 1;
  for (let i = 0; i < spr.pixels.length; i += passo) {
    const px = spr.pixels[i];
    const cx = px.x - spr.w / 2,
      cy = px.y - spr.h / 2;
    const ang = Math.atan2(cy, cx) + (rv() - 0.5);
    const vel = 60 + rv() * 220;
    const vida = 0.6 + rv() * 0.8;
    particulas.push({
      x: x + px.x,
      y: y + px.y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel - 80,
      g: 380,
      vida,
      max: vida,
      cor: px.c,
      tam: spr.scale,
    });
  }
}

function faiscas(x: number, y: number, cor: string, n = 12) {
  for (let i = 0; i < n; i++) {
    const ang = rv() * Math.PI * 2;
    const vel = 80 + rv() * 200;
    const vida = 0.3 + rv() * 0.4;
    particulas.push({
      x,
      y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      g: 200,
      vida,
      max: vida,
      cor,
      tam: 3 + rv() * 3,
    });
  }
}

function texto(x: number, y: number, str: string, cor = '#fff', tam = 26, vida = 1) {
  textos.push({ x, y, str, cor, tam, vida });
}

function laser(x1: number, y1: number, x2: number, y2: number, cor = '#39ff14') {
  lasers.push({ x1, y1, x2, y2, cor, vida: 0.12, max: 0.12 });
}

function tremer(v: number) {
  if (!reduzido) tremor = Math.max(tremor, v);
}

function offset() {
  if (tremor <= 0) return { x: 0, y: 0 };
  return { x: (rv() - 0.5) * tremor, y: (rv() - 0.5) * tremor };
}

function limpar() {
  particulas.length = 0;
  textos.length = 0;
  lasers.length = 0;
}

function definirReduzido(v: boolean) {
  reduzido = v;
  if (v) tremor = 0;
}

export const FX = {
  atualizar,
  desenharFundo,
  desenharEfeitos,
  explodir,
  faiscas,
  texto,
  laser,
  tremer,
  offset,
  limpar,
  definirReduzido,
  get quantidade() {
    return { particulas: particulas.length, textos: textos.length, lasers: lasers.length };
  },
};
