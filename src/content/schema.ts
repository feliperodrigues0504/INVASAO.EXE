// =====================================================================
//  Schema do conteúdo do jogo (andares.json e jogo.json).
//  O conteúdo é validado ao carregar: um erro de digitação no JSON vira
//  uma mensagem clara na tela, e não um travamento no meio do evento.
// =====================================================================

import { z } from 'zod';

const num = z.number().finite();
const positivo = num.positive();
const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor deve ser #RRGGBB');
const texto = z.string().min(1);

// Atributos do jogador que os upgrades podem alterar
export const ATRIBUTOS = [
  'hp',
  'maxHp',
  'atk',
  'crit',
  'critMult',
  'bloqueio',
  'vidaPorAbate',
  'multCreditos',
  'velInimigos',
  'ganhoCombo',
  'perdoaErro',
  'autocomplete',
  'reviver',
  'danoChefe',
  'escudoInicial',
  'creditos',
  'danoPorErro',
  'comboFragil',
  'cafeInicial',
  'curaAndar',
] as const;

export const JogadorBaseSchema = z.object({
  hp: positivo,
  atk: positivo,
  crit: num.min(0).max(1),
  critMult: positivo,
  bloqueio: num.min(0).max(1),
  vidaPorAbate: num.min(0),
  multCreditos: positivo,
  velInimigos: positivo, // multiplicador da velocidade de ataque inimiga
  ganhoCombo: positivo,
  perdoaErro: z.boolean(),
  autocomplete: z.boolean(),
  reviver: num.int().min(0),
  danoChefe: positivo,
  escudoInicial: num.int().min(0),
  creditos: num.min(0),
  danoPorErro: num.min(0), // integridade perdida por letra errada (Modo Root)
  comboFragil: z.boolean(), // o combo zera ao levar dano (Deploy na Sexta)
  cafeInicial: num.min(0), // segundos de café no início de cada andar (Café Duplo)
  curaAndar: num.min(0), // multiplicador da cura entre andares
});

// Mecânica de cada tipo de inimigo comum
export const MECANICAS = ['nenhuma', 'armadilha', 'replicar', 'embaralhar', 'atravessar', 'infectar'] as const;
// Truques dos chefões (um chefão pode combinar vários)
export const TRUQUES = [
  'glitch',
  'invocar',
  'acelerar',
  'impressao',
  'rollback',
  'lag',
  'cripto',
  'adaptativo',
  'prazo',
] as const;
export const AREAS = ['seguranca', 'performance', 'infra'] as const;

export const ChefeSchema = z.object({
  nome: texto,
  arquivo: texto,
  sprite: texto,
  hp: positivo,
  intervalo: positivo,
  dano: positivo,
  recompensa: num.min(0),
  truques: z.array(z.enum(TRUQUES)),
  dica: texto.optional(), // aparece no banner quando o chefão chega
  frases: z.array(texto).min(4),
  falas: z.object({ intro: texto, metade: texto, derrota: texto }),
});

export const AndarSchema = z.object({
  nome: texto,
  desc: texto,
  dica: texto,
  // nenhum: palavras sem acento · leniente: aceita sem acento (sem bônus) · estrito: o acento conta
  acentos: z.enum(['nenhum', 'leniente', 'estrito']),
  inimigos: positivo,
  maxTela: num.int().min(1).max(3),
  hp: positivo,
  atkBase: positivo,
  porLetra: positivo, // segundos extras antes do ataque, por letra da palavra
  dano: positivo,
  recompensa: positivo,
  tipos: z.array(texto).min(1),
  cores: z.tuple([cor, cor]),
  palavras: z.array(texto).min(15),
  chefe: ChefeSchema,
  fato: texto,
});

const EfeitoSchema = z.object({
  atributo: z.enum(ATRIBUTOS),
  op: z.enum(['add', 'mul', 'set']),
  valor: z.union([num, z.boolean()]),
});

export const UpgradeSchema = z.object({
  id: texto,
  nome: texto,
  icone: texto,
  raridade: texto,
  max: num.int().min(1),
  area: z.enum(AREAS),
  desc: texto,
  efeitos: z.array(EfeitoSchema).min(1),
});

export const SinergiaSchema = z.object({
  area: z.enum(AREAS),
  nome: texto,
  icone: texto,
  minimo: num.int().min(2),
  desc: texto,
  efeitos: z.array(EfeitoSchema).min(1),
});

const fracao = num.min(0).max(1);
export const MecanicasSchema = z.object({
  parry: z.object({ limite: fracao, bonusDano: num.min(0) }),
  especiais: z.object({
    dourada: fracao,
    explosiva: fracao,
    corrompida: fracao,
    multCreditosDourada: positivo,
    fracaoExplosao: fracao,
    curaCorrompida: fracao,
  }),
  overdrive: z.object({ combo: num.int().min(1), multDano: positivo }),
  armadilha: z.object({ chance: fracao, duracao: positivo }),
  replicar: z.object({ tempo: positivo, fracaoVida: positivo }),
  embaralhar: z.object({ tempo: positivo }),
  atravessar: z.object({ fatorTempo: positivo, multDano: positivo }),
  impressao: z.object({ letrasPorSeg: positivo, atraso: num.min(0) }),
  lag: z.object({ pacoteMin: num.int().min(1), pacoteMax: num.int().min(1), pausaMin: positivo, pausaMax: positivo }),
  rollback: z.object({ ocioso: positivo, letras: num.int().min(1), repetir: positivo }),
  prazo: z.object({ segundos: positivo, multIntervalo: positivo, multDano: positivo }),
  rerrolar: z.object({ custo: num.int().min(0), aumento: num.int().min(0) }),
  elite: z.object({ multVida: positivo, multDano: positivo, multRecompensa: positivo, multPontos: positivo }),
  servidor: z.object({ chance: fracao, aposta: num.int().min(1) }),
});

