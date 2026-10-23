// Gera src-tauri/app-icon.png (1024x1024) a partir do sprite do hacker.
// Depois: `npm run tauri icon src-tauri/app-icon.png` gera os .ico/.png do app.
// Uso: node scripts/gerar-icone.ts   (Node 22.6+ roda TypeScript direto)

import fs from 'node:fs';
import zlib from 'node:zlib';
import { SPRITES } from '../src/content/sprites.ts';

const TAM = 1024;
const FUNDO = [0x05, 0x0d, 0x05, 255];
const BORDA = [0x39, 0xff, 0x14, 255];

const hex = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).concat(255);

const { pal, grid } = SPRITES.hacker;
const largura = Math.max(...grid.map(l => l.length));
const escala = Math.floor((TAM * 0.78) / Math.max(largura, grid.length));
const x0 = Math.floor((TAM - largura * escala) / 2);
const y0 = Math.floor((TAM - grid.length * escala) / 2);

const px = Buffer.alloc(TAM * TAM * 4);
for (let y = 0; y < TAM; y++)
  for (let x = 0; x < TAM; x++) {
    const borda = x < 40 || y < 40 || x >= TAM - 40 || y >= TAM - 40;
    const dentro = x >= 56 && y >= 56 && x < TAM - 56 && y < TAM - 56;
    let cor = borda ? [0, 0, 0, 0] : dentro ? FUNDO : BORDA;
    const gx = Math.floor((x - x0) / escala),
      gy = Math.floor((y - y0) / escala);
    const ch = grid[gy]?.[gx];
    if (ch && pal[ch]) cor = hex(pal[ch]);
    px.set(cor, (y * TAM + x) * 4);
  }

// PNG mínimo: assinatura + IHDR + IDAT + IEND
const chunk = (tipo: string, dados: Buffer) => {
  const t = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TAM, 0);
ihdr.writeUInt32BE(TAM, 4);
ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
const linhas = Buffer.alloc(TAM * (TAM * 4 + 1));
for (let y = 0; y < TAM; y++) px.copy(linhas, y * (TAM * 4 + 1) + 1, y * TAM * 4, (y + 1) * TAM * 4);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.mkdirSync('src-tauri', { recursive: true });
fs.writeFileSync('src-tauri/app-icon.png', png);
console.info(`src-tauri/app-icon.png gerado (${TAM}x${TAM}, ${(png.length / 1024).toFixed(1)} KB)`);
