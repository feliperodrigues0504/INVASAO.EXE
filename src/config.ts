// Configuração em tempo de execução: os valores do evento (jogo.json) mais
// o que o organizador muda no painel. Os testes também ajustam os tempos.

import { EVENTO, type ModoId } from './content';

export const CONFIG = {
  ...EVENTO,
  modoFixo: null as ModoId | null, // null = o jogador escolhe
  efeitosReduzidos: false,
  pinHash: null as string | null, // null = PIN padrão (EVENTO.pinPadrao)
};

export type Config = typeof CONFIG;
