// =====================================================================
//  Desenho da batalha no canvas. Só LÊ o estado da batalha (nunca altera).
// =====================================================================

import { ALTURA, ESCALA_CHEFE, LARGURA, POS_CHEFE, POS_JOGADOR, type Battle, type Inimigo } from '../game/battle';
import { rv } from './aleatorio';
import { Animacao } from './animacao';
import { FONTE } from './fx';
import { sprite, type Sprite } from './sprites';
import { COR } from '../paleta';

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
    // digitando: alterna os quadros das mãos; ferido: pisca em vermelho
    const quadro = Animacao.digitando && Math.floor(t * 14) % 2 === 0 ? 'hacker_digita' : 'hacker';
    const spr = sprite(quadro, ESCALA_JOGADOR);
    const bob = Math.sin(t * 2.5) * 2;
    const x = Math.round(POS_JOGADOR.x - spr.w / 2),
      y = Math.round(POS_JOGADOR.y - spr.h + bob);
    sombra(ctx, POS_JOGADOR.x, POS_JOGADOR.y, 44);
    ctx.drawImage(spr.canvas, x, y);
    if (Animacao.ferido > 0) {
      ctx.save();
      ctx.globalAlpha = 0.75 * Animacao.ferido;
      ctx.drawImage(spr.ferido, x, y);
      ctx.restore();
    }
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
      ctx.strokeStyle = COR.defesa;
      ctx.shadowColor = COR.defesa;
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.5 + Math.sin(t * 5) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      hexagono(ctx, POS_JOGADOR.x, POS_JOGADOR.y - 55, 72);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (b.etapa === 'alerta') desenharEntradaChefe(ctx, b.A.chefe.sprite, b.tempoEtapa, t);
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
    ctx.strokeStyle = COR.recompensa;
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
    // "respiração": leve compressão vertical, com os pés sempre no chão
    const resp = e.nascendo > 0 ? 1 : 1 + Math.sin(t * 2.6 + e.bob) * 0.035;
    const alt = Math.round(spr.h * resp);
    ctx.drawImage(img, x, y + spr.h - alt, spr.w, alt);
  }
  ctx.restore();

  // barras: vida e ataque
  const larg = e.chefe ? 170 : 84;
  const bx = Math.round(e.x - larg / 2),
    by = e.y + 8;
  if (!e.chefe) barra(ctx, bx, by, larg, 6, e.hp / e.maxHp, COR.verde);
  const prop = Math.max(0, e.atk / e.intervalo);
  const perigo = prop > 0.8 && Math.floor(t * 10) % 2 === 0;
  barra(ctx, bx, by + (e.chefe ? 0 : 9), larg, e.chefe ? 7 : 5, prop, perigo ? COR.branco : COR.perigo);
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
  ctx.strokeStyle = estilo?.cor ?? (alvo ? COR.verde : 'rgba(57,255,20,0.35)');
  ctx.lineWidth = alvo || estilo ? 2 : 1;
  // armadilha: moldura TRACEJADA, além da cor (quem não distingue vermelho também percebe)
  if (e.armadilha) ctx.setLineDash([6, 4]);
  ctx.strokeRect(x - 8 + 0.5, y - 15 + 0.5, total + 16, 30);
  if (e.armadilha) ctx.setLineDash([]);
  if (estilo) {
    // selo em pixel art no canto da palavra: alerta, moeda, explosão ou caveira corrompida
    const icone = sprite(estilo.icone, 2);
    txt.drawImage(icone.canvas, x + total + 2, y - 26);
  }
  if (alvo) {
    txt.fillStyle = e.armadilha ? COR.perigo : COR.verde;
    txt.fillText('▶', x - 26, y);
  }
  let cx = x;
  for (let i = 0; i < e.texto.length; i++) {
    if (e.armadilha) txt.fillStyle = i < e.dig ? COR.perigoClaro : COR.perigo;
    else if (i < e.dig) txt.fillStyle = COR.verde;
    else if (i === e.dig) txt.fillStyle = alvo ? COR.branco : COR.verdeTexto;
    else txt.fillStyle = alvo ? COR.verdeClaro : COR.verdeApagado;
    txt.fillText(e.texto[i], cx, y + 1);
    if (i === e.dig && alvo) txt.fillRect(cx, y + 12, larguras[i], 2);
    cx += larguras[i];
  }
}

