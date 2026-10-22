// CSV com ";" (Excel em português) e BOM para os acentos abrirem certos

import type { Resultado } from './ranking';

const campo = (v: unknown) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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
      r.data,
    ]),
  );
  return '﻿' + linhas.map(l => l.map(campo).join(';')).join('\r\n');
}
