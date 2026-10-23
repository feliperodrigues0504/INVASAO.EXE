// =====================================================================
//  Cenário de cada andar, desenhado por código em "pixels" de 4x4, nas
//  cores do andar e com transparência: fica ATRÁS da batalha, acima da
//  chuva Matrix e antes do chão em grade. Cada um tem um detalhe animado.
// =====================================================================

import { LARGURA } from '../game/battle';

const P = 4; // tamanho do "pixel" do cenário
const HORIZONTE = 250;

type Cenario = (ctx: CanvasRenderingContext2D, t: number, cor: string, escura: string) => void;

// retângulo alinhado à grade de pixels
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(
    Math.round(x / P) * P,
    Math.round(y / P) * P,
    Math.max(P, Math.round(w / P) * P),
    Math.max(P, Math.round(h / P) * P),
  );
}

function moldura(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  px(ctx, x, y, w, P);
  px(ctx, x, y + h - P, w, P);
  px(ctx, x, y, P, h);
  px(ctx, x + w - P, y, P, h);
}

const pisca = (t: number, fase: number, vel = 2) => Math.sin(t * vel + fase) > 0;

// 1. Suporte técnico: mesas com monitores CRT, impressora e cabos pendurados
const suporte: Cenario = (ctx, t, cor, escura) => {
  for (let i = 0; i < 4; i++) {
    const x = 300 + i * 150;
    ctx.fillStyle = escura;
    px(ctx, x, 214, 120, 12); // mesa
    px(ctx, x + 8, 226, 8, 24);
    px(ctx, x + 104, 226, 8, 24);
    ctx.fillStyle = cor;
    moldura(ctx, x + 24, 160, 60, 48); // monitor
    px(ctx, x + 48, 208, 12, 8);
    ctx.globalAlpha *= pisca(t, i, 3) ? 1 : 0.5;
    px(ctx, x + 32, 168, 44, 32); // tela acesa
    ctx.globalAlpha /= pisca(t, i, 3) ? 1 : 0.5;
  }
  // impressora
  ctx.fillStyle = cor;
  moldura(ctx, 880, 180, 64, 44);
  px(ctx, 892, 168, 40, 16);
  // cabos do teto
  ctx.fillStyle = escura;
  for (let i = 0; i < 6; i++) px(ctx, 320 + i * 110, 40, P, 40 + (i % 3) * 24);
};

// 2. Sistemas operacionais: janelas flutuando, uma com barra de progresso
const so: Cenario = (ctx, t, cor, escura) => {
  const janelas = [
    [300, 90, 160, 100],
    [500, 130, 180, 90],
    [720, 80, 150, 120],
  ];
  janelas.forEach(([x, y, w, h], i) => {
    const dy = Math.sin(t * 0.8 + i) * 4;
    ctx.fillStyle = escura;
    px(ctx, x, y + dy, w, h);
    ctx.fillStyle = cor;
    moldura(ctx, x, y + dy, w, h);
    px(ctx, x, y + dy, w, 16); // barra de título
    px(ctx, x + w - 16, y + dy + 4, 8, 8);
  });
  // barra de progresso ("instalando atualizações...")
  const prog = (t * 0.15) % 1;
  ctx.fillStyle = cor;
  moldura(ctx, 512, 190, 156, 16);
  px(ctx, 516, 194, 148 * prog, 8);
};

// 3. Programação: um monitor gigante com linhas de código e cursor piscando
const programacao: Cenario = (ctx, t, cor, escura) => {
  ctx.fillStyle = escura;
  px(ctx, 320, 60, 560, 176);
  ctx.fillStyle = cor;
  moldura(ctx, 320, 60, 560, 176);
  const linhas = [
    [0, 180],
    [1, 240],
    [2, 120],
    [2, 300],
    [1, 160],
    [0, 60],
    [0, 220],
    [1, 280],
  ];
  linhas.forEach(([ind, w], i) => px(ctx, 348 + ind * 32, 80 + i * 18, w, 8));
  if (pisca(t, 0, 6)) px(ctx, 348 + 32 + 280 + 8, 80 + 7 * 18, 8, 12); // cursor
};

// 4. Banco de dados: pilhas de cilindros e uma tabela
const banco: Cenario = (ctx, t, cor, escura) => {
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 3; k++) {
      const x = 340 + s * 120,
        y = 180 - k * 40;
      ctx.fillStyle = escura;
      px(ctx, x, y, 80, 36);
      ctx.fillStyle = cor;
      px(ctx, x, y, 80, 8);
      px(ctx, x, y + 28, 80, 8);
      px(ctx, x, y, 8, 36);
      px(ctx, x + 72, y, 8, 36);
      if (pisca(t, s * 3 + k, 4)) px(ctx, x + 60, y + 16, 8, 8); // LED
    }
  }
  // tabela
  ctx.fillStyle = cor;
  for (let r = 0; r <= 4; r++) px(ctx, 720, 80 + r * 32, 200, P);
  for (let c = 0; c <= 3; c++) px(ctx, 720 + c * 64, 80, P, 128);
};

