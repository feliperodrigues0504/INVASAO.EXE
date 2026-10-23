// =====================================================================
//  Batalha: inimigos, digitação, dano, chefões e itens.
//  Simulação PURA: não toca em DOM, canvas nem som. Tudo o que acontece
//  vira um evento; o render, o áudio e a interface escutam esses eventos.
//  Por isso ela roda e é testada direto no Node (tests/unit).
// =====================================================================

import {
  ANDARES,
  BAL,
  CONQUISTAS,
  ITENS,
  JOGADOR_BASE,
  MEC,
  MODOS,
  RARIDADES,
  SINERGIAS,
  TIPOS_INIMIGO,
  UPGRADES,
  type Andar,
  type Area,
  type Chefe,
  type Conquista,
  type ItemId,
  type JogadorBase,
  type Mecanica,
  type ModoId,
  type Sinergia,
  type Truque,
  type Upgrade,
} from '../content';
import { Emissor } from './eventos';
import { criarRng, sementeAleatoria, sortear, type Rng } from './rng';
import { semAcento, temAcento } from './texto';

// Posições no mundo do jogo (centro x, "pé" y) — a tela lógica tem 960x540
export const LARGURA = 960;
export const ALTURA = 540;
export const SLOTS = [
  { x: 520, y: 400 },
  { x: 700, y: 270 },
  { x: 850, y: 405 },
];
export const SLOTS_CHEFE = [
  { x: 430, y: 335 },
  { x: 480, y: 215 },
];
export const POS_CHEFE = { x: 700, y: 380 };
export const POS_JOGADOR = { x: 150, y: 400 };
export const ESCALA_INIMIGO = 6;
export const ESCALA_CHEFE = 7;
// onde o "pacote" que atravessa a tela atinge o jogador
export const CHEGADA_PACOTE = POS_JOGADOR.x + 110;
// a cada quantos segundos de batalha a pontuação é anotada (fantasma do recordista)
export const PASSO_TRILHA = 5;

export type Jogador = JogadorBase & { maxHp: number };
export type Etapa = 'ondas' | 'alerta' | 'chefe' | 'vitoria' | 'morte';
export type Especial = 'dourada' | 'explosiva' | 'corrompida';

export interface Inimigo {
  chefe: boolean;
  nome: string;
  titulo?: string;
  sprite: string;
  escala: number;
  paleta?: Record<string, string>;
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dano: number;
  recompensa: number;
  texto: string;
  dig: number;
  erros: number;
  imperfeito: boolean;
  t0: number | null;
  atk: number;
  intervalo: number;
  flash: number;
  tremor: number;
  investida: number;
  nascendo: number;
  morrendo: boolean;
  morteT: number;
  bob: number;
  fala: string | null;
  falaT: number;
  elite: boolean;
  // inimigos comuns: mecânica do tipo (phishing, worm, glitch...)
  mecanica: Mecanica;
  armadilha: boolean; // palavra-armadilha do phishing: completar causa dano em VOCÊ
  armadilhaT: number;
  especial: Especial | null;
  timerMec: number; // contagem do worm (replicar) e do glitch (embaralhar)
  replica: boolean; // cópia de worm: não se replica de novo
  origemX: number; // pacote: de onde partiu
  avanco: number; // pacote: 0 = no lugar, 1 = chegou ao jogador
  // só chefões
  intervaloBase: number;
  frases: string[];
  fraseIdx: number;
  metade: boolean;
  truques: Truque[];
  visivel: number | null; // impressão/lag: quantas letras já "chegaram" (null = todas)
  revelarT: number;
  cifrado: boolean; // ransomware: só a próxima letra aparece
  ociosoT: number; // DROP TABLE: tempo sem digitar (rollback)
  prazoT: number; // Prazo de Entrega: segundos até o prazo estourar
  estourado: boolean;
}

export interface RegistroAndar {
  nome: string;
  concluido: boolean;
  ppm: number;
  precisao: number;
  tempo: number;
}

export interface Partida {
  nick: string;
  p: Jogador;
  modo: ModoId;
  rota: number[];
  passo: number;
  andar: number;
  pontos: number;
  venceu: boolean;
  debug: boolean;
  semente: number;
  comboSalvo: number;
  inventario: Record<ItemId, number>;
  upgrades: Record<string, number>;
  sinergias: Area[];
  rerrolagens: number;
  proximoElite: boolean;
  trilha: number[]; // pontos a cada PASSO_TRILHA segundos de batalha (fantasma)
  conquistas: string[];
  historico: RegistroAndar[];
  stats: {
    acertos: number;
    erros: number;
    tempo: number;
    palavras: number;
    maiorCombo: number;
    abates: number;
    errosTecla: Record<string, number>;
    acentoOk: number;
    acentoErro: number;
    parries: number;
  };
}

export interface EstadoAndar {
  A: Andar;
  inimigos: Inimigo[];
  restante: number;
  cooldown: number;
  etapa: Etapa;
  tempoEtapa: number;
  alvo: Inimigo | null;
  combo: number;
  escudo: number;
  lento: number;
  chefe: Inimigo | null;
  tempoInvocar: number;
  recentes: string[];
  avisou: boolean;
  registrado: boolean;
  elite: boolean;
  overdrive: boolean; // próximo golpe é o ataque especial
  stats: {
    abates: number;
    acertos: number;
    erros: number;
    inicioPontos: number;
    tempo: number;
    danoRecebido: number;
    itensUsados: number;
  };
}

export type ResultadoCompra = 'ok' | 'cheio' | 'sem credito' | 'invalido';
export type ResultadoAposta = { resultado: 'ganhou' | 'perdeu'; valor: number } | { resultado: 'sem credito' };

export interface Prompt {
  texto: string;
  dig: number;
  nome: string;
  ativo: boolean;
  // como a frase aparece na tela: letras que ainda não chegaram (░) ou cifradas (*)
  mascara?: string;
}

