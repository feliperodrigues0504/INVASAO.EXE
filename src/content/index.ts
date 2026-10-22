// =====================================================================
//  Conteúdo do jogo, validado. Para mudar textos, palavras, chefões e
//  balanceamento, edite andares.json e jogo.json (veja schema.ts).
// =====================================================================

import { z } from 'zod';
import andaresJson from './andares.json';
import jogoJson from './jogo.json';
import { AndarSchema, JogoSchema, validarReferencias } from './schema';
import { SPRITES } from './sprites';

export class ConteudoInvalido extends Error {
  constructor(public readonly erros: string[]) {
    super(`Conteúdo do jogo inválido:\n${erros.join('\n')}`);
    this.name = 'ConteudoInvalido';
  }
}

function formatar(origem: string, erro: z.ZodError): string[] {
  return erro.issues.map(i => `${origem}: ${i.path.join('.') || '(raiz)'} — ${i.message}`);
}

export function carregarConteudo(jogoBruto: unknown, andaresBruto: unknown) {
  const jogo = JogoSchema.safeParse(jogoBruto);
  const andares = z.array(AndarSchema).min(1).safeParse(andaresBruto);
  const erros = [
    ...(jogo.success ? [] : formatar('jogo.json', jogo.error)),
    ...(andares.success ? [] : formatar('andares.json', andares.error)),
  ];
  if (jogo.success && andares.success) erros.push(...validarReferencias(jogo.data, andares.data, SPRITES));
  if (erros.length || !jogo.success || !andares.success) throw new ConteudoInvalido(erros);
  return { jogo: jogo.data, andares: andares.data };
}

const { jogo, andares } = carregarConteudo(jogoJson, andaresJson);

export const EVENTO = jogo.evento;
export const BAL = jogo.balanceamento;
export const JOGADOR_BASE = jogo.jogadorBase;
export const MODOS = jogo.modos;
export const TIPOS_INIMIGO = jogo.tiposInimigo;
export const CONQUISTAS = jogo.conquistas;
export const RARIDADES = jogo.raridades;
export const UPGRADES = jogo.upgrades;
export const ITENS = jogo.itens;
export const ANDARES = andares;
export { SPRITES };
export type * from './schema';