const ESTILOS_ESPECIAIS = {
  dourada: { cor: COR.recompensa, icone: 'moeda' },
  explosiva: { cor: COR.explosao, icone: 'explosao' },
  corrompida: { cor: COR.corrompido, icone: 'corrompido' },
} as const;

export function estiloRotulo(e: Inimigo): { cor: string; icone: string } | null {
  if (e.armadilha) return { cor: COR.perigo, icone: 'alerta' };
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
  txt.fillStyle = COR.perigo;
  txt.fillText(e.titulo ?? e.nome, x, y - 4, w); // maxWidth: nomes longos são comprimidos, nunca vazam
  txt.textAlign = 'right';
  txt.textBaseline = 'top';
  txt.font = `20px ${FONTE}`;
  txt.fillStyle = COR.perigoClaro;
  txt.fillText(`${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`, x + w, y + h + 2);
  // Prazo de Entrega: relógio regressivo (pisca nos últimos 10 s)
  if (e.truques.includes('prazo')) {
    const seg = Math.max(0, Math.ceil(e.prazoT));
    const urgente = e.estourado || (seg <= 10 && Math.floor(t * 4) % 2 === 0);
    txt.textAlign = 'left';
    txt.fillStyle = urgente ? COR.perigo : COR.combo;
    txt.fillText(
      e.estourado ? 'PRAZO ESTOURADO!' : `PRAZO ${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`,
      x,
      y + h + 2,
    );
  }
  if (e.elite) {
    txt.textAlign = 'right';
    txt.fillStyle = COR.recompensa;
    txt.font = `14px "SilkscreenL", "Silkscreen", ${FONTE}`;
    txt.fillText('ELITE', x + w, y - 22);
  }
  barra(ctx, x, y, w, h, e.hp / e.maxHp, e.metade && Math.floor(t * 4) % 2 ? COR.perigoPulso : COR.perigo);
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
  ctx.strokeStyle = COR.perigo;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y - 15.5, w, 32);
  ctx.globalAlpha = 1;
  txt.globalAlpha = alfa;
  txt.fillStyle = COR.perigoTexto;
  txt.fillText(fala, x + w / 2, y + 1, w - 16);
  txt.globalAlpha = 1;
}

// Entrada do chefão (durante o alerta, antes de ele surgir): a tela escurece, faixas
// vermelhas passam e a silhueta gigante dele desliza da direita para o lugar dele.
const DURACAO_ALERTA = 3.2;
export function desenharEntradaChefe(ctx: CanvasRenderingContext2D, nomeSprite: string, tempo: number, t: number) {
  const spr = sprite(nomeSprite, ESCALA_CHEFE);
  const escala = 1.6;
  const w = spr.w * escala,
    h = spr.h * escala;
  const chegada = Math.min(1, tempo / 0.9);
  const suave = 1 - Math.pow(1 - chegada, 3); // desacelera no fim
  const sumindo = Math.max(0, Math.min(1, (tempo - (DURACAO_ALERTA - 0.6)) / 0.6));
  ctx.save();
  ctx.globalAlpha = 0.6 * (1 - sumindo);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  // faixas vermelhas de "ameaça" correndo na diagonal
  ctx.globalAlpha = 0.18 * (1 - sumindo);
  ctx.fillStyle = COR.perigo;
  const desloc = (t * 120) % 80;
  for (let x = -ALTURA; x < LARGURA + 80; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x + desloc, 0);
    ctx.lineTo(x + desloc + 30, 0);
    ctx.lineTo(x + desloc + 30 + ALTURA, ALTURA);
    ctx.lineTo(x + desloc + ALTURA, ALTURA);
    ctx.fill();
  }
  // silhueta vermelha gigante
  const x = LARGURA + 40 - (LARGURA + 40 - (POS_CHEFE.x - w / 2)) * suave;
  ctx.globalAlpha = 0.85 * (1 - sumindo);
  ctx.drawImage(spr.ferido, Math.round(x), Math.round(POS_CHEFE.y - h + 30), w, h);
  ctx.restore();
}
