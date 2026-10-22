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
  MODOS,
  RARIDADES,
  TIPOS_INIMIGO,
  UPGRADES,
  type Andar,
  type Chefe,
  type Conquista,
  type ItemId,
  type JogadorBase,
  type ModoId,
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

export type Jogador = JogadorBase & { maxHp: number };
export type Etapa = 'ondas' | 'alerta' | 'chefe' | 'vitoria' | 'morte';

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
  // só chefões
  intervaloBase: number;
  frases: string[];
  fraseIdx: number;
  metade: boolean;
  truque: Chefe['truque'];
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

// Tudo o que a batalha avisa para o mundo de fora
export type EventosBatalha = {
  log: [msg: string, cor?: string];
  andarIniciado: [];
  acerto: [alvo: Inimigo];
  erro: [];
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
  dano: [dano: number, atacante: Inimigo];
  backupRestaurado: [];
  jogadorDerrotado: [];
  itemUsado: [id: ItemId, valor: number];
  itemNegado: [];
  conquista: [def: Conquista];
  andarConcluido: [];
  gameOver: [];
};

const ATIVO = (etapa: Etapa) => etapa === 'ondas' || etapa === 'chefe';

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
      lento: 0,
      chefe: null,
      tempoInvocar: 0,
      recentes: [],
      avisou: false,
      registrado: false,
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
    this.emit('andarIniciado');
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
      intervaloBase: 0,
      frases: [],
      fraseIdx: 0,
      metade: false,
      truque: null,
      ...extra,
    };
  }

  private slotLivre(slots: { x: number; y: number }[], limite: number) {
    for (let i = 0; i < Math.min(limite, slots.length); i++) {
      if (!this.b.inimigos.some(e => !e.chefe && e.slot === i)) return i;
    }
    return -1;
  }

  private criarInimigo(slots: { x: number; y: number }[], slot: number, fracoHp = 1) {
    const b = this.b,
      A = b.A;
    const tipo = TIPOS_INIMIGO[sortear(this.rng, A.tipos)];
    const hp = Math.round(A.hp * fracoHp * MODOS[this.r.modo].fatorVida);
    const e = this.baseInimigo({
      chefe: false,
      nome: tipo.arquivo,
      sprite: tipo.sprite,
      escala: ESCALA_INIMIGO,
      paleta: { A: A.cores[0], B: A.cores[1] },
      slot,
      x: slots[slot].x,
      y: slots[slot].y,
      hp,
      maxHp: hp,
      dano: A.dano,
      recompensa: Math.round(A.recompensa * fracoHp),
    });
    b.inimigos.push(e);
    this.novoTexto(e);
    e.atk = -0.6; // pequena folga ao aparecer
    return e;
  }

  private criarChefe() {
    const b = this.b;
    const C = b.A.chefe;
    const hp = Math.round(C.hp * MODOS[this.r.modo].fatorVida);
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
      dano: C.dano,
      recompensa: C.recompensa,
      intervaloBase: C.intervalo,
      frases: C.frases,
      fraseIdx: 0,
      metade: false,
      truque: C.truque,
      nascendo: 1.2,
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

  private novoTexto(e: Inimigo) {
    const b = this.b;
    if (e.chefe) {
      e.texto = e.frases[e.fraseIdx % e.frases.length];
      e.fraseIdx++;
    } else {
      // evita repetir palavras e evita que dois inimigos comecem com a mesma letra
      const proximas = b.inimigos
        .filter(o => o !== e && !o.morrendo && o.texto)
        .map(o => semAcento(o.texto[o.dig] || ''));
      const livre = (w: string) => !proximas.includes(semAcento(w[this.inicioTexto(w)]));
      const palavras = b.A.palavras;
      let cands = palavras.filter(w => livre(w) && !b.recentes.includes(w));
      if (!cands.length) cands = palavras.filter(livre);
      if (!cands.length) cands = palavras;
      e.texto = sortear(this.rng, cands);
      b.recentes.push(e.texto);
      if (b.recentes.length > 10) b.recentes.shift();
    }
    e.dig = this.inicioTexto(e.texto);
    e.erros = 0;
    e.imperfeito = false;
    e.t0 = null;
    this.calcularIntervalo(e);
  }

  private calcularIntervalo(e: Inimigo) {
    if (e.chefe) {
      let i = e.intervaloBase;
      if (e.metade) i *= 0.85;
      if (e.truque === 'acelerar') i *= 0.6 + 0.4 * (e.hp / e.maxHp);
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
        if (b.chefe && b.chefe.truque === 'invocar' && !b.chefe.morrendo) {
          b.tempoInvocar += dt;
          const minions = b.inimigos.filter(e => !e.chefe && !e.morrendo).length;
          if (b.tempoInvocar > 10 && minions < 2) {
            const slot = this.slotLivre(SLOTS_CHEFE, 2);
            if (slot >= 0) {
              this.criarInimigo(SLOTS_CHEFE, slot, 0.5);
              b.tempoInvocar = 0;
              this.falar(b.chefe, sortear(this.rng, ['REFORÇOS!', 'ATAQUEM!', 'MAIS PROCESSOS!']));
            }
          }
        }
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
      if (ATIVO(b.etapa) && e.nascendo <= 0) {
        e.atk += dt * fatorVel;
        if (e.atk >= e.intervalo) {
          e.atk = 0;
          this.atacar(e);
        }
      }
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
      const cands = b.inimigos.filter(e => !e.morrendo && this.compara(c, e.texto[e.dig]));
      if (!cands.length) {
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

    const res = this.compara(c, alvo.texto[alvo.dig]);
    if (!res) {
      this.erro(alvo);
      return;
    }
    if (res === 'leniente') alvo.imperfeito = true;
    if (res === 'exato' && temAcento(alvo.texto[alvo.dig])) run.stats.acentoOk++;
    if (alvo.t0 == null) alvo.t0 = run.stats.tempo; // início da palavra (conquista "Fibra Óptica")
    alvo.dig++;
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
      if (run.p.perdoaErro && alvo.erros === 1) return;
    }
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
    const perfeito = e.erros === 0 && !e.imperfeito;
    if (perfeito) b.combo += p.ganhoCombo;
    run.stats.maiorCombo = Math.max(run.stats.maiorCombo, b.combo);
    run.stats.palavras++;
    b.alvo = null;

    const len = e.texto.length;
    const fatorTexto = e.chefe ? Math.max(1, len / 8) : 1 + Math.max(0, len - 5) * 0.08;
    const multCombo = 1 + Math.min(b.combo, BAL.comboMax) * BAL.comboPasso;
    const crit = this.rng() < p.crit;
    const dano = Math.round(p.atk * fatorTexto * multCombo * (crit ? p.critMult : 1));
    run.pontos += Math.round(len * 10 * multCombo * (crit ? 1.5 : 1) * (perfeito ? 1 : 0.6));

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
    this.aplicarDano(e, dano, crit);
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
    run.pontos += (e.chefe ? 500 : 50) * (run.andar + 1);
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
    }
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
    p.hp -= dano;
    b.stats.danoRecebido += dano;
    this.emit('dano', dano, e);
    this.log(`> [!] ${e.nome} atacou: -${dano}`, '#ff3355');
    if (b.combo >= 5) this.log(`> combo reduzido`, '#ff3355');
    b.combo = Math.floor(b.combo / 2);

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
  prompt(): { texto: string; dig: number; nome: string; ativo: boolean } | null {
    const b = this.estado;
    if (!b) return null;
    const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : null;
    if (alvo) return { texto: alvo.texto, dig: alvo.dig, nome: alvo.nome, ativo: true };
    if (b.chefe && !b.chefe.morrendo && b.etapa === 'chefe') {
      return { texto: b.chefe.texto, dig: b.chefe.dig, nome: b.chefe.nome, ativo: false };
    }
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

  aplicarUpgrade(u: Upgrade) {
    const run = this.r;
    aplicarEfeitos(run.p, u);
    run.p.hp = Math.min(run.p.hp, run.p.maxHp);
    run.upgrades[u.id] = (run.upgrades[u.id] || 0) + 1;
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

  // Fim de partida: bônus de vitória e números finais (usado pela tela de fim)
  encerrar(venceu: boolean) {
    const run = this.r;
    this.registrarAndar(venceu);
    if (venceu) this.conquista('zerou');
    run.venceu = venceu;
    if (venceu) run.pontos += 5000 + Math.round(run.p.hp * 20);
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

// Efeitos declarativos dos upgrades (veja "efeitos" em jogo.json)
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
