// =====================================================================
//  Integração com o app de desktop (Tauri). No navegador, nada aqui faz
//  efeito. No executável do evento:
//   - cada gravação do ranking/ajustes também vai para um arquivo JSON
//     (%APPDATA%\br.observatorio.invasaoexe\backups), que sobrevive a uma
//     limpeza de dados do navegador interno;
//   - se o localStorage estiver vazio na abertura, o backup é restaurado;
//   - o CSV do ranking é salvo direto na pasta Downloads.
// =====================================================================

import { invoke, isTauri } from '@tauri-apps/api/core';

export const noApp = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

export function espelharEmArquivo(chave: string, valor: string): void {
  if (!noApp()) return;
  invoke('salvar_backup', { nome: chave, conteudo: valor }).catch(err => console.warn('[INVASAO] backup falhou', err));
}

export async function restaurarBackups(chaves: string[]): Promise<string[]> {
  if (!noApp()) return [];
  const restaurados: string[] = [];
  for (const chave of chaves) {
    try {
      if (localStorage.getItem(chave) != null) continue;
      const conteudo = await invoke<string | null>('ler_backup', { nome: chave });
      if (conteudo) {
        localStorage.setItem(chave, conteudo);
        restaurados.push(chave);
      }
    } catch (err) {
      console.warn('[INVASAO] não foi possível restaurar', chave, err);
    }
  }
  return restaurados;
}

// Devolve o caminho do arquivo salvo
export function salvarCsvNoApp(nome: string, conteudo: string): Promise<string> {
  return invoke<string>('exportar_csv', { nome, conteudo });
}
