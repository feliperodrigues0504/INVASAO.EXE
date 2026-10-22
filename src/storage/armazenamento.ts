// =====================================================================
//  Onde os dados ficam guardados. No navegador: localStorage (protegido
//  contra modo anônimo/disco cheio). Nos testes: memória. No app Tauri:
//  localStorage + cópia de segurança em arquivo (veja backup.ts).
// =====================================================================

export interface Armazenamento {
  ler(chave: string): string | null;
  gravar(chave: string, valor: string): void;
}

type AoGravar = (chave: string, valor: string) => void;

export function armazenamentoLocal(aoGravar?: AoGravar): Armazenamento {
  return {
    ler(chave) {
      try {
        return localStorage.getItem(chave);
      } catch {
        return null; // sem armazenamento (navegador anônimo, bloqueado...)
      }
    },
    gravar(chave, valor) {
      try {
        localStorage.setItem(chave, valor);
      } catch {
        /* sem armazenamento ou disco cheio: o jogo segue sem salvar */
      }
      aoGravar?.(chave, valor);
    },
  };
}

export function armazenamentoMemoria(
  inicial: Record<string, string> = {},
): Armazenamento & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    ler: chave => (chave in dados ? dados[chave] : null),
    gravar: (chave, valor) => {
      dados[chave] = valor;
    },
  };
}

export function lerJson(arm: Armazenamento, chave: string): unknown {
  try {
    return JSON.parse(arm.ler(chave) ?? 'null');
  } catch {
    return null;
  }
}
