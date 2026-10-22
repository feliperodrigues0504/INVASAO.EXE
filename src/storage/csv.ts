// CSV com ";" (Excel em português) e BOM para os acentos abrirem certos

import type { Resultado } from './ranking';

const campo = (v: unknown) => {
  let s = String(v);
  // Texto que começa com = + - @ vira FÓRMULA no Excel (ex.: um nick adulterado
  // "=HIPERLINK(...)"). O apóstrofo força o Excel a tratar como texto (AUD-03).
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const doisDigitos = (n: number) => String(n).padStart(2, '0');

// O ranking guarda a data em ISO (UTC). Para quem lê a planilha, data e hora LOCAIS:
// às 21:30 em Brasília o ISO já é o dia seguinte (AUD-02).
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

// Nome do arquivo com o dia LOCAL da exportação: ranking-invasao-2026-10-17.csv
export function nomeArquivoCsv(agora: Date = new Date()): string {
  return `ranking-invasao-${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}.csv`;
}

const CABECALHO = [
  'posicao',
  'nick',
  'pontos',
  'modo',
  'andar',
  'total_andares',
  'venceu',
  'ppm',
  'precisao',
  'conquistas',
  'data',
];

export function gerarCsv(lista: Resultado[]): string {
  const linhas: unknown[][] = [CABECALHO];
  lista.forEach((r, i) =>
    linhas.push([
      i + 1,
      r.nick,
      r.pontos,
      r.modo,
      r.andar,
      r.total,
      r.venceu ? 'sim' : 'nao',
      r.ppm,
      r.precisao,
      r.conquistas.length,
      dataLocal(r.data),
    ]),
  );
  return '\uFEFF' + linhas.map(l => l.map(campo).join(';')).join('\r\n');
}