// 5. Redes: torres de roteadores ligadas por cabos, com pacotes passando
const redes: Cenario = (ctx, t, cor, escura) => {
  const torres = [320, 500, 680, 860];
  ctx.fillStyle = escura;
  torres.forEach(x => {
    px(ctx, x, 120, 40, 130);
    px(ctx, x + 16, 80, 8, 40); // antena
  });
  ctx.fillStyle = cor;
  torres.forEach((x, i) => {
    moldura(ctx, x, 120, 40, 130);
    for (let l = 0; l < 4; l++) if (pisca(t, i + l, 5)) px(ctx, x + 8 + l * 8, 136, P, P);
  });
  // cabos e pacotes andando entre as torres
  for (let i = 0; i < torres.length - 1; i++) {
    px(ctx, torres[i] + 40, 180, torres[i + 1] - torres[i] - 40, P);
    const k = (t * 0.6 + i * 0.3) % 1;
    px(ctx, torres[i] + 40 + (torres[i + 1] - torres[i] - 48) * k, 176, 12, 12);
  }
};

// 6. Nuvem: nuvens passando e racks de servidor
const nuvem: Cenario = (ctx, t, cor, escura) => {
  ctx.fillStyle = cor;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 260 + t * 12) % (LARGURA + 200)) - 100;
    const y = 60 + (i % 2) * 40;
    px(ctx, x, y + 16, 120, 24);
    px(ctx, x + 20, y, 56, 24);
    px(ctx, x + 60, y + 8, 40, 20);
  }
  for (let r = 0; r < 4; r++) {
    const x = 380 + r * 130;
    ctx.fillStyle = escura;
    px(ctx, x, 150, 64, 100);
    ctx.fillStyle = cor;
    moldura(ctx, x, 150, 64, 100);
    for (let k = 0; k < 5; k++) {
      px(ctx, x + 8, 160 + k * 18, 32, P);
      if (pisca(t, r * 5 + k, 7)) px(ctx, x + 48, 160 + k * 18, P, P);
    }
  }
};

// 7. Segurança: muro de firewall, cadeado gigante e escudo
const seguranca: Cenario = (ctx, t, cor, escura) => {
  ctx.fillStyle = escura;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) px(ctx, 300 + c * 40 + (r % 2) * 20, 190 + r * 15, 36, 12);
  // cadeado
  ctx.fillStyle = cor;
  moldura(ctx, 580, 70, 64, 56);
  px(ctx, 556, 120, 112, 72);
  ctx.fillStyle = escura;
  px(ctx, 604, 144, 16, 28); // fechadura
  // varredura (linha que desce)
  ctx.fillStyle = cor;
  px(ctx, 300, 60 + ((t * 40) % 130), 640, P);
};

// 8. Dados e IA: rede neural com sinal passando e um gráfico de barras
const dados: Cenario = (ctx, t, cor, escura) => {
  const camadas = [
    [340, [90, 140, 190]],
    [460, [70, 115, 160, 205]],
    [580, [100, 160]],
  ] as const;
  ctx.fillStyle = escura;
  for (let a = 0; a < camadas.length - 1; a++)
    for (const y1 of camadas[a][1])
      for (const y2 of camadas[a + 1][1]) {
        // ligação em escada (pixel art)
        const passos = 8;
        for (let s = 0; s < passos; s++)
          px(
            ctx,
            camadas[a][0] + 12 + ((camadas[a + 1][0] - camadas[a][0]) * s) / passos,
            y1 + ((y2 - y1) * s) / passos,
            P,
            P,
          );
      }
  ctx.fillStyle = cor;
  camadas.forEach(([x, ys], a) => ys.forEach((y, i) => px(ctx, x, y - 8, 20, 20 + (pisca(t, a * 4 + i, 3) ? 0 : -8))));
  // gráfico de barras subindo
  for (let b = 0; b < 6; b++) {
    const h = 30 + ((b * 23 + t * 20) % 90);
    px(ctx, 700 + b * 34, 240 - h, 24, h);
  }
};

// 9. Diretoria: janela panorâmica com a cidade e um relógio de parede
const diretoria: Cenario = (ctx, t, cor, escura) => {
  ctx.fillStyle = cor;
  moldura(ctx, 300, 50, 440, 196);
  ctx.fillStyle = escura;
  const predios = [
    [308, 120],
    [360, 80],
    [420, 140],
    [480, 70],
    [550, 110],
    [610, 90],
    [670, 130],
  ];
  predios.forEach(([x, y]) => px(ctx, x, y, 56, 246 - y));
  ctx.fillStyle = cor;
  predios.forEach(([x, y], i) => {
    for (let k = 0; k < 6; k++)
      if (pisca(t * 0.2, i * 7 + k, 1)) px(ctx, x + 8 + (k % 3) * 16, y + 12 + Math.floor(k / 3) * 20, 8, 8);
  });
  // relógio: o ponteiro gira (o prazo está correndo)
  const cx = 840,
    cy = 120;
  moldura(ctx, cx - 40, cy - 40, 80, 80);
  const ang = t * 1.2;
  for (let s = 0; s < 7; s++) px(ctx, cx + Math.cos(ang) * s * 4, cy + Math.sin(ang) * s * 4, P, P);
  for (let s = 0; s < 4; s++) px(ctx, cx + Math.cos(ang / 12) * s * 4, cy + Math.sin(ang / 12) * s * 4, P, P);
};

export const CENARIOS: Cenario[] = [suporte, so, programacao, banco, redes, nuvem, seguranca, dados, diretoria];

// Desenha o cenário do andar `indice` (0 a 8) com transparência
export function desenharCenario(ctx: CanvasRenderingContext2D, indice: number, t: number, cores: [string, string]) {
  const c = CENARIOS[indice];
  if (!c) return;
  ctx.save();
  ctx.globalAlpha = 0.32;
  c(ctx, t, cores[0], cores[1]);
  ctx.restore();
}

export { HORIZONTE };
