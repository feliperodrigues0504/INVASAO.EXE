// Verificações estáticas dos arquivos do projeto (antes feitas pelo validar.ps1)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = path.resolve(__dirname, '../..');
const ler = (arq: string) => fs.readFileSync(path.join(raiz, arq));

function arquivos(dir: string, extensoes: string[]): string[] {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(rel, extensoes);
    return extensoes.some(x => e.name.endsWith(x)) ? [rel] : [];
  });
}

describe('atalho do evento (INICIAR_EVENTO.bat)', () => {
  const bat = ler('INICIAR_EVENTO.bat');
  const texto = bat.toString('latin1');

  it('só tem caracteres ASCII (o cmd do Windows quebra acentos)', () => {
    expect([...bat].filter(b => b > 127)).toEqual([]);
  });

  it('usa quebras de linha CRLF (o cmd pode errar os goto com LF)', () => {
    expect(texto.match(/(?<!\r)\n/g)).toBeNull();
  });

  it('abre o build (dist\\index.html) em modo quiosque com perfil próprio', () => {
    expect(texto).toContain('set "JOGO=%~dp0dist\\index.html"');
    expect(texto).toContain('--kiosk');
    expect(texto).toContain('--user-data-dir="%PERFIL%"');
  });
});

describe('codificação dos arquivos de texto', () => {
  const lista = [
    ...arquivos('src', ['.ts', '.json', '.css']),
    ...arquivos('tests', ['.ts']),
    'index.html',
    'README.md',
  ];

  it.each(lista)('%s: sem acento "solto" (caractere combinante invisível) nem caractere corrompido', arq => {
    const t = ler(arq).toString('utf8');
    expect(t, 'caractere combinante U+0300–U+036F').not.toMatch(/[\u0300-\u036f]/);
    expect(t, 'caractere corrompido U+FFFD').not.toContain('\uFFFD');
  });

  it('o index.html não depende de nenhum endereço externo', () => {
    expect(ler('index.html').toString('utf8')).not.toMatch(/(src|href)="https?:/);
  });
});