export const ItemSchema = z.object({
  id: z.enum(['cafe', 'patch', 'antivirus', 'escudo']),
  nome: texto,
  icone: texto,
  preco: positivo,
  desc: texto,
});

export const ModoSchema = z.object({
  nome: texto,
  rota: z.array(num.int().min(0)).min(1),
  fatorInimigos: positivo,
  fatorVida: positivo,
  desc: texto,
});

export const JogoSchema = z.object({
  evento: z.object({
    evento: texto,
    curso: texto,
    rankingTela: num.int().min(1),
    voltarTituloSeg: positivo,
    ociosoSeg: positivo,
    vitrineSeg: num.min(0), // título parado por esse tempo → demonstração (0 = desligado)
    pinPadrao: z.string().regex(/^\d{4,12}$/, 'o PIN deve ter de 4 a 12 dígitos'),
  }),
  balanceamento: z.object({
    comboPasso: positivo,
    comboMax: positivo,
    curaEntreAndares: num.min(0).max(1),
    itemMax: num.int().min(1),
    bonusConquista: num.min(0),
  }),
  jogadorBase: JogadorBaseSchema,
  modos: z.object({ normal: ModoSchema, rapido: ModoSchema }),
  tiposInimigo: z.record(z.string(), z.object({ arquivo: texto, sprite: texto, mecanica: z.enum(MECANICAS) })),
  conquistas: z.array(z.object({ id: texto, nome: texto, icone: texto, desc: texto })),
  raridades: z.record(z.string(), z.object({ nome: texto, peso: positivo, cor })),
  upgrades: z.array(UpgradeSchema),
  itens: z.array(ItemSchema).length(4), // teclas 1 a 4
  sinergias: z.array(SinergiaSchema),
  areas: z.record(z.enum(AREAS), z.object({ nome: texto, cor })),
  mecanicas: MecanicasSchema,
});

export type JogadorBase = z.infer<typeof JogadorBaseSchema>;
export type Andar = z.infer<typeof AndarSchema>;
export type Chefe = z.infer<typeof ChefeSchema>;
export type Upgrade = z.infer<typeof UpgradeSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ItemId = Item['id'];
export type Modo = z.infer<typeof ModoSchema>;
export type ModoId = 'normal' | 'rapido';
export type Jogo = z.infer<typeof JogoSchema>;
export type Conquista = Jogo['conquistas'][number];
export type Atributo = (typeof ATRIBUTOS)[number];
export type Mecanica = (typeof MECANICAS)[number];
export type Truque = (typeof TRUQUES)[number];
export type Area = (typeof AREAS)[number];
export type Sinergia = z.infer<typeof SinergiaSchema>;
export type Mecanicas = z.infer<typeof MecanicasSchema>;

// Referências cruzadas que o schema sozinho não enxerga (sprite, tipo, raridade, rota)
export function validarReferencias(jogo: Jogo, andares: Andar[], sprites: Record<string, unknown>): string[] {
  const erros: string[] = [];
  andares.forEach((A, i) => {
    A.tipos.forEach(t => jogo.tiposInimigo[t] || erros.push(`andar ${i + 1}: tipo de inimigo "${t}" não existe`));
    if (!sprites[A.chefe.sprite]) erros.push(`andar ${i + 1}: sprite do chefão "${A.chefe.sprite}" não existe`);
  });
  Object.values(jogo.tiposInimigo).forEach(t => sprites[t.sprite] || erros.push(`sprite "${t.sprite}" não existe`));
  jogo.upgrades.forEach(
    u => jogo.raridades[u.raridade] || erros.push(`upgrade ${u.id}: raridade "${u.raridade}" inválida`),
  );
  for (const [id, m] of Object.entries(jogo.modos)) {
    m.rota.forEach(a => a < andares.length || erros.push(`modo ${id}: andar ${a} não existe`));
  }
  for (const area of AREAS)
    if (!jogo.sinergias.some(s => s.area === area)) erros.push(`área "${area}" sem sinergia definida`);
  if (jogo.mecanicas.lag.pacoteMin > jogo.mecanicas.lag.pacoteMax)
    erros.push('mecanicas.lag: pacoteMin maior que pacoteMax');
  const repetidos = (ids: string[]) => ids.filter((x, i) => ids.indexOf(x) !== i);
  repetidos(jogo.upgrades.map(u => u.id)).forEach(id => erros.push(`upgrade com id repetido: ${id}`));
  repetidos(jogo.conquistas.map(c => c.id)).forEach(id => erros.push(`conquista com id repetido: ${id}`));
  return erros;
}
