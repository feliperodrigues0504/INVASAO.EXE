// API exposta em window.INVASAO: ferramentas do estande (console F12)
// e acesso ao estado do jogo para os testes automatizados (tests/e2e).

import type { Sound } from './audio/sound';
import type { Config } from './config';
import type { ANDARES, BAL, CONQUISTAS, ITENS, MODOS, UPGRADES } from './content';
import type { Battle } from './game/battle';
import type { FX } from './render/fx';
import type { sprite } from './render/sprites';
import type { GerenciadorAjustes } from './storage/ajustes';
import type { validarNick } from './storage/nick';
import type { Ranking } from './storage/ranking';
import type { GerenciadorFantasmas } from './storage/fantasma';
import type { UI } from './ui/ui';

export interface InvasaoGlobal {
  limparRanking(): string;
  exportarRanking(): void;
  battle: Battle;
  ui: UI;
  ranking: Ranking;
  fantasmas: GerenciadorFantasmas;
  ajustes: GerenciadorAjustes;
  config: Config;
  sound: typeof Sound;
  fx: typeof FX;
  conteudo: {
    ANDARES: typeof ANDARES;
    BAL: typeof BAL;
    CONQUISTAS: typeof CONQUISTAS;
    ITENS: typeof ITENS;
    MODOS: typeof MODOS;
    UPGRADES: typeof UPGRADES;
  };
  sprite: typeof sprite;
  validarNick: typeof validarNick;
  quadro(dt: number, t: number): void;
  ctx: CanvasRenderingContext2D;
  FONTE: string;
  noApp: boolean;
  escala(): number;
}

declare global {
  interface Window {
    INVASAO: InvasaoGlobal;
  }
}
