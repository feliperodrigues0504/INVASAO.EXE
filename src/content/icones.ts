// =====================================================================
//  Ícones 8x8 em pixel art, no mesmo formato dos sprites (cada letra é
//  uma cor; '.' é transparente). Substituem os emojis (⚠ ★ ⚡ 👻 🏆...),
//  que eram desenhados com a fonte do sistema, fora do estilo do jogo.
// =====================================================================

import type { SpriteDef } from './sprites';

const R = '#ff3355'; // perigo
const W = '#ffffff';
const O = '#ff8c1a'; // explosão
const Y = '#ffd700'; // recompensa
const D = '#9a7400'; // dourado escuro
const P = '#b46cff'; // corrompido
const K = '#14001f';
const Q = '#ff2bd6'; // especial
const G = '#e6ffe6';
const N = '#050805';

export const ICONES: Record<string, SpriteDef> = {
  alerta: {
    pal: { R, W },
    grid: ['...RR...', '..RRRR..', '..RWWR..', '.RRWWRR.', '.RRWWRR.', 'RRRRRRRR', 'RRRWWRRR', 'RRRRRRRR'],
  },
  explosao: {
    pal: { O, Y },
    grid: ['O..O...O', '.O.O..O.', '..OYYO..', 'OOYYYYOO', '..OYYO..', '.O.OO.O.', 'O..O..O.', '...O....'],
  },
  corrompido: {
    pal: { P, K },
    grid: ['.PPPPPP.', 'PPPPPPPP', 'PKKPPKKP', 'PKKPPKKP', 'PPPPPPPP', '.PPKKPP.', '.PKPPKP.', '..PPPP..'],
  },
  moeda: {
    pal: { Y, D },
    grid: ['..YYYY..', '.YYDDYY.', 'YYDYYYYY', 'YYYDDYYY', 'YYYYYDYY', 'YYYYYDYY', '.YYDDYY.', '..YYYY..'],
  },
  fantasma: {
    pal: { G, N },
    grid: ['..GGGG..', '.GGGGGG.', 'GGNGGNGG', 'GGNGGNGG', 'GGGGGGGG', 'GGGGGGGG', 'GGGGGGGG', 'G.GG.GG.'],
  },
  raio: {
    pal: { Q },
    grid: ['....QQQ.', '...QQQ..', '..QQQ...', '.QQQQQQ.', '...QQQ..', '..QQQ...', '.QQQ....', 'QQ......'],
  },
  estrela: {
    pal: { Y },
    grid: ['...YY...', '...YY...', 'YYYYYYYY', '.YYYYYY.', '..YYYY..', '.YYYYYY.', '.YY..YY.', 'YY....YY'],
  },
  trofeu: {
    pal: { Y, D },
    grid: ['.YYYYYY.', 'YYYYYYYY', 'Y.YYYY.Y', '.YYYYYY.', '..YYYY..', '...DD...', '..YYYY..', '.YYYYYY.'],
  },
};

// Emoji/símbolo de texto → ícone (para trocar em textos da interface)
export const EMOJI_PARA_ICONE: Record<string, keyof typeof ICONES> = {
  '⚠': 'alerta',
  '✹': 'explosao',
  '☣': 'corrompido',
  '👻': 'fantasma',
  '⚡': 'raio',
  '★': 'estrela',
  '🏆': 'trofeu',
};
