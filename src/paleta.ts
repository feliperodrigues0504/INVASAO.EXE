// =====================================================================
//  Paleta do jogo: cada cor tem um SIGNIFICADO, e o mesmo significado
//  usa sempre a mesma cor (no canvas, no HUD e nos textos do log).
//  As cores principais também existem no CSS (:root) com os mesmos
//  valores; um teste confere que as duas listas não se desencontram.
//  (As cores dos sprites são arte e ficam em content/sprites.ts.)
// =====================================================================

export const COR = {
  // acerto, progresso, o "verde de terminal" do jogo
  verde: '#39ff14',
  verdeTexto: '#e6ffe6',
  verdeClaro: '#d0ffd0',
  verdeApagado: '#9fbf9f',
  // perigo: dano, ataque, armadilha, erro
  perigo: '#ff3355',
  perigoClaro: '#ff99aa',
  perigoTexto: '#ffccd5',
  perigoPulso: '#ff6680',
  // defesa: escudo, firewall, bloqueio, contra-ataque
  defesa: '#00e5ff',
  // recompensa: créditos, conquistas, elite, sinergia
  recompensa: '#ffd700',
  // combo e marcos de combo
  combo: '#ffd23f',
  // poder especial: crítico, overdrive, backup
  especial: '#ff2bd6',
  // itens e loja
  item: '#ffb000',
  // palavras especiais
  explosao: '#ff8c1a',
  corrompido: '#b46cff',
  branco: '#ffffff',
} as const;

export type NomeCor = keyof typeof COR;

// Variáveis CSS que precisam ter o mesmo valor da paleta (conferido em teste)
export const COR_CSS: Record<string, NomeCor> = {
  '--verde': 'verde',
  '--vermelho': 'perigo',
  '--ciano': 'defesa',
  '--rosa': 'especial',
  '--ambar': 'item',
  '--dourado': 'recompensa',
  '--roxo': 'corrompido',
  '--laranja': 'explosao',
};
