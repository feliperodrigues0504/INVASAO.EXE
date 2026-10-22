// =====================================================================
//  Ajustes do painel do organizador (sobrevivem a fechar o navegador).
// =====================================================================

import type { ModoId } from '../content';
import { lerJson, type Armazenamento } from './armazenamento';

export const CHAVE_AJUSTES = 'invasao_exe_ajustes_v1';
export const VOLUMES = [0.25, 0.5, 0.75, 1] as const;

export interface Ajustes {
  modoFixo: ModoId | null;
  som: boolean;
  volume: number;
  efeitosReduzidos: boolean; // sem tremor de tela e sem piscar do CRT (fotossensibilidade)
  pinHash: string | null; // null = PIN padrão de jogo.json
}

export const AJUSTES_PADRAO: Ajustes = {
  modoFixo: null,
  som: true,
  volume: 0.75,
  efeitosReduzidos: false,
  pinHash: null,
};

export function criarAjustes(arm: Armazenamento, padrao: Partial<Ajustes> = {}) {
  const base = { ...AJUSTES_PADRAO, ...padrao };
  function carregar(): Ajustes {
    const lido = lerJson(arm, CHAVE_AJUSTES);
    const d = (lido && typeof lido === 'object' ? lido : {}) as Record<string, unknown>;
    return {
      modoFixo: d.modoFixo === 'normal' || d.modoFixo === 'rapido' ? d.modoFixo : null,
      som: typeof d.som === 'boolean' ? d.som : base.som,
      volume: (VOLUMES as readonly unknown[]).includes(d.volume) ? (d.volume as number) : base.volume,
      efeitosReduzidos: typeof d.efeitosReduzidos === 'boolean' ? d.efeitosReduzidos : base.efeitosReduzidos,
      pinHash: typeof d.pinHash === 'string' && /^[0-9a-f]{8}$/.test(d.pinHash) ? d.pinHash : null,
    };
  }
  const salvar = (a: Ajustes) => arm.gravar(CHAVE_AJUSTES, JSON.stringify(a));
  return { carregar, salvar, CHAVE: CHAVE_AJUSTES };
}

export type GerenciadorAjustes = ReturnType<typeof criarAjustes>;

// Hash simples (FNV-1a) para o PIN não ficar em texto puro nos ajustes.
// Não é criptografia forte: só evita que o PIN apareça para quem olhar os dados.
export function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (const ch of `invasao:${pin}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
