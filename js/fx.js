// =====================================================================
//  Efeitos visuais: chuva estilo Matrix, chão em grade, partículas,
//  números flutuantes, lasers e tremor de tela.
// =====================================================================

const LARGURA = 960, ALTURA = 540;
const FONTE = '"VT323L", "VT323", "Consolas", monospace';

const FX = (() => {
  const particulas = [];
  const textos = [];
  const lasers = [];
  let tremor = 0;

  // ---------------- chuva Matrix ----------------
  const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ<>{}[]#$%&*+=/;:';
  const COL = 16, RASTRO = 14;
  const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];
  const colunas = [];
  for (let i = 0; i < LARGURA / COL; i++) {
    colunas.push({
      y: Math.random() * ALTURA * 1.5,
      vel: 30 + Math.random() * 110,
      chars: Array.from({ length: RASTRO }, randChar),
    });
  }

  function atualizar(dt) {
    for (const c of colunas) {
      c.y += c.vel * dt;
      if (c.y - RASTRO * COL > ALTURA) { c.y = -Math.random() * 200; c.vel = 30 + Math.random() * 110; }
      if (Math.random() < 0.05) c.chars[Math.floor(Math.random() * RASTRO)] = randChar();
    }
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt;
      if (p.vida <= 0) particulas.splice(i, 1);
    }
    for (let i = textos.length - 1; i >= 0; i--) {
      const t = textos[i];
      t.y -= 40 * dt; t.vida -= dt;
      if (t.vida <= 0) textos.splice(i, 1);
    }
    for (let i = lasers.length - 1; i >= 0; i--) {
      lasers[i].vida -= dt;
      if (lasers[i].vida <= 0) lasers.splice(i, 1);
    }
    tremor = Math.max(0, tremor - dt * 30);
  }

  function desenharFundo(ctx, cor, t, comChao) {
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
  function desenharChao(ctx, cor, t) {
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
      ctx.moveTo(0, y); ctx.lineTo(LARGURA, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = cor;
    ctx.fillRect(0, horizonte, LARGURA, 1);
    ctx.restore();
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonte, LARGURA, ALTURA - horizonte);
  }

  function desenharEfeitos(ctx) {
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
      const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2 + (Math.random() - 0.5) * 20;
      ctx.lineTo(mx, my);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of particulas) {
      ctx.globalAlpha = Math.min(1, p.vida / p.max * 1.5);
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
  function explodir(spr, x, y) {
    const passo = spr.pixels.length > 300 ? 2 : 1;
    for (let i = 0; i < spr.pixels.length; i += passo) {
      const px = spr.pixels[i];
      const cx = px.x - spr.w / 2, cy = px.y - spr.h / 2;
      const ang = Math.atan2(cy, cx) + (Math.random() - 0.5);
      const vel = 60 + Math.random() * 220;
      const vida = 0.6 + Math.random() * 0.8;
      particulas.push({
        x: x + px.x, y: y + px.y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 80,
        g: 380, vida, max: vida, cor: px.c, tam: spr.scale,
      });
    }
  }

  function faiscas(x, y, cor, n = 12) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = 80 + Math.random() * 200;
      const vida = 0.3 + Math.random() * 0.4;
      particulas.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, g: 200, vida, max: vida, cor, tam: 3 + Math.random() * 3 });
    }
  }

  function texto(x, y, str, cor = '#fff', tam = 26, vida = 1) {
    textos.push({ x, y, str, cor, tam, vida });
  }

  function laser(x1, y1, x2, y2, cor = '#39ff14') {
    lasers.push({ x1, y1, x2, y2, cor, vida: 0.12, max: 0.12 });
  }

  function tremer(v) { tremor = Math.max(tremor, v); }

  function offset() {
    if (tremor <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * tremor, y: (Math.random() - 0.5) * tremor };
  }

  function limpar() { particulas.length = 0; textos.length = 0; lasers.length = 0; }

  return { atualizar, desenharFundo, desenharEfeitos, explodir, faiscas, texto, laser, tremer, offset, limpar };
})();