// Tudo o que a batalha avisa para o mundo de fora
export type EventosBatalha = {
  log: [msg: string, cor?: string];
  andarIniciado: [];
  acerto: [alvo: Inimigo];
  erro: [];
  teclaBloqueada: [alvo: Inimigo];
  alvoSolto: [];
  comboMarco: [combo: number];
  inimigoAtingido: [e: Inimigo, dano: number, crit: boolean];
  furia: [e: Inimigo];
  abate: [e: Inimigo, creditos: number];
  desintegrar: [e: Inimigo];
  chefeSurgiu: [e: Inimigo];
  alertaChefe: [chefe: Chefe];
  chefeDerrotado: [chefe: Chefe];
  bloqueado: [tipo: 'firewall' | 'cripto', atacante: Inimigo];
  dano: [dano: number, atacante: Inimigo | null];
  backupRestaurado: [];
  jogadorDerrotado: [];
  itemUsado: [id: ItemId, valor: number];
  itemNegado: [];
  conquista: [def: Conquista];
  andarConcluido: [];
  gameOver: [];
  // mecânicas da versão 4
  parry: [e: Inimigo];
  especial: [e: Inimigo, tipo: Especial, valor: number];
  overdrivePronto: [];
  overdrive: [e: Inimigo];
  armadilha: [e: Inimigo];
  replicou: [original: Inimigo, copia: Inimigo];
  embaralhou: [e: Inimigo];
  infectou: [de: Inimigo, para: Inimigo];
  pacoteChegou: [e: Inimigo];
  rollback: [e: Inimigo, letras: number];
  prazoEstourado: [e: Inimigo];
  sinergia: [s: Sinergia];
};

