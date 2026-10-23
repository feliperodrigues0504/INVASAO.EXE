// =====================================================================
//  Máquina de estados das telas. Toda mudança de tela passa por aqui e é
//  conferida contra a tabela abaixo: uma transição que não está na tabela
//  é um bug (ex.: um ENTER "vazando" de uma tela para outra).
// =====================================================================

export const ESTADOS = [
  'carregando',
  'titulo',
  'nick',
  'modo',
  'tutorial',
  'banner',
  'batalha',
  'pausa',
  'concluido',
  'upgrade',
  'escolhendo',
  'loja',
  'rota',
  'fim',
  'relatorio',
  'ranking',
  'pin',
  'painel',
  'novoPin',
  'duelo',
] as const;

export type Estado = (typeof ESTADOS)[number];

// Para onde cada tela pode ir. 'titulo' é sempre permitido (volta ao início:
// fim do ciclo, ESC, visitante que abandonou o jogo) e não precisa estar listado.
export const TRANSICOES: Record<Estado, readonly Estado[]> = {
  carregando: ['banner'],
  titulo: ['nick', 'pin'],
  nick: ['modo', 'tutorial'],
  modo: ['tutorial'],
  tutorial: ['banner'],
  banner: ['batalha'],
  batalha: ['pausa', 'concluido', 'fim'],
  pausa: ['batalha', 'fim'],
  concluido: ['upgrade', 'fim'],
  upgrade: ['escolhendo', 'fim'],
  escolhendo: ['loja'],
  loja: ['rota', 'fim'],
  rota: ['banner', 'fim'],
  // duelo: depois do jogador 1 vem o nick do jogador 2; depois do 2, o resultado
  fim: ['relatorio', 'nick', 'duelo'],
  relatorio: ['ranking'],
  ranking: [],
  pin: ['painel'],
  painel: ['novoPin'],
  novoPin: ['painel'],
  duelo: [],
};

// Telas em que existe uma partida em andamento (abandono = encerra e salva)
export const MENUS_DA_PARTIDA: readonly Estado[] = ['concluido', 'upgrade', 'loja', 'rota', 'pausa'];
// Telas antes da partida (abandono = volta ao título)
export const MENUS_SEM_PARTIDA: readonly Estado[] = ['nick', 'modo', 'tutorial', 'pin', 'painel', 'novoPin', 'duelo'];
// Telas em que o canvas da batalha aparece no fundo
export const MOSTRA_BATALHA: readonly Estado[] = ['batalha', 'banner', 'pausa'];

export const transicaoValida = (de: Estado, para: Estado): boolean =>
  para === 'titulo' || TRANSICOES[de].includes(para);