const ATIVO = (etapa: Etapa) => etapa === 'ondas' || etapa === 'chefe';
const entre = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export class Battle extends Emissor<EventosBatalha> {
  run: Partida | null = null; // dados da partida inteira
  estado: EstadoAndar | null = null; // estado do andar atual
  private rng: Rng = criarRng(sementeAleatoria());

  private log(msg: string, cor?: string) {
    this.emit('log', msg, cor);
  }

  private get b(): EstadoAndar {
    if (!this.estado) throw new Error('nenhum andar em andamento');
    return this.estado;
  }

  private get r(): Partida {
    if (!this.run) throw new Error('nenhuma partida em andamento');
    return this.run;
  }

  // ---------------- partida / andar ----------------
  novaPartida(nick: string, modo: string = 'normal', opcoes: { semente?: number } = {}): Partida {
    const m: ModoId = modo === 'rapido' ? 'rapido' : 'normal';
    const semente = opcoes.semente ?? sementeAleatoria();
    this.rng = criarRng(semente);
    const p: Jogador = { ...JOGADOR_BASE, maxHp: JOGADOR_BASE.hp };
    const rota = MODOS[m].rota.slice();
    this.estado = null;
    this.run = {
      nick,
      p,
      modo: m,
      rota,
      passo: 0,
      andar: rota[0],
      pontos: 0,
      venceu: false,
      debug: false,
      semente,
      comboSalvo: 0,
      inventario: { cafe: 0, patch: 0, antivirus: 0, escudo: 0 },
      upgrades: {},
      sinergias: [],
      rerrolagens: 0,
      proximoElite: false,
      trilha: [],
      conquistas: [], // ids desbloqueados nesta partida
      historico: [], // um registro por andar jogado (para o relatório de desempenho)
      stats: {
        acertos: 0,
        erros: 0,
        tempo: 0,
        palavras: 0,
        maiorCombo: 0,
        abates: 0,
        errosTecla: {},
        acentoOk: 0,
        acentoErro: 0,
        parries: 0,
      },
    };
    return this.run;
  }

  // ---------------- rota de andares (modo normal = 9, rápido = 3) ----------------
  totalAndares = () => this.r.rota.length;
  posicao = () => this.r.passo + 1;
  ehUltimo = () => this.r.passo >= this.r.rota.length - 1;
  avancar() {
    this.r.passo++;
    this.r.andar = this.r.rota[this.r.passo];
  }
  // usado pelo modo de teste ?andar=N (rota normal)
  irParaAndar(idx: number) {
    const run = this.r;
    run.passo = Math.max(0, Math.min(run.rota.length - 1, idx));
    run.andar = run.rota[run.passo];
  }

  // Antes de cada andar o jogador escolhe a rota: segura ou de elite
  // (inimigos mais fortes, mais créditos e mais pontos)
  escolherRota(elite: boolean) {
    this.r.proximoElite = elite;
  }

  iniciarAndar() {
    const run = this.r;
    const A = ANDARES[run.andar];
    this.estado = {
      A,
      inimigos: [],
      restante: Math.max(2, Math.round(A.inimigos * MODOS[run.modo].fatorInimigos)),
      cooldown: 0.8,
      etapa: 'ondas',
      tempoEtapa: 0,
      // o combo continua de um andar para o outro (no modo rápido, 1 andar não tem palavras para x20)
      alvo: null,
      combo: run.comboSalvo || 0,
      escudo: run.p.escudoInicial,
      lento: run.p.cafeInicial,
      chefe: null,
      tempoInvocar: 0,
      recentes: [],
      avisou: false,
      registrado: false,
      elite: run.proximoElite,
      overdrive: false,
      stats: {
        abates: 0,
        acertos: 0,
        erros: 0,
        inicioPontos: run.pontos,
        tempo: 0,
        danoRecebido: 0,
        itensUsados: 0,
      },
    };
    run.proximoElite = false;
    this.emit('andarIniciado');
  }

  // Manutenção entre andares: devolve quanto curou
  curarEntreAndares(): number {
    const p = this.r.p;
    const antes = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * BAL.curaEntreAndares * p.curaAndar));
    return p.hp - antes;
  }

  // ---------------- conquistas ----------------
  conquista(id: string): boolean {
    const run = this.run;
    if (!run || run.conquistas.includes(id)) return false;
    const def = CONQUISTAS.find(c => c.id === id);
    if (!def) return false;
    run.conquistas.push(id);
    run.pontos += BAL.bonusConquista;
    this.log(`> [★] conquista: ${def.nome} (+${BAL.bonusConquista})`, '#ffd700');
    this.emit('conquista', def);
    return true;
  }

  // Guarda os números do andar atual para o relatório de desempenho (uma vez por andar)
  registrarAndar(concluido: boolean) {
    const b = this.estado,
      run = this.run;
    if (!b || !run || b.registrado) return;
    b.registrado = true;
    run.comboSalvo = concluido ? b.combo : 0;
    const s = b.stats;
    const total = s.acertos + s.erros;
    run.historico.push({
      nome: b.A.nome,
      concluido: !!concluido,
      ppm: s.tempo > 1 ? Math.round(s.acertos / 5 / (s.tempo / 60)) : 0,
      precisao: total ? Math.round((s.acertos / total) * 100) : 0,
      tempo: Math.round(s.tempo),
    });
  }

  // ---------------- criação de inimigos ----------------
  private baseInimigo(extra: Partial<Inimigo> & Pick<Inimigo, 'chefe' | 'nome' | 'sprite' | 'escala'>): Inimigo {
    return {
      slot: -1,
      x: 0,
      y: 0,
      hp: 1,
      maxHp: 1,
      dano: 0,
      recompensa: 0,
      texto: '',
      dig: 0,
      erros: 0,
      imperfeito: false,
      t0: null,
      atk: 0,
      intervalo: 5,
      flash: 0,
      tremor: 0,
      investida: 0,
      nascendo: 0.5,
      morrendo: false,
      morteT: 0,
      bob: this.rng() * 6,
      fala: null,
      falaT: 0,
      elite: false,
      mecanica: 'nenhuma',
      armadilha: false,
      armadilhaT: 0,
      especial: null,
      timerMec: Infinity,
      replica: false,
      origemX: 0,
      avanco: 0,
      intervaloBase: 0,
      frases: [],
      fraseIdx: 0,
      metade: false,
      truques: [],
      visivel: null,
      revelarT: 0,
      cifrado: false,
      ociosoT: 0,
      prazoT: Infinity,
      estourado: false,
      ...extra,
    };
  }

  private slotLivre(slots: { x: number; y: number }[], limite: number) {
    for (let i = 0; i < Math.min(limite, slots.length); i++) {
      if (!this.b.inimigos.some(e => !e.chefe && e.slot === i)) return i;
    }
    return -1;
  }

  private criarInimigo(
    slots: { x: number; y: number }[],
    slot: number,
    fracoHp = 1,
    opcoes: { tipo?: string; replica?: boolean } = {},
  ) {
    const b = this.b,
      A = b.A;
    const idTipo = opcoes.tipo ?? sortear(this.rng, A.tipos);
    const tipo = TIPOS_INIMIGO[idTipo];
    const elite = b.elite ? MEC.elite : null;
    const hp = Math.round(A.hp * fracoHp * MODOS[this.r.modo].fatorVida * (elite?.multVida ?? 1));
    const e = this.baseInimigo({
      chefe: false,
      nome: tipo.arquivo,
      sprite: tipo.sprite,
      escala: ESCALA_INIMIGO,
      paleta: { A: A.cores[0], B: A.cores[1] },
      slot,
      x: slots[slot].x,
      y: slots[slot].y,
      origemX: slots[slot].x,
      hp,
      maxHp: hp,
      dano: Math.round(A.dano * (elite?.multDano ?? 1)),
      recompensa: Math.round(A.recompensa * fracoHp * (elite?.multRecompensa ?? 1)),
      elite: b.elite,
      mecanica: tipo.mecanica,
      replica: !!opcoes.replica,
    });
    if (e.mecanica === 'replicar' && !e.replica) e.timerMec = MEC.replicar.tempo;
    if (e.mecanica === 'embaralhar') e.timerMec = MEC.embaralhar.tempo;
    b.inimigos.push(e);
    this.novoTexto(e);
    e.atk = -0.6; // pequena folga ao aparecer
    return e;
  }

  private criarChefe() {
    const b = this.b;
    const C = b.A.chefe;
    const elite = b.elite ? MEC.elite : null;
    const hp = Math.round(C.hp * MODOS[this.r.modo].fatorVida * (elite?.multVida ?? 1));
    const e = this.baseInimigo({
      chefe: true,
      nome: C.arquivo,
      titulo: C.nome,
      sprite: C.sprite,
      escala: ESCALA_CHEFE,
      x: POS_CHEFE.x,
      y: POS_CHEFE.y,
      hp,
      maxHp: hp,
      dano: Math.round(C.dano * (elite?.multDano ?? 1)),
      recompensa: Math.round(C.recompensa * (elite?.multRecompensa ?? 1)),
      elite: b.elite,
      intervaloBase: C.intervalo,
      frases: C.frases,
      fraseIdx: 0,
      metade: false,
      truques: C.truques,
      nascendo: 1.2,
      prazoT: C.truques.includes('prazo') ? MEC.prazo.segundos : Infinity,
    });
    b.chefe = e;
    b.inimigos.push(e);
    this.novoTexto(e);
    e.atk = -2;
    this.falar(e, C.falas.intro);
    this.log(`> [!] ${C.arquivo} em execução`, '#ff3355');
    this.emit('chefeSurgiu', e);
  }

  // Próxima letra que o jogador precisa digitar para "mirar" no texto
  inicioTexto = (txt: string) => (this.r.p.autocomplete && txt.length > 3 && txt[1] !== ' ' ? 1 : 0);

  private temTruque = (e: Inimigo, t: Truque) => e.truques.includes(t);

  // I.A. Rebelde: escolhe a frase com mais letras que VOCÊ errou nesta partida
  private fraseAdaptativa(e: Inimigo): string {
    const erros = this.r.stats.errosTecla;
    const anterior = e.texto;
    let melhor = e.frases[e.fraseIdx % e.frases.length];
    let melhorNota = -1;
    for (const f of e.frases) {
      if (f === anterior) continue;
      const nota = [...f].reduce((s, ch) => s + (erros[ch] || 0), 0) / f.length;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = f;
      }
    }
    return melhor;
  }

  private novoTexto(e: Inimigo, opcoes: { semArmadilha?: boolean; longa?: boolean } = {}) {
    const b = this.b;
    if (e.chefe) {
      e.texto =
        this.temTruque(e, 'adaptativo') && e.fraseIdx > 0
          ? this.fraseAdaptativa(e)
          : e.frases[e.fraseIdx % e.frases.length];
      e.fraseIdx++;
      // impressora e Wi-Fi: a frase chega aos poucos; ransomware: frases (menos a 1ª) cifradas
      if (this.temTruque(e, 'impressao')) {
        e.visivel = 0;
        e.revelarT = MEC.impressao.atraso;
      } else if (this.temTruque(e, 'lag')) {
        e.visivel = 0;
        e.revelarT = entre(this.rng, MEC.lag.pausaMin, MEC.lag.pausaMax);
      }
      e.cifrado = this.temTruque(e, 'cripto') && e.fraseIdx > 1;
      e.ociosoT = 0;
    } else {
      // evita repetir palavras e evita que dois inimigos comecem com a mesma letra
      const proximas = b.inimigos
        .filter(o => o !== e && !o.morrendo && o.texto)
        .map(o => semAcento(o.texto[o.dig] || ''));
      const livre = (w: string) => !proximas.includes(semAcento(w[this.inicioTexto(w)]));
      let palavras = b.A.palavras;
      if (opcoes.longa) {
        // vírus: a vítima fica com uma das palavras mais longas do andar
        const tamanhos = palavras.map(w => w.length).sort((x, y) => x - y);
        const corte = tamanhos[Math.floor(tamanhos.length * 0.7)];
        palavras = palavras.filter(w => w.length >= corte);
      }
      let cands = palavras.filter(w => livre(w) && !b.recentes.includes(w) && w !== e.texto);
      if (!cands.length) cands = palavras.filter(livre);
      if (!cands.length) cands = palavras;
      e.texto = sortear(this.rng, cands);
      b.recentes.push(e.texto);
      if (b.recentes.length > 10) b.recentes.shift();
      // phishing: às vezes a palavra é uma ARMADILHA (não digite!)
      e.armadilha = e.mecanica === 'armadilha' && !opcoes.semArmadilha && this.rng() < MEC.armadilha.chance;
      e.armadilhaT = e.armadilha ? MEC.armadilha.duracao : 0;
      e.especial = e.armadilha ? null : this.sortearEspecial();
    }
    e.dig = this.inicioTexto(e.texto);
    if (e.visivel != null) e.visivel = Math.max(e.visivel, e.dig);
    e.erros = 0;
    e.imperfeito = false;
    e.t0 = null;
    this.calcularIntervalo(e);
  }

  private sortearEspecial(): Especial | null {
    const s = MEC.especiais;
    const r = this.rng();
    if (r < s.dourada) return 'dourada';
    if (r < s.dourada + s.explosiva) return 'explosiva';
    if (r < s.dourada + s.explosiva + s.corrompida) return 'corrompida';
    return null;
  }

  // A frase do chefão segue uma ordem fixa e não pode ser sorteada de novo. Se a nova
  // frase começa com a mesma letra de um capanga ainda não começado, quem troca de
  // palavra é o capanga; senão a 1ª letra poderia mirar no inimigo errado (AUD-01).
  private desfazerConflitos(chefe: Inimigo) {
    const letra = semAcento(chefe.texto[chefe.dig] || '');
    for (const o of this.b.inimigos) {
      if (o === chefe || o.morrendo || o === this.b.alvo || o.dig !== this.inicioTexto(o.texto)) continue;
      if (semAcento(o.texto[o.dig] || '') === letra) this.novoTexto(o);
    }
  }

  private calcularIntervalo(e: Inimigo) {
    if (e.chefe) {
      let i = e.intervaloBase;
      if (e.metade) i *= 0.85;
      if (this.temTruque(e, 'acelerar')) i *= 0.6 + 0.4 * (e.hp / e.maxHp);
      if (e.estourado) i *= MEC.prazo.multIntervalo;
      e.intervalo = i;
    } else {
      e.intervalo = this.b.A.atkBase + e.texto.length * this.b.A.porLetra;
    }
  }

  private falar(e: Inimigo, txt: string) {
    e.fala = txt;
    e.falaT = 3;
  }

  // ---------------- loop ----------------
  atualizar(dt: number) {
    const b = this.estado,
      run = this.run;
    if (!b || !run) return;
    b.tempoEtapa += dt;
    if (ATIVO(b.etapa)) {
      run.stats.tempo += dt;
      b.stats.tempo += dt;
      // fantasma do recordista: anota a pontuação a cada PASSO_TRILHA segundos
      while (run.stats.tempo >= run.trilha.length * PASSO_TRILHA) run.trilha.push(run.pontos);
    }
    if (b.lento > 0) b.lento -= dt;

    switch (b.etapa) {
      case 'ondas': {
        b.cooldown -= dt;
        const vivos = b.inimigos.filter(e => !e.morrendo).length;
        if (b.restante > 0 && b.cooldown <= 0 && vivos < b.A.maxTela) {
          const slot = this.slotLivre(SLOTS, b.A.maxTela);
          if (slot >= 0) {
            this.criarInimigo(SLOTS, slot);
            b.restante--;
            b.cooldown = 0.9 + this.rng() * 0.9;
          }
        }
        if (b.restante === 0 && b.inimigos.length === 0) {
          b.etapa = 'alerta';
          b.tempoEtapa = 0;
          this.emit('alertaChefe', b.A.chefe);
        }
        break;
      }
      case 'alerta':
        if (b.tempoEtapa > 3.2) {
          b.etapa = 'chefe';
          b.tempoEtapa = 0;
          this.criarChefe();
        }
        break;
      case 'chefe':
        if (b.chefe && !b.chefe.morrendo) this.atualizarChefe(b.chefe, dt);
        break;
      case 'vitoria':
        if (b.tempoEtapa > 2.4 && !b.avisou) {
          b.avisou = true;
          this.emit('andarConcluido');
        }
        break;
      case 'morte':
        if (b.tempoEtapa > 2 && !b.avisou) {
          b.avisou = true;
          this.emit('gameOver');
        }
        break;
    }

    // a batalha pode ter sido trocada por um ouvinte (ex.: andarConcluido → próximo andar)
    if (this.estado !== b) return;
    const fatorVel = (b.lento > 0 ? 0.4 : 1) * run.p.velInimigos;
    for (let i = b.inimigos.length - 1; i >= 0; i--) {
      const e = b.inimigos[i];
      e.flash = Math.max(0, e.flash - dt);
      e.tremor = Math.max(0, e.tremor - dt);
      e.investida = Math.max(0, e.investida - dt);
      e.nascendo = Math.max(0, e.nascendo - dt);
      if (e.falaT > 0) e.falaT -= dt;
      if (e.morrendo) {
        e.morteT += dt;
        if (e.morteT > 0.15) b.inimigos.splice(i, 1);
        continue;
      }
      // a etapa é conferida a cada inimigo: se um ataque matar o jogador,
      // os próximos inimigos do mesmo quadro não podem atacar de novo
      if (!ATIVO(b.etapa) || e.nascendo > 0) continue;
      if (!e.chefe) this.atualizarMecanica(e, dt, fatorVel);
      if (e.morrendo || this.estado !== b || !ATIVO(b.etapa)) continue;
      if (e.mecanica === 'atravessar') continue; // o pacote não ataca de longe: ele vem até você
      e.atk += dt * fatorVel;
      if (e.atk >= e.intervalo) {
        e.atk = 0;
        this.atacar(e);
      }
    }
  }

  // Comportamento próprio de cada tipo de inimigo comum
  private atualizarMecanica(e: Inimigo, dt: number, fatorVel: number) {
    const b = this.b;
    switch (e.mecanica) {
      case 'armadilha':
        // a palavra-armadilha some sozinha depois de alguns segundos
        if (e.armadilha && (e.armadilhaT -= dt) <= 0) {
          if (b.alvo === e) b.alvo = null;
          this.novoTexto(e, { semArmadilha: true });
        }
        break;
      case 'embaralhar':
        // se ninguém começar a palavra, o glitch troca por outra
        if (b.alvo !== e && e.dig === this.inicioTexto(e.texto) && (e.timerMec -= dt) <= 0) {
          this.novoTexto(e);
          e.timerMec = MEC.embaralhar.tempo;
          this.emit('embaralhou', e);
        }
        break;
      case 'replicar':
        // o worm se copia uma vez para um espaço livre (só durante as ondas)
        if (!e.replica && b.etapa === 'ondas' && (e.timerMec -= dt) <= 0) {
          e.timerMec = Infinity;
          const slot = this.slotLivre(SLOTS, SLOTS.length);
          if (slot >= 0) {
            const copia = this.criarInimigo(SLOTS, slot, MEC.replicar.fracaoVida, { tipo: 'worm', replica: true });
            this.log(`> [!] ${e.nome} se replicou!`, '#ff3355');
            this.emit('replicou', e, copia);
          }
        }
        break;
      case 'atravessar': {
        // o pacote atravessa a tela; se chegar até você, causa dano direto
        e.avanco += (dt * fatorVel) / (e.intervalo * MEC.atravessar.fatorTempo);
        e.x = e.origemX + (CHEGADA_PACOTE - e.origemX) * Math.min(1, e.avanco);
        e.atk = Math.min(1, e.avanco) * e.intervalo; // a barra de ataque mostra o caminho
        if (e.avanco >= 1) {
          e.morrendo = true;
          if (b.alvo === e) b.alvo = null;
          this.emit('pacoteChegou', e);
          this.emit('desintegrar', e);
          this.log(`> [!] ${e.nome} entregue: -${Math.round(e.dano * MEC.atravessar.multDano)}`, '#ff3355');
          this.ferir(Math.round(e.dano * MEC.atravessar.multDano), e);
        }
        break;
      }
    }
  }

  private atualizarChefe(c: Inimigo, dt: number) {
    const b = this.b;
    if (this.temTruque(c, 'invocar')) {
      b.tempoInvocar += dt;
      const minions = b.inimigos.filter(e => !e.chefe && !e.morrendo).length;
      if (b.tempoInvocar > 10 && minions < 2) {
        const slot = this.slotLivre(SLOTS_CHEFE, 2);
        if (slot >= 0) {
          this.criarInimigo(SLOTS_CHEFE, slot, 0.5);
          b.tempoInvocar = 0;
          this.falar(c, sortear(this.rng, ['REFORÇOS!', 'ATAQUEM!', 'MAIS PROCESSOS!']));
        }
      }
    }
    if (c.nascendo > 0) return;
    // impressora / Wi-Fi: a frase vai chegando
    if (c.visivel != null && c.visivel < c.texto.length && (c.revelarT -= dt) <= 0) {
      if (this.temTruque(c, 'impressao')) {
        c.visivel++;
        c.revelarT += 1 / MEC.impressao.letrasPorSeg;
      } else {
        c.visivel += Math.round(entre(this.rng, MEC.lag.pacoteMin, MEC.lag.pacoteMax));
        c.revelarT = entre(this.rng, MEC.lag.pausaMin, MEC.lag.pausaMax);
      }
      c.visivel = Math.min(c.visivel, c.texto.length);
    }
    // DROP TABLE: parou de digitar no meio da frase → rollback apaga as últimas letras
    if (this.temTruque(c, 'rollback') && c.dig > this.inicioTexto(c.texto)) {
      c.ociosoT += dt;
      if (c.ociosoT >= MEC.rollback.ocioso) {
        const antes = c.dig;
        c.dig = Math.max(this.inicioTexto(c.texto), c.dig - MEC.rollback.letras);
        c.ociosoT = MEC.rollback.ocioso - MEC.rollback.repetir;
        this.emit('rollback', c, antes - c.dig);
        this.log(`> [!] ROLLBACK: ${antes - c.dig} letras desfeitas`, '#ff3355');
      }
    }
    // Prazo de Entrega: quando o relógio zera, ele fica furioso
    if (this.temTruque(c, 'prazo') && !c.estourado && (c.prazoT -= dt) <= 0) {
      c.prazoT = 0;
      c.estourado = true;
      c.dano = Math.round(c.dano * MEC.prazo.multDano);
      this.calcularIntervalo(c);
      this.falar(c, 'PRAZO ESTOURADO!');
      this.log('> [!] o prazo estourou: o chefão ficou mais rápido e mais forte', '#ff3355');
      this.emit('prazoEstourado', c);
    }
  }

  // ---------------- digitação ----------------
  private compara(c: string, esperado: string | undefined): false | 'exato' | 'leniente' {
    if (!esperado) return false;
    const e = esperado.toLowerCase();
    if (c === e) return 'exato';
    if (this.b.A.acentos === 'leniente' && semAcento(c) === semAcento(e)) return 'leniente';
    return false;
  }

  // a letra ainda não "chegou" (impressora / Wi-Fi)
  private bloqueado = (e: Inimigo) => e.visivel != null && e.dig >= e.visivel;

  podeDigitar(): boolean {
    return !!this.estado && ATIVO(this.estado.etapa);
  }

  digitar(ch: string) {
    if (!this.podeDigitar()) return;
    const b = this.b,
      run = this.r;
    const c = ch.toLowerCase();
    let alvo = b.alvo;
    if (alvo && (alvo.morrendo || !b.inimigos.includes(alvo))) alvo = b.alvo = null;

    if (!alvo) {
      if (c === ' ') return; // espaço sem alvo não conta como erro
      const casam = b.inimigos.filter(e => !e.morrendo && this.compara(c, e.texto[e.dig]));
      const cands = casam.filter(e => !this.bloqueado(e));
      if (!cands.length) {
        // a letra existe, mas ainda não chegou: não é erro, só espera
        if (casam.length) {
          this.emit('teclaBloqueada', casam[0]);
          return;
        }
        // com Autocomplete a 1ª letra já vem pronta; digitá-la por hábito só escolhe o alvo
        const habito =
          run.p.autocomplete &&
          b.inimigos.find(
            e => !e.morrendo && e.dig === 1 && this.inicioTexto(e.texto) === 1 && this.compara(c, e.texto[0]),
          );
        if (habito) {
          b.alvo = habito;
          return;
        }
        this.erro(null);
        return;
      }
      // prioriza quem está mais perto de atacar
      cands.sort((x, y) => y.atk / y.intervalo - x.atk / x.intervalo);
      alvo = b.alvo = cands[0];
    }

    if (this.bloqueado(alvo)) {
      this.emit('teclaBloqueada', alvo);
      return;
    }
    const res = this.compara(c, alvo.texto[alvo.dig]);
    if (!res) {
      this.erro(alvo);
      return;
    }
    if (res === 'leniente') alvo.imperfeito = true;
    if (res === 'exato' && temAcento(alvo.texto[alvo.dig])) run.stats.acentoOk++;
    if (alvo.t0 == null) alvo.t0 = run.stats.tempo; // início da palavra (conquista "Fibra Óptica")
    alvo.dig++;
    alvo.ociosoT = 0;
    run.stats.acertos++;
    b.stats.acertos++;
    this.emit('acerto', alvo);
    if (alvo.dig >= alvo.texto.length) this.completar(alvo);
  }

  private erro(alvo: Inimigo | null) {
    const b = this.b,
      run = this.r;
    run.stats.erros++;
    b.stats.erros++;
    this.emit('erro');
    if (alvo) {
      // estatística para o relatório: qual letra a pessoa errou
      const esperado = alvo.texto[alvo.dig];
      if (esperado) {
        run.stats.errosTecla[esperado] = (run.stats.errosTecla[esperado] || 0) + 1;
        if (temAcento(esperado)) run.stats.acentoErro++;
      }
      alvo.erros++;
      // palavra corrompida: errar cura o inimigo (uma vez)
      if (alvo.especial === 'corrompida') {
        const cura = Math.round(alvo.maxHp * MEC.especiais.curaCorrompida);
        alvo.hp = Math.min(alvo.maxHp, alvo.hp + cura);
        alvo.especial = null;
        this.emit('especial', alvo, 'corrompida', cura);
        this.log(`> [!] palavra corrompida: ${alvo.nome} recuperou ${cura}`, '#b46cff');
      }
    }
    // Modo Root: cada letra errada custa integridade
    if (run.p.danoPorErro > 0) this.ferir(run.p.danoPorErro, null);
    if (!this.estado || !ATIVO(this.b.etapa)) return;
    if (alvo && run.p.perdoaErro && alvo.erros === 1) return;
    if (b.combo >= 5) this.log(`> combo x${b.combo} perdido`, '#ff3355');
    b.combo = 0;
  }

  soltarAlvo() {
    if (this.estado?.alvo) {
      this.estado.alvo = null;
      this.emit('alvoSolto');
    }
  }

  private completar(e: Inimigo) {
    const b = this.b,
      run = this.r,
      p = run.p;
    b.alvo = null;

    // phishing: completar a palavra-armadilha é "clicar no link"
    if (e.armadilha) {
      this.log(`> [!] PHISHING: você caiu no golpe de ${e.nome}!`, '#ff3355');
      this.emit('armadilha', e);
      b.combo = 0;
      this.novoTexto(e, { semArmadilha: true });
      this.ferir(e.dano, e);
      return;
    }

    const perfeito = e.erros === 0 && !e.imperfeito;
    const comboAntes = b.combo;
    if (perfeito) b.combo += p.ganhoCombo;
    run.stats.maiorCombo = Math.max(run.stats.maiorCombo, b.combo);
    run.stats.palavras++;

    const len = e.texto.length;
    const fatorTexto = e.chefe ? Math.max(1, len / 8) : 1 + Math.max(0, len - 5) * 0.08;
    const multCombo = 1 + Math.min(b.combo, BAL.comboMax) * BAL.comboPasso;
    const crit = this.rng() < p.crit;
    let dano = Math.round(p.atk * fatorTexto * multCombo * (crit ? p.critMult : 1));
    const multPontos = b.elite ? MEC.elite.multPontos : 1;
    run.pontos += Math.round(len * 10 * multCombo * (crit ? 1.5 : 1) * (perfeito ? 1 : 0.6) * multPontos);

    // contra-ataque: acabar a palavra com a barra de ataque quase cheia anula o ataque
    const prop = e.mecanica === 'atravessar' ? e.avanco : e.atk / e.intervalo;
    if (prop >= MEC.parry.limite) {
      dano += Math.round(e.dano * MEC.parry.bonusDano);
      if (e.mecanica === 'atravessar') e.avanco = Math.max(0, e.avanco - 0.5);
      e.atk = 0;
      run.stats.parries++;
      this.emit('parry', e);
      this.log('> CONTRA-ATAQUE!', '#00e5ff');
    }

    // overdrive: o golpe guardado ao chegar no combo x20
    if (b.overdrive) {
      b.overdrive = false;
      dano = Math.round(dano * MEC.overdrive.multDano);
      this.emit('overdrive', e);
      this.log('> OVERDRIVE!', '#ff2bd6');
    }

    if (b.combo >= 10) this.conquista('combo10');
    if (b.combo >= 20) this.conquista('combo20');
    if (e.chefe && e.t0 != null) {
      const seg = run.stats.tempo - e.t0;
      if (seg > 0.5 && len / 5 / (seg / 60) >= 60) this.conquista('veloz');
    }

    if (perfeito && b.combo > 0 && b.combo % 10 === 0) {
      this.emit('comboMarco', b.combo);
      this.log(
        `> combo x${b.combo}! dano +${Math.round(Math.min(b.combo, BAL.comboMax) * BAL.comboPasso * 100)}%`,
        '#ffd23f',
      );
    }
    const n = MEC.overdrive.combo;
    if (Math.floor(b.combo / n) > Math.floor(comboAntes / n) && !b.overdrive) {
      b.overdrive = true;
      this.emit('overdrivePronto');
      this.log(`> OVERDRIVE PRONTO: o próximo golpe causa ${MEC.overdrive.multDano}x de dano`, '#ff2bd6');
    }

    // palavras especiais
    const especial = e.especial;
    e.especial = null;
    if (especial === 'dourada') {
      const cred = Math.round(e.recompensa * MEC.especiais.multCreditosDourada * p.multCreditos);
      p.creditos += cred;
      this.emit('especial', e, 'dourada', cred);
    }
    this.aplicarDano(e, dano, crit);
    if (especial === 'explosiva') {
      const estilhaco = Math.max(1, Math.round(dano * MEC.especiais.fracaoExplosao));
      this.emit('especial', e, 'explosiva', estilhaco);
      for (const o of b.inimigos.slice())
        if (o !== e && !o.chefe && !o.morrendo && o.nascendo <= 0) this.aplicarDano(o, estilhaco, false);
    }
  }

  private aplicarDano(e: Inimigo, dano: number, crit: boolean) {
    const b = this.b;
    e.hp -= dano;
    e.flash = 0.12;
    e.tremor = 0.25;
    this.emit('inimigoAtingido', e, dano, crit);

    if (e.hp <= 0) {
      this.matar(e);
      return;
    }
    if (b.alvo === e) b.alvo = null;
    this.novoTexto(e);
    if (e.chefe) {
      this.desfazerConflitos(e);
      if (!e.metade && e.hp <= e.maxHp / 2) {
        e.metade = true;
        this.calcularIntervalo(e);
        this.falar(e, b.A.chefe.falas.metade);
        this.log(`> [!] ${e.nome} está furioso!`, '#ff3355');
        this.emit('furia', e);
      } else if (this.rng() < 0.3) {
        this.falar(
          e,
          sortear(this.rng, ['ARGH!', 'ERRO 500!', 'IMPOSSÍVEL!', 'VOCÊ NÃO VAI PASSAR!', 'kernel panic...']),
        );
      }
    }
  }

  private matar(e: Inimigo) {
    const b = this.b,
      run = this.r,
      p = run.p;
    e.hp = 0;
    e.morrendo = true;
    if (b.alvo === e) b.alvo = null;
    const cred = Math.round(e.recompensa * p.multCreditos);
    p.creditos += cred;
    run.pontos += Math.round((e.chefe ? 500 : 50) * (run.andar + 1) * (b.elite ? MEC.elite.multPontos : 1));
    run.stats.abates++;
    b.stats.abates++;
    if (p.vidaPorAbate) p.hp = Math.min(p.maxHp, p.hp + p.vidaPorAbate);
    this.emit('abate', e, cred);
    this.conquista('primeiro');
    if (p.creditos >= 200) this.conquista('investidor');

    if (e.chefe) {
      this.conquista('chefe');
      if (b.stats.erros === 0) this.conquista('limpo');
      if (b.stats.danoRecebido === 0) this.conquista('intocavel');
      if (b.stats.itensUsados === 0) this.conquista('raiz');
      if (p.hp < p.maxHp * 0.1) this.conquista('porumfio');
      if (b.A.acentos === 'estrito') this.conquista('acentos');
      this.log(`> [OK] ${e.nome} DERROTADO!`, '#39ff14');
      this.emit('chefeDerrotado', b.A.chefe);
      // remove os capangas junto
      for (const o of b.inimigos)
        if (!o.morrendo && o !== e) {
          o.morrendo = true;
          this.emit('desintegrar', o);
        }
      b.etapa = 'vitoria';
      b.tempoEtapa = 0;
    } else {
      this.log(`> [OK] ${e.nome} removido (+${cred}₿)`, '#39ff14');
      if (e.mecanica === 'infectar') this.infectar(e);
    }
  }

  // vírus: ao morrer, infecta o inimigo mais próximo, que fica com uma palavra longa
  private infectar(de: Inimigo) {
    const vitimas = this.b.inimigos.filter(
      o => o !== de && !o.chefe && !o.morrendo && o !== this.b.alvo && o.dig === this.inicioTexto(o.texto),
    );
    if (!vitimas.length) return;
    vitimas.sort((x, y) => Math.abs(x.x - de.x) - Math.abs(y.x - de.x));
    const para = vitimas[0];
    this.novoTexto(para, { semArmadilha: true, longa: true });
    this.log(`> [!] ${de.nome} infectou ${para.nome}`, '#ff3355');
    this.emit('infectou', de, para);
  }

  // ---------------- ataques inimigos ----------------
  private atacar(e: Inimigo) {
    const b = this.b,
      p = this.r.p;
    if (!ATIVO(b.etapa)) return;
    e.investida = 0.35;
    if (b.escudo > 0) {
      b.escudo--;
      this.emit('bloqueado', 'firewall', e);
      this.log(`> firewall bloqueou ${e.nome}`, '#00e5ff');
      return;
    }
    if (this.rng() < p.bloqueio) {
      this.emit('bloqueado', 'cripto', e);
      return;
    }
    const dano = Math.round(e.dano * (e.chefe ? p.danoChefe : 1));
    this.log(`> [!] ${e.nome} atacou: -${dano}`, '#ff3355');
    this.ferir(dano, e);
  }

  // Dano no jogador (ataque, pacote que chegou, phishing, Modo Root)
  private ferir(dano: number, atacante: Inimigo | null) {
    const b = this.b,
      p = this.r.p;
    if (!ATIVO(b.etapa)) return;
    p.hp -= dano;
    b.stats.danoRecebido += dano;
    this.emit('dano', dano, atacante);
    if (atacante) {
      if (b.combo >= 5) this.log(`> combo reduzido`, '#ff3355');
      // Deploy na Sexta: o combo não perdoa
      b.combo = p.comboFragil ? 0 : Math.floor(b.combo / 2);
    }

    if (p.hp <= 0) {
      if (p.reviver > 0) {
        p.reviver--;
        p.hp = Math.round(p.maxHp * 0.5);
        this.emit('backupRestaurado');
        this.log('> backup na nuvem restaurado!', '#ff2bd6');
      } else {
        p.hp = 0;
        this.morrer();
      }
    }
  }

  private morrer() {
    const b = this.b;
    b.etapa = 'morte';
    b.tempoEtapa = 0;
    b.alvo = null;
    this.emit('jogadorDerrotado');
    this.log('> CONEXÃO PERDIDA', '#ff3355');
  }

  // ---------------- itens ----------------
  usarItem(idx: number) {
    if (!this.podeDigitar()) return;
    const b = this.b,
      run = this.r,
      p = run.p;
    const it = ITENS[idx];
    if (!it || run.inventario[it.id] <= 0) {
      this.emit('itemNegado');
      return;
    }
    let valor = 0;
    switch (it.id) {
      case 'cafe':
        b.lento = 8;
        break;
      case 'patch': {
        const antes = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + 35);
        valor = p.hp - antes;
        break;
      }
      case 'antivirus':
        // o aviso vem antes do dano, para a varredura aparecer por baixo dos números
        this.emit('itemUsado', it.id, 0);
        for (const e of b.inimigos.slice()) if (!e.morrendo && e.nascendo <= 0) this.aplicarDano(e, 40, false);
        break;
      case 'escudo':
        b.escudo += 2;
        break;
    }
    if (it.id !== 'antivirus') this.emit('itemUsado', it.id, valor);
    run.inventario[it.id]--;
    b.stats.itensUsados++;
    this.log(`> ${it.nome.toLowerCase()} executado`, '#ffb000');
  }

  // ---------------- consultas para a interface ----------------
  // Como a frase aparece: letras que não chegaram viram ░; frase cifrada mostra só a próxima letra
  static mascarar(e: Pick<Inimigo, 'texto' | 'dig' | 'visivel' | 'cifrado'>): string {
    return [...e.texto]
      .map((ch, i) => {
        if (i < e.dig) return ch;
        if (e.visivel != null && i >= e.visivel) return '░';
        if (e.cifrado && i > e.dig && ch !== ' ') return '*';
        return ch;
      })
      .join('');
  }

  prompt(): Prompt | null {
    const b = this.estado;
    if (!b) return null;
    const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : null;
    const montar = (e: Inimigo, ativo: boolean): Prompt => ({
      texto: e.texto,
      dig: e.dig,
      nome: e.nome,
      ativo,
      mascara: Battle.mascarar(e),
    });
    if (alvo) return montar(alvo, true);
    if (b.chefe && !b.chefe.morrendo && b.etapa === 'chefe') return montar(b.chefe, false);
    return { texto: '', dig: 0, nome: '', ativo: false };
  }

  // Upgrades: sorteia n cartas diferentes, respeitando raridade e limite
  sortearCartas(n = 3): Upgrade[] {
    const run = this.r;
    const disponiveis = UPGRADES.filter(u => (run.upgrades[u.id] || 0) < u.max);
    const escolhidas: Upgrade[] = [];
    while (escolhidas.length < n && disponiveis.length) {
      const total = disponiveis.reduce((s, u) => s + RARIDADES[u.raridade].peso, 0);
      let r = this.rng() * total;
      let idx = 0;
      for (; idx < disponiveis.length; idx++) {
        r -= RARIDADES[disponiveis[idx].raridade].peso;
        if (r <= 0) break;
      }
      escolhidas.push(disponiveis.splice(Math.min(idx, disponiveis.length - 1), 1)[0]);
    }
    return escolhidas;
  }

  // Custo para trocar as 3 cartas (sobe a cada uso na partida)
  custoRerrolar = () => MEC.rerrolar.custo + MEC.rerrolar.aumento * this.r.rerrolagens;

  rerrolar(): Upgrade[] | null {
    const run = this.r;
    const custo = this.custoRerrolar();
    if (run.p.creditos < custo) return null;
    run.p.creditos -= custo;
    run.rerrolagens++;
    return this.sortearCartas(3);
  }

  // quantas cartas (níveis) o jogador tem de cada área
  progressoAreas(): Record<Area, number> {
    const run = this.r;
    const cont: Record<Area, number> = { seguranca: 0, performance: 0, infra: 0 };
    for (const u of UPGRADES) cont[u.area] += run.upgrades[u.id] || 0;
    return cont;
  }

  // Aplica a carta e devolve a sinergia ativada por ela (se houver)
  aplicarUpgrade(u: Upgrade): Sinergia | null {
    const run = this.r;
    aplicarEfeitos(run.p, u);
    run.p.hp = Math.min(run.p.hp, run.p.maxHp);
    run.upgrades[u.id] = (run.upgrades[u.id] || 0) + 1;
    const prog = this.progressoAreas();
    const s = SINERGIAS.find(x => x.area === u.area && prog[x.area] >= x.minimo && !run.sinergias.includes(x.area));
    if (!s) return null;
    aplicarEfeitos(run.p, s);
    run.p.hp = Math.min(run.p.hp, run.p.maxHp);
    run.sinergias.push(s.area);
    this.log(`> [★] sinergia: ${s.nome}`, '#ffd700');
    this.emit('sinergia', s);
    return s;
  }

  comprar(idx: number): ResultadoCompra {
    const run = this.r;
    const it = ITENS[idx];
    if (!it) return 'invalido';
    if (run.inventario[it.id] >= BAL.itemMax) return 'cheio';
    if (run.p.creditos < it.preco) return 'sem credito';
    run.p.creditos -= it.preco;
    run.inventario[it.id]++;
    return 'ok';
  }

  // Servidor misterioso: aparece às vezes antes de um andar
  sortearServidor(): boolean {
    return this.rng() < MEC.servidor.chance;
  }

  // Aposta créditos: 50% de chance de dobrar, 50% de perder
  apostarServidor(): ResultadoAposta {
    const p = this.r.p;
    const valor = MEC.servidor.aposta;
    if (p.creditos < valor) return { resultado: 'sem credito' };
    if (this.rng() < 0.5) {
      p.creditos += valor;
      return { resultado: 'ganhou', valor };
    }
    p.creditos -= valor;
    return { resultado: 'perdeu', valor };
  }

  // Fim de partida: bônus de vitória e números finais (usado pela tela de fim)
  encerrar(venceu: boolean) {
    const run = this.r;
    this.registrarAndar(venceu);
    if (venceu) this.conquista('zerou');
    run.venceu = venceu;
    if (venceu) run.pontos += 5000 + Math.round(run.p.hp * 20);
    run.trilha.push(run.pontos); // pontuação final no fim da trilha do fantasma
    const s = run.stats;
    const minutos = Math.max(s.tempo / 60, 1 / 60);
    const total = s.acertos + s.erros;
    return {
      ppm: Math.round(s.acertos / 5 / minutos),
      precisao: total ? Math.round((s.acertos / total) * 100) : 0,
      andar: this.posicao(),
      totalAndares: this.totalAndares(),
    };
  }
}

// Efeitos declarativos dos upgrades e sinergias (veja "efeitos" em jogo.json)
export function aplicarEfeitos(p: Jogador, u: Pick<Upgrade, 'efeitos'>) {
  const alvo = p as unknown as Record<string, number | boolean>;
  for (const { atributo, op, valor } of u.efeitos) {
    const atual = alvo[atributo];
    if (op === 'set') alvo[atributo] = valor;
    else if (typeof atual === 'number' && typeof valor === 'number')
      alvo[atributo] = op === 'add' ? atual + valor : atual * valor;
    else throw new Error(`efeito "${op}" inválido para ${atributo}`);
  }
}

export { temAcento };
