// =====================================================================
//  Interface: fluxo de telas, HUD, cartas, loja, relatório, ranking,
//  conquistas e painel do organizador.
// =====================================================================

import { Sound } from '../audio/sound';
import type { Config } from '../config';
import {
  ANDARES,
  BAL,
  CONQUISTAS,
  AREAS_INFO,
  ITENS,
  MEC,
  MODOS,
  RARIDADES,
  SINERGIAS,
  type Conquista,
  type ModoId,
  type Upgrade,
} from '../content';
import { PASSO_TRILHA, temAcento, type Battle, type Partida } from '../game/battle';
import { FX } from '../render/fx';
import { hashPin, VOLUMES, type GerenciadorAjustes } from '../storage/ajustes';
import { noApp, salvarCsvNoApp } from '../storage/backup';
import { gerarCsv, nomeArquivoCsv } from '../storage/csv';
import type { Fantasma, GerenciadorFantasmas } from '../storage/fantasma';
import { limparNick, validarNick } from '../storage/nick';
import type { Posicao, Ranking } from '../storage/ranking';
import { $, h, linhaStat, reiniciarAnimacao, trocar, type Filho } from './dom';
import { MENUS_DA_PARTIDA, MENUS_SEM_PARTIDA, MOSTRA_BATALHA, transicaoValida, type Estado } from './estados';

const TELAS = [
  'screen-title',
  'screen-nick',
  'screen-mode',
  'screen-tutorial',
  'screen-clear',
  'screen-upgrade',
  'screen-shop',
  'screen-pause',
  'screen-end',
  'screen-report',
  'screen-ranking',
  'screen-pin',
  'screen-panel',
  'screen-rota',
  'screen-duelo',
] as const;
type Tela = (typeof TELAS)[number];

interface Dependencias {
  battle: Battle;
  ranking: Ranking;
  fantasmas: GerenciadorFantasmas;
  ajustes: GerenciadorAjustes;
  config: Config;
}

// Duelo em revezamento: os dois jogadores enfrentam o mesmo desafio inicial (mesma semente)
const MODO_DUELO: ModoId = 'rapido';
interface ResultadoDuelo {
  nick: string;
  pontos: number;
  andar: number;
  totalAndares: number;
  ppm: number;
  precisao: number;
  venceu: boolean;
}

export function criarUI({ battle, ranking, fantasmas, ajustes, config: CONFIG }: Dependencias) {
  let estado: Estado = 'carregando'; // só vira 'titulo' depois que as fontes carregam
  let travaAte = 0; // evita que um ENTER "vaze" de uma tela para outra
  let ultimaAtividade = performance.now();
  let timers: ReturnType<typeof setTimeout>[] = [];
  let cartas: Upgrade[] = [];
  let ultimoResultado: Posicao | null = null;
  let nickPendente = '';
  let confirmarApagarAte = 0;
  let cachePrompt = '';
  let cacheHud: Record<string, string> = {};
  let duelo: { fase: 1 | 2; semente: number; resultados: ResultadoDuelo[]; trilhaJ1: Fantasma | null } | null = null;
  let fantasma: Fantasma | null = null; // contra quem o jogador corre (recordista ou jogador 1 do duelo)

  const agora = () => performance.now();
  const travar = (ms = 600) => {
    travaAte = agora() + ms;
  };
  const travado = () => agora() < travaAte;
  const esperar = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  };
  const limparTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const pad = (n: number, t: number) => String(n).padStart(t, '0');
  const run = (): Partida => {
    if (!battle.run) throw new Error('nenhuma partida em andamento');
    return battle.run;
  };
  const rotuloAndar = () =>
    `${run().modo === 'rapido' ? 'RÁPIDO · ' : ''}ANDAR ${battle.posicao()}/${battle.totalAndares()}`;
  const ocultar = (id: string, sim = true) => $(id).classList.toggle('hidden', sim);

  function mostrar(id: Tela | null) {
    TELAS.forEach(t => ocultar(t, t !== id));
  }

  // Única porta de entrada para mudar de estado: confere a tabela de transições
  function irPara(novo: Estado) {
    if (!transicaoValida(estado, novo)) {
      const msg = `[INVASAO] transição de tela inesperada: ${estado} → ${novo}`;
      if (import.meta.env.DEV) throw new Error(msg);
      console.error(msg); // no evento, nunca travar: registra e segue
    }
    estado = novo;
  }

  function setEstado(novo: Estado, tela: Tela) {
    irPara(novo);
    mostrar(tela);
    travar();
    focar();
  }

  function focar() {
    if (estado === 'nick') $('nick-input').focus();
    else if (estado === 'pin' || estado === 'novoPin') $('pin-input').focus();
    else $('type-input').focus({ preventScroll: true });
  }

  // ================= TÍTULO =================
  function irTitulo() {
    limparTimers();
    limparConquistas();
    duelo = null; // próximo visitante: duelo pela metade não continua
    Sound.pararMusica();
    ocultar('hud');
    ocultar('banner');
    for (const modo of ['normal', 'rapido'] as const) {
      const lista = ranking.top(3, modo);
      trocar(
        $(`title-rank-${modo}`),
        lista.length
          ? lista.map(r => h('li', null, h('span', null, r.nick), h('span', null, pad(r.pontos, 6))))
          : h('li', { class: 'vazio' }, 'seja o primeiro!'),
      );
    }
    setEstado('titulo', 'screen-title');
  }

  // ================= NICK =================
  function irNick() {
    Sound.init();
    Sound.sfx.boot();
    setEstado('nick', 'screen-nick');
    $<HTMLInputElement>('nick-input').value = '';
    $('nick-error').textContent = '';
    const linhas =
      duelo?.fase === 2
        ? [
            '> DUELO: o jogador 1 terminou.',
            `> placar a bater: ${duelo.resultados[0]?.pontos ?? 0} pontos (${duelo.resultados[0]?.nick ?? ''}).`,
            '> mesmo desafio inicial, mesma semente.',
            '> jogador 2, identifique-se:',
          ]
        : [
            '> conectando ao servidor da empresa...',
            '> conexão estabelecida.',
            '> ALERTA: o prédio foi invadido por vírus!',
            '> precisamos de alguém para limpar os andares.',
            '> identifique-se, hacker:',
          ];
    const box = $('nick-lines');
    trocar(box);
    linhas.forEach((l, i) =>
      esperar(i * 350, () => {
        box.append(h('div', l.includes('ALERTA') ? { class: 'red' } : null, l));
        Sound.sfx.tecla();
      }),
    );
  }

  function confirmarNick() {
    const nick = limparNick($<HTMLInputElement>('nick-input').value);
    const erro = validarNick(nick);
    if (erro) {
      $('nick-error').textContent = '> ' + erro;
      Sound.sfx.negado();
      return;
    }
    Sound.sfx.selecao();
    nickPendente = nick;
    // duelo: o jogador 2 vai direto para o mesmo desafio do jogador 1
    if (duelo?.fase === 2) comecar(MODO_DUELO);
    // o organizador pode travar um modo (ex.: só o rápido quando a fila está grande)
    else if (CONFIG.modoFixo) comecar(CONFIG.modoFixo);
    else irModo();
  }

  // ================= MODO DE JOGO =================
  function irModo() {
    for (const m of ['normal', 'rapido'] as const) $(`modo-desc-${m}`).textContent = MODOS[m].desc;
    setEstado('modo', 'screen-mode');
  }

  function comecar(modo: ModoId) {
    battle.novaPartida(nickPendente, modo, { semente: duelo ? duelo.semente : sementeUrl() });
    // fantasma: no duelo, o jogador 2 corre contra o jogador 1; senão, contra o recordista do modo
    fantasma = duelo?.fase === 2 && duelo.trilhaJ1 ? duelo.trilhaJ1 : fantasmas.carregar(modo);
    setEstado('tutorial', 'screen-tutorial');
  }

  function escolherModo(modo: ModoId | 'duelo') {
    if (estado !== 'modo' || travado()) return;
    Sound.sfx.selecao();
    if (modo === 'duelo') {
      duelo = { fase: 1, semente: sementeUrl() ?? Math.floor(Math.random() * 1e9), resultados: [], trilhaJ1: null };
      comecar(MODO_DUELO);
    } else comecar(modo);
  }

  // ================= ANDAR =================
  function iniciarAndar() {
    limparTimers();
    battle.iniciarAndar();
    const A = ANDARES[run().andar];
    mostrar(null);
    ocultar('hud', false);
    trocar($('log'));
    cacheHud = {};
    cachePrompt = '';
    irPara('banner');
    focar();
    banner(rotuloAndar(), A.nome, A.desc, A.dica, 'normal');
    Sound.sfx.levelUp();
    esperar(3600, () => {
      ocultar('banner');
      irPara('batalha');
      $<HTMLInputElement>('type-input').value = '';
      Sound.tocarMusica('normal');
      logLinha(`> andar ${battle.posicao()}: ${A.nome.toLowerCase()}`, '#39ff14');
    });
  }

  function banner(topo: string, titulo: string, sub: string, dica: string, tipo: 'normal' | 'chefe') {
    const el = $('banner');
    el.className = tipo === 'chefe' ? 'chefe' : '';
    $('banner-top').textContent = topo;
    $('banner-title').textContent = titulo;
    $('banner-title').setAttribute('data-text', titulo);
    $('banner-sub').textContent = sub || '';
    $('banner-tip').textContent = dica || '';
    reiniciarAnimacao(el);
  }

  battle.on('alertaChefe', chefe => {
    banner('⚠ AMEAÇA DETECTADA ⚠', chefe.nome, `"${chefe.falas.intro}"`, chefe.dica ?? '', 'chefe');
    esperar(3200, () => ocultar('banner'));
  });

  // ================= CONQUISTAS (aviso na tela) =================
  const filaConquistas: Conquista[] = [];
  let timerConquista: ReturnType<typeof setTimeout> | null = null;
  battle.on('conquista', def => {
    filaConquistas.push(def);
    // espera o instante atual terminar: conquistas que chegam juntas (ex.: chefão) formam uma rajada
    if (!timerConquista) timerConquista = setTimeout(proximaConquista, 0);
  });
  function proximaConquista() {
    const def = filaConquistas.shift();
    const el = $('toast');
    if (!def) {
      timerConquista = null;
      el.classList.add('hidden');
      return;
    }
    trocar(
      el,
      h('b', null, def.icone),
      h(
        'div',
        null,
        h('small', null, `★ CONQUISTA DESBLOQUEADA · +${BAL.bonusConquista}`),
        def.nome,
        h('i', null, def.desc),
      ),
    );
    el.classList.remove('hidden');
    reiniciarAnimacao(el);
    Sound.sfx.compra(); // um som por aviso exibido
    // várias de uma vez (ex.: chefão perfeito) passam mais rápido para não cobrir o jogo
    timerConquista = setTimeout(proximaConquista, filaConquistas.length ? 1200 : 2600);
  }
  // novo visitante: avisos da partida anterior não podem aparecer para ele
  function limparConquistas() {
    filaConquistas.length = 0;
    if (timerConquista) clearTimeout(timerConquista);
    timerConquista = null;
    ocultar('toast');
  }

  // ================= ANDAR CONCLUÍDO =================
  battle.on('andarConcluido', () => {
    const r = run();
    battle.registrarAndar(true);
    if (battle.ehUltimo()) {
      fimDeJogo(true);
      return;
    }
    const A = ANDARES[r.andar];
    const b = battle.estado!;
    const curou = battle.curarEntreAndares();
    const total = b.stats.acertos + b.stats.erros;
    ocultar('hud');
    $('clear-title').textContent = `// ANDAR ${battle.posicao()} LIBERADO: ${A.nome}`;
    trocar(
      $('clear-stats'),
      linhaStat('chefão derrotado', A.chefe.nome),
      linhaStat('inimigos removidos', b.stats.abates),
      linhaStat('precisão no andar', `${total ? Math.round((b.stats.acertos / total) * 100) : 100}%`),
      linhaStat('pontos no andar', `+${r.pontos - b.stats.inicioPontos}`),
      linhaStat('manutenção do sistema', curou > 0 ? `+${curou} integridade` : 'integridade máxima', 'green'),
    );
    $('clear-fact').textContent = A.fato;
    Sound.pararMusica();
    Sound.sfx.vitoria();
    setEstado('concluido', 'screen-clear');
    travar(900);
  });

  // ================= UPGRADES =================
  let sinergiaNova: string | null = null; // sinergia ativada pela última carta (aparece na loja)

  function irUpgrade() {
    cartas = battle.sortearCartas(3);
    renderCartas();
    Sound.sfx.levelUp();
    setEstado('upgrade', 'screen-upgrade');
  }

  function renderCartas() {
    const r = run();
    trocar(
      $('cards'),
      cartas.map((u, i) => {
        const rar = RARIDADES[u.raridade];
        const area = AREAS_INFO[u.area];
        const nivel = r.upgrades[u.id] || 0;
        return h(
          'div',
          { class: 'card', data: { i }, style: { '--cor': rar.cor }, onClick: () => escolherCarta(i) },
          h('div', { class: 'card-key' }, `[${i + 1}]`),
          h('div', { class: 'card-rar' }, rar.nome),
          h('div', { class: 'card-icon' }, u.icone),
          h('div', { class: 'card-name' }, u.nome),
          h('div', { class: 'card-desc' }, u.desc),
          h('div', { class: 'card-area', style: { color: area.cor } }, area.nome),
          h('div', { class: 'card-lvl' }, u.max > 1 ? `nível ${nivel} → ${nivel + 1}` : 'único'),
        );
      }),
    );
    // progresso das sinergias: 3 cartas da mesma área ativam um bônus
    const prog = battle.progressoAreas();
    trocar(
      $('sinergias'),
      SINERGIAS.map(s => {
        const ativa = r.sinergias.includes(s.area);
        const area = AREAS_INFO[s.area];
        return h(
          'span',
          { class: `sinergia ${ativa ? 'ativa' : ''}`, style: { '--cor': area.cor }, title: s.desc },
          `${area.nome} ${Math.min(prog[s.area], s.minimo)}/${s.minimo}`,
          ativa ? ' ✓' : '',
        );
      }),
    );
    $('rerrolar').textContent = `[R] trocar as cartas: ${battle.custoRerrolar()} ₿ (você tem ${r.p.creditos} ₿)`;
  }

  function rerrolarCartas() {
    if (estado !== 'upgrade' || travado()) return;
    const novas = battle.rerrolar();
    if (!novas) {
      Sound.sfx.negado();
      return;
    }
    cartas = novas;
    Sound.sfx.compra();
    renderCartas();
  }

  function escolherCarta(i: number) {
    if (estado !== 'upgrade' || travado() || !cartas[i]) return;
    const s = battle.aplicarUpgrade(cartas[i]);
    sinergiaNova = s ? `★ SINERGIA ATIVADA: ${s.nome}. ${s.desc}` : null;
    Sound.sfx.compra();
    document.querySelectorAll('.card')[i].classList.add('escolhida');
    irPara('escolhendo');
    esperar(500, irLoja);
  }

  // ================= LOJA =================
  function irLoja() {
    const msg = $('shop-msg');
    msg.textContent = sinergiaNova ?? '';
    msg.className = 'gold';
    sinergiaNova = null;
    renderLoja();
    setEstado('loja', 'screen-shop');
  }

  function renderLoja() {
    const r = run();
    $('shop-cred').textContent = `CRÉDITOS: ${r.p.creditos} ₿`;
    trocar(
      $('shop-list'),
      ITENS.map((it, i) => {
        const qtd = r.inventario[it.id];
        const off = r.p.creditos < it.preco || qtd >= BAL.itemMax;
        return h(
          'div',
          { class: `shop-item ${off ? 'off' : ''}`, data: { i }, onClick: () => comprar(i) },
          h('span', { class: 'shop-key' }, `[${i + 1}]`),
          h('span', { class: 'shop-icon' }, it.icone),
          h('span', { class: 'shop-name' }, it.nome, h('small', null, it.desc)),
          h('span', { class: 'shop-qtd' }, `${qtd}/${BAL.itemMax}`),
          h('span', { class: 'shop-price' }, `${it.preco} ₿`),
        );
      }),
    );
  }

  function comprar(i: number) {
    if (estado !== 'loja') return;
    const res = battle.comprar(i);
    const msg = $('shop-msg');
    if (res === 'ok') {
      Sound.sfx.compra();
      msg.textContent = `> ${ITENS[i].nome} adicionado ao inventário.`;
      msg.className = 'green';
    } else if (res === 'cheio') {
      Sound.sfx.negado();
      msg.textContent = '> inventário cheio para este item.';
      msg.className = 'red';
    } else if (res === 'sem credito') {
      Sound.sfx.negado();
      msg.textContent = '> créditos insuficientes.';
      msg.className = 'red';
    }
    renderLoja();
  }

  // ================= ROTA (antes de cada andar) =================
  // Rota segura ou de elite (mais forte, mais créditos e pontos) e, às vezes,
  // um "servidor misterioso" para apostar créditos.
  let servidorDisponivel = false;

  function irRota() {
    servidorDisponivel = battle.sortearServidor();
    $('rota-msg').textContent = '';
    renderRota();
    setEstado('rota', 'screen-rota');
  }

  function renderRota() {
    const r = run();
    const prox = ANDARES[r.rota[r.passo + 1]];
    const e = MEC.elite;
    teclaRotaDica();
    $('rota-titulo').textContent = `// PRÓXIMO: ANDAR ${battle.posicao() + 1} · ${prox.nome}`;
    const opcao = (tecla: string, nome: string, desc: string, cls = '') =>
      h('div', { class: `rota-opcao ${cls}` }, h('b', null, `[${tecla}] ${nome}`), h('small', null, desc));
    trocar(
      $('rota-opcoes'),
      opcao('1', 'ROTA SEGURA', 'inimigos normais'),
      opcao(
        '2',
        'ROTA DE ELITE',
        `inimigos com +${Math.round((e.multVida - 1) * 100)}% de vida e +${Math.round((e.multDano - 1) * 100)}% de dano · créditos x${e.multRecompensa} · pontos x${e.multPontos}`,
        'elite',
      ),
      servidorDisponivel
        ? opcao(
            '3',
            'SERVIDOR MISTERIOSO',
            `aposte ${MEC.servidor.aposta} ₿: 50% de chance de dobrar, 50% de perder (você tem ${r.p.creditos} ₿)`,
            'servidor',
          )
        : null,
    );
  }

  function teclaRotaDica() {
    $('rota-dica').textContent = servidorDisponivel
      ? 'escolha a rota com 1 ou 2 · 3 aposta no servidor'
      : 'escolha a rota com 1 ou 2';
  }

  function teclaRota(k: string) {
    if (k === '1' || k === '2') {
      battle.escolherRota(k === '2');
      Sound.sfx.selecao();
      battle.avancar();
      iniciarAndar();
    } else if (k === '3' && servidorDisponivel) {
      const res = battle.apostarServidor();
      const msg = $('rota-msg');
      if (res.resultado === 'sem credito') {
        Sound.sfx.negado();
        msg.className = 'red';
        msg.textContent = '> créditos insuficientes para apostar.';
        return;
      }
      servidorDisponivel = false; // uma aposta por servidor
      if (res.resultado === 'ganhou') {
        Sound.sfx.moeda();
        msg.className = 'green';
        msg.textContent = `> acesso root concedido: +${res.valor} ₿!`;
      } else {
        Sound.sfx.armadilha();
        msg.className = 'red';
        msg.textContent = `> era um honeypot: -${res.valor} ₿.`;
      }
      renderRota();
    }
  }

  function proximoAndar() {
    irRota();
  }

  // ================= PAUSA =================
  const textoSomPausa = () => `[2] Som: ${Sound.ligado ? 'ON' : 'OFF'}`;
  function pausar() {
    const b = battle.estado;
    // não pausa durante a explosão do chefão nem durante a derrota
    if (estado !== 'batalha' || !b || b.etapa === 'vitoria' || b.etapa === 'morte') return;
    $('pause-sound').textContent = textoSomPausa();
    Sound.pararMusica();
    setEstado('pausa', 'screen-pause');
  }

  function continuar() {
    mostrar(null);
    irPara('batalha');
    travar(200);
    focar();
    const b = battle.estado;
    if (b && (b.etapa === 'ondas' || b.etapa === 'chefe')) Sound.tocarMusica(b.chefe ? 'chefe' : 'normal');
  }

  function desistir() {
    mostrar(null);
    if (battle.estado) battle.estado.etapa = 'morte';
    fimDeJogo(false);
  }

  // ================= FIM DE JOGO =================
  battle.on('gameOver', () => fimDeJogo(false));

  function fimDeJogo(venceu: boolean) {
    limparTimers();
    Sound.pararMusica();
    const r = run();
    const { ppm, precisao, andar, totalAndares } = battle.encerrar(venceu);
    const s = r.stats;
    const A = ANDARES[r.andar];

    // partidas de teste (?andar=N) não entram no ranking
    ultimoResultado = r.debug
      ? ranking.simular(r.pontos, r.modo)
      : ranking.adicionar({
          nick: r.nick,
          pontos: r.pontos,
          andar,
          total: totalAndares,
          venceu,
          ppm,
          precisao,
          modo: r.modo,
          conquistas: r.conquistas.slice(),
          data: new Date().toISOString(),
        });

    // fantasma: a partida vira a referência do modo se bateu o recorde
    if (!r.debug) fantasmas.registrar(r.modo, r.nick, r.pontos, r.trilha);
    if (duelo) {
      duelo.resultados[duelo.fase - 1] = { nick: r.nick, pontos: r.pontos, andar, totalAndares, ppm, precisao, venceu };
      if (duelo.fase === 1) duelo.trilhaJ1 = { nick: r.nick, pontos: r.pontos, trilha: r.trilha.slice() };
    }

    // registro no console (F12) para quem cuida do estande
    console.info(
      `[INVASAO] fim de jogo: ${r.nick} | ${r.modo} | ${r.pontos} pts | andar ${andar}/${totalAndares} | ${ppm} ppm | ${precisao}% | ${r.conquistas.length} conquistas${venceu ? ' | VENCEU' : ''}`,
    );

    ocultar('hud');
    ocultar('banner');
    const titulo = $('end-title');
    titulo.textContent = venceu ? 'SISTEMA RESTAURADO!' : 'CONEXÃO ENCERRADA';
    titulo.className = 'end-title ' + (venceu ? 'green' : 'red');
    trocar(
      $('end-sub'),
      venceu
        ? [
            `Você limpou ${r.modo === 'rapido' ? 'os 3 andares do modo rápido' : `os ${totalAndares} andares`}! Você tem o perfil de quem faz `,
            h('b', null, CONFIG.curso),
            '.',
          ]
        : [`${r.nick}, você chegou ao andar ${andar}: `, h('b', null, A.nome), '.'],
    );
    trocar(
      $('end-stats'),
      linhaStat('PONTUAÇÃO', r.pontos),
      linhaStat('ANDAR', venceu ? `${totalAndares}/${totalAndares} ✓` : `${andar}/${totalAndares}`),
      linhaStat('VELOCIDADE', `${ppm} ppm`),
      linhaStat('PRECISÃO', `${precisao}%`),
      linhaStat('MAIOR COMBO', `x${s.maiorCombo}`),
      linhaStat('CONQUISTAS', `${r.conquistas.length}/${CONQUISTAS.length}`),
    );
    const pos = ultimoResultado.posicao;
    const nomeModo = r.modo === 'rapido' ? ' (MODO RÁPIDO)' : '';
    trocar(
      $('end-rank'),
      pos <= 3
        ? h('span', { class: 'gold' }, `🏆 ${pos}º LUGAR NO RANKING${nomeModo}!`)
        : [`posição no ranking${nomeModo.toLowerCase()}: `, h('b', null, `${pos}º`), ` de ${ultimoResultado.total}`],
      h('div', { class: 'cta' }, `Gostou? Conheça o curso de ${CONFIG.curso}!`),
    );
    if (venceu) Sound.sfx.vitoria();
    $('end-press').textContent = !duelo
      ? '[ ENTER PARA VER SEU RELATÓRIO ]'
      : duelo.fase === 1
        ? '[ ENTER: VEZ DO JOGADOR 2 ]'
        : '[ ENTER: RESULTADO DO DUELO ]';
    setEstado('fim', 'screen-end');
    travar(1500);
    esperar(CONFIG.voltarTituloSeg * 1000, depoisDoFim);
  }

  // Depois da tela de fim: relatório (normal) ou o próximo passo do duelo
  function depoisDoFim() {
    if (!duelo) irRelatorio();
    else if (duelo.fase === 1) {
      duelo.fase = 2;
      irNick();
    } else irDuelo();
  }

  // ================= DUELO: RESULTADO =================
  function irDuelo() {
    limparTimers();
    const [j1, j2] = duelo?.resultados ?? [];
    if (!j1 || !j2) {
      irTitulo();
      return;
    }
    // vence quem fez mais pontos; empate se igual
    const vencedor = j1.pontos === j2.pontos ? null : j1.pontos > j2.pontos ? j1 : j2;
    $('duelo-titulo').textContent = vencedor ? `🏆 ${vencedor.nick} VENCEU O DUELO!` : 'EMPATE!';
    const coluna = (j: ResultadoDuelo, n: number) =>
      h(
        'div',
        { class: `duelo-jogador ${j === vencedor ? 'vencedor' : ''}` },
        h('div', { class: 'duelo-nick' }, `J${n} · ${j.nick}`),
        linhaStat('PONTOS', j.pontos),
        linhaStat('ANDAR', j.venceu ? `${j.totalAndares}/${j.totalAndares} ✓` : `${j.andar}/${j.totalAndares}`),
        linhaStat('VELOCIDADE', `${j.ppm} ppm`),
        linhaStat('PRECISÃO', `${j.precisao}%`),
      );
    trocar($('duelo-placar'), coluna(j1, 1), h('div', { class: 'duelo-vs' }, 'VS'), coluna(j2, 2));
    Sound.sfx.vitoria();
    setEstado('duelo', 'screen-duelo');
    esperar(CONFIG.voltarTituloSeg * 1000, irTitulo);
  }

  // ================= RELATÓRIO DE DESEMPENHO =================
  function analise(r: Partida, teclas: [string, number][]) {
    const hist = r.historico;
    const partes: string[] = [];
    if (!teclas.length) partes.push('nenhuma letra errada. Precisão de profissional!');
    else {
      const [pior, n] = teclas[0];
      if (pior === ' ') partes.push(`o espaço entre as palavras foi o que mais te derrubou (${n}x).`);
      else if (temAcento(pior)) partes.push(`seu maior obstáculo foram os acentos: "${pior}" (${n}x).`);
      else partes.push(`a letra "${pior}" foi a que mais te derrubou (${n}x).`);
    }
    if (hist.length >= 2 && hist[0].ppm > 0) {
      const ini = hist[0].ppm,
        fim = hist[hist.length - 1].ppm;
      if (fim > ini) partes.push(`Sua velocidade subiu de ${ini} para ${fim} ppm durante a partida.`);
    }
    return `> análise dos seus dados: ${partes.join(' ')} Transformar dados em decisões é o dia a dia de quem faz SI!`;
  }

  function irRelatorio() {
    limparTimers();
    const r = run(),
      s = r.stats;
    const hist = r.historico;
    const maxPpm = Math.max(30, ...hist.map(x => x.ppm));
    trocar($('rel-titulo'), '// RELATÓRIO DE DESEMPENHO ', h('span', { class: 'rel-nick' }, `@${r.nick}`));
    trocar(
      $('rel-barras'),
      hist.length
        ? hist.map((x, i) =>
            h(
              'div',
              { class: `rel-linha${x.concluido ? '' : ' parcial'}` },
              h('span', { class: 'rel-nome' }, `${i + 1}. ${x.nome}`),
              h('span', { class: 'rel-barra' }, h('i', { style: { width: `${Math.round((x.ppm / maxPpm) * 100)}%` } })),
              h('span', { class: 'rel-val' }, `${x.ppm} ppm · ${x.precisao}%`),
            ),
          )
        : h('div', { class: 'rel-vazio' }, 'nenhum andar registrado'),
    );
    const teclas = Object.entries(s.errosTecla)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    trocar(
      $('rel-teclas'),
      teclas.length
        ? teclas.map(([ch, n]) => h('span', { class: 'chip' }, ch === ' ' ? '␣' : ch, h('small', null, `${n}x`)))
        : h('span', { class: 'rel-vazio' }, 'nenhuma! 👏'),
    );
    const totAc = s.acentoOk + s.acentoErro;
    const seg = Math.round(s.tempo);
    trocar(
      $('rel-resumo'),
      linhaStat('precisão nos acentos', totAc ? Math.round((s.acentoOk / totAc) * 100) + '%' : '—'),
      linhaStat('palavras e frases', s.palavras),
      linhaStat('tempo de batalha', `${Math.floor(seg / 60)}:${pad(seg % 60, 2)}`),
    );
    $('rel-conq-n').textContent = `${r.conquistas.length}/${CONQUISTAS.length}`;
    trocar(
      $('rel-conquistas'),
      CONQUISTAS.map(c =>
        h(
          'div',
          { class: `conq ${r.conquistas.includes(c.id) ? 'on' : ''}`, title: c.desc },
          h('b', null, c.icone),
          h('span', null, c.nome),
        ),
      ),
    );
    $('rel-insight').textContent = analise(r, teclas);
    setEstado('relatorio', 'screen-report');
    esperar(CONFIG.voltarTituloSeg * 1000, irRanking);
  }

  // ================= RANKING =================
  function irRanking() {
    limparTimers();
    const modo = ultimoResultado?.modo ?? 'normal';
    const lista = ranking.carregar().filter(r => r.modo === modo);
    const n = CONFIG.rankingTela;
    const meuId = ultimoResultado?.id ?? null;
    $('rank-title').textContent = `// RANKING — MODO ${MODOS[modo].nome}`;
    const linha = (r: (typeof lista)[number], i: number) =>
      h(
        'tr',
        { class: `${r.id === meuId ? 'eu' : ''} ${i < 3 ? 'top' + (i + 1) : ''}` },
        h('td', null, `${i + 1}º`),
        h('td', null, r.nick),
        h('td', null, r.pontos),
        h('td', null, r.venceu ? `${r.total}/${r.total} ✓` : `${r.andar}/${r.total}`),
        h('td', null, r.ppm),
        h('td', null, `${r.precisao}%`),
        h('td', null, r.conquistas.length),
      );
    const linhas: Filho[] = [
      h('tr', null, ...['#', 'NICK', 'PONTOS', 'ANDAR', 'PPM', 'PREC.', '★'].map(t => h('th', null, t))),
      lista.slice(0, n).map(linha),
    ];
    const meu = lista.findIndex(r => r.id === meuId);
    if (meu >= n) linhas.push(h('tr', { class: 'sep' }, h('td', { colspan: 7 }, '· · ·')), linha(lista[meu], meu));
    if (!lista.length) linhas.push(h('tr', null, h('td', { colspan: 7 }, 'nenhum registro ainda')));
    trocar($('rank-table'), linhas);
    setEstado('ranking', 'screen-ranking');
    esperar(CONFIG.voltarTituloSeg * 1000, irTitulo);
  }

  // ================= PAINEL DO ORGANIZADOR =================
  // Abre com Ctrl+Shift+O na tela título e pede o PIN.
  function telaPin(novo: boolean) {
    $<HTMLInputElement>('pin-input').value = '';
    $('pin-error').textContent = '';
    $('pin-titulo').textContent = novo ? '// NOVO PIN (4 a 12 números)' : '// ACESSO DO ORGANIZADOR';
    $('pin-dica').textContent = novo ? 'ENTER salva — ESC cancela' : 'ENTER confirma — ESC volta ao jogo';
    setEstado(novo ? 'novoPin' : 'pin', 'screen-pin');
  }

  const pinCorreto = (pin: string) => hashPin(pin) === (CONFIG.pinHash ?? hashPin(CONFIG.pinPadrao));

  function confirmarPin() {
    const input = $<HTMLInputElement>('pin-input');
    if (pinCorreto(input.value)) {
      Sound.sfx.selecao();
      irPainel();
      return;
    }
    $('pin-error').textContent = '> PIN incorreto.';
    input.value = '';
    Sound.sfx.negado();
  }

  function salvarNovoPin() {
    const input = $<HTMLInputElement>('pin-input');
    if (!/^\d{4,12}$/.test(input.value)) {
      $('pin-error').textContent = '> use de 4 a 12 números.';
      Sound.sfx.negado();
      return;
    }
    CONFIG.pinHash = hashPin(input.value);
    salvarAjustes();
    Sound.sfx.compra();
    irPainel('> PIN alterado.');
  }

  function irPainel(mensagem = '') {
    confirmarApagarAte = 0;
    $('painel-msg').textContent = mensagem;
    $('painel-msg').className = 'green';
    renderPainel();
    setEstado('painel', 'screen-panel');
  }

  function salvarAjustes() {
    ajustes.salvar({
      modoFixo: CONFIG.modoFixo,
      som: Sound.ligado,
      volume: Sound.volume,
      efeitosReduzidos: CONFIG.efeitosReduzidos,
      pinHash: CONFIG.pinHash,
    });
  }

  function renderPainel() {
    const lista = ranking.carregar();
    const media = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : 0);
    // o ranking já vem ordenado: o primeiro de cada modo é o vencedor daquele modo
    const melhor = (m: ModoId) => {
      const r = lista.find(x => x.modo === m);
      return r ? `${r.nick} · ${r.pontos}` : '—';
    };
    const contagem: Record<string, number> = {};
    lista.forEach(r =>
      r.conquistas.forEach(c => {
        contagem[c] = (contagem[c] || 0) + 1;
      }),
    );
    const populares =
      Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, q]) => `${CONQUISTAS.find(c => c.id === id)?.nome ?? id} (${q})`)
        .join(', ') || '—';
    const qtdModo = (m: ModoId) => lista.filter(r => r.modo === m).length;
    trocar(
      $('painel-stats'),
      linhaStat('partidas jogadas', `${lista.length} (normal ${qtdModo('normal')} · rápido ${qtdModo('rapido')})`),
      linhaStat('vitórias', lista.filter(r => r.venceu).length),
      linhaStat('velocidade média', `${media(lista.map(r => r.ppm))} ppm`),
      linhaStat('precisão média', `${media(lista.map(r => r.precisao))}%`),
      linhaStat('líder do normal', melhor('normal')),
      linhaStat('líder do rápido', melhor('rapido')),
      linhaStat('conquistas mais comuns', populares),
    );
    const nomeModoFixo = CONFIG.modoFixo
      ? { normal: 'SEMPRE NORMAL', rapido: 'SEMPRE RÁPIDO' }[CONFIG.modoFixo]
      : 'O JOGADOR ESCOLHE';
    const opcao = (tecla: string, ...conteudo: Filho[]) => h('div', null, `[${tecla}] `, ...conteudo);
    trocar(
      $('painel-menu'),
      opcao('1', 'Modo de jogo: ', h('b', null, nomeModoFixo)),
      opcao(
        '2',
        'Som: ',
        h('b', null, Sound.ligado ? 'LIGADO' : 'DESLIGADO'),
        '   [3] Volume: ',
        h('b', null, `${Math.round(Sound.volume * 100)}%`),
      ),
      opcao('4', 'Exportar ranking (planilha CSV para o Excel)'),
      opcao('5', h('span', { class: 'red' }, 'Apagar o ranking'), ' (aperte 2 vezes)'),
      opcao(
        '6',
        'Efeitos de tela (tremor/piscar): ',
        h('b', null, CONFIG.efeitosReduzidos ? 'REDUZIDOS' : 'NORMAIS'),
        '   [7] Trocar PIN',
      ),
      opcao('ESC', 'Voltar ao jogo'),
    );
  }

  function exportarCsv(): Promise<string> {
    const csv = gerarCsv(ranking.carregar());
    const nome = nomeArquivoCsv();
    if (noApp()) return salvarCsvNoApp(nome, csv);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: nome });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return Promise.resolve(`${nome} (pasta Downloads)`);
  }

  function aplicarEfeitosReduzidos() {
    FX.definirReduzido(CONFIG.efeitosReduzidos);
    document.documentElement.classList.toggle('efeitos-reduzidos', CONFIG.efeitosReduzidos);
  }

  function teclaPainel(k: string) {
    const msg = $('painel-msg');
    msg.className = 'green';
    if (k === '1') {
      const ordem: (ModoId | null)[] = [null, 'normal', 'rapido'];
      CONFIG.modoFixo = ordem[(ordem.indexOf(CONFIG.modoFixo) + 1) % ordem.length];
      salvarAjustes();
      msg.textContent = '> modo de jogo alterado.';
    } else if (k === '2') {
      Sound.alternar();
      salvarAjustes();
      msg.textContent = `> som ${Sound.ligado ? 'ligado' : 'desligado'}.`;
    } else if (k === '3') {
      const i = (VOLUMES as readonly number[]).indexOf(Sound.volume);
      Sound.definirVolume(VOLUMES[(i + 1) % VOLUMES.length]);
      salvarAjustes();
      Sound.sfx.selecao();
      msg.textContent = `> volume em ${Math.round(Sound.volume * 100)}%.`;
    } else if (k === '4') {
      msg.textContent = '> exportando...';
      exportarCsv().then(
        onde => {
          msg.textContent = `> ranking exportado: ${onde}.`;
        },
        err => {
          msg.className = 'red';
          msg.textContent = `> não foi possível exportar: ${err}`;
        },
      );
    } else if (k === '5') {
      if (agora() < confirmarApagarAte) {
        ranking.limpar();
        fantasmas.limpar(); // o recordista apagado também deixa de ser o fantasma
        confirmarApagarAte = 0;
        msg.textContent = '> ranking apagado.';
      } else {
        confirmarApagarAte = agora() + 5000;
        msg.className = 'red';
        msg.textContent = '> tem certeza? aperte 5 de novo em até 5 segundos para APAGAR TUDO.';
        return;
      }
    } else if (k === '6') {
      CONFIG.efeitosReduzidos = !CONFIG.efeitosReduzidos;
      aplicarEfeitosReduzidos();
      salvarAjustes();
      msg.textContent = `> efeitos de tela ${CONFIG.efeitosReduzidos ? 'reduzidos' : 'normais'}.`;
    } else if (k === '7') {
      telaPin(true);
      return;
    } else return;
    renderPainel();
  }

  // ================= HUD (chamado todo quadro) =================
  // Só mexe no DOM quando o conteúdo muda (a chave em cacheHud)
  function definir(id: string, chave: string, montar: () => Filho = () => chave) {
    if (cacheHud[id] === chave) return;
    cacheHud[id] = chave;
    trocar($(id), montar());
  }

  function atualizarHud() {
    const r = battle.run,
      b = battle.estado;
    if (!r || !b || $('hud').classList.contains('hidden')) return;
    const p = r.p;
    definir('hud-nick', `@${r.nick}`);
    definir('hud-andar', `${rotuloAndar()} · ${b.A.nome}`);
    definir('hud-score', `PTS ${pad(r.pontos, 6)}`);
    definir('hud-cred', `${p.creditos} ₿`);
    const hpProp = Math.max(0, p.hp / p.maxHp);
    definir('hp-text', `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`);
    const w = (hpProp * 100).toFixed(1) + '%';
    if (cacheHud.hpw !== w) {
      cacheHud.hpw = w;
      const fill = $('hp-fill');
      fill.style.width = w;
      fill.classList.toggle('baixo', hpProp < 0.3);
    }

    const status: [string, string][] = [];
    if (b.escudo > 0) status.push(['cyan', `[#] escudo x${b.escudo}`]);
    if (b.lento > 0) status.push(['amber', `c[_] café ${Math.ceil(b.lento)}s`]);
    if (p.reviver > 0) status.push(['pink', '^^^ backup']);
    if (b.overdrive) status.push(['pink overdrive', '⚡ OVERDRIVE']);
    if (b.elite) status.push(['gold', '★ ELITE']);
    definir('hud-status', JSON.stringify(status), () =>
      status.map(([cls, txt], i) => [i ? ' ' : '', h('span', { class: cls }, txt)]),
    );

    // velocidade ao vivo e o fantasma (recordista do modo, ou o jogador 1 no duelo)
    const tempo = r.stats.tempo;
    const ppm = tempo > 5 ? Math.round(r.stats.acertos / 5 / (tempo / 60)) : 0;
    let linhaFantasma = '';
    let classeFantasma = '';
    if (fantasma) {
      const delta = r.pontos - fantasmas.pontosNoMomento(fantasma, tempo, PASSO_TRILHA);
      linhaFantasma = `👻 ${fantasma.nick}: ${delta >= 0 ? '+' : ''}${delta}`;
      classeFantasma = delta >= 0 ? 'green' : 'red';
    }
    definir('hud-extra', `${ppm}|${linhaFantasma}|${classeFantasma}`, () => [
      h('div', null, `PPM ${ppm}`),
      linhaFantasma ? h('div', { class: `fantasma ${classeFantasma}` }, linhaFantasma) : null,
    ]);

    const mult = Math.round(Math.min(b.combo, BAL.comboMax) * BAL.comboPasso * 100);
    definir('hud-combo', b.combo > 1 ? `${b.combo}|${mult}` : '', () =>
      b.combo > 1 ? [`COMBO x${b.combo}`, h('small', null, `dano +${mult}%`)] : null,
    );
    $('hud-combo').classList.toggle('quente', b.combo >= 10);

    definir('items', ITENS.map(it => r.inventario[it.id]).join(','), () =>
      ITENS.map((it, i) => {
        const q = r.inventario[it.id];
        return h(
          'span',
          { class: `slot ${q ? '' : 'vazio'}` },
          h('b', null, i + 1),
          ` ${it.icone} ${it.nome} `,
          h('i', null, `x${q}`),
        );
      }),
    );

    // prompt de digitação
    const pr = battle.prompt();
    // a máscara esconde letras que ainda não chegaram (░) ou estão cifradas (*)
    const visto = pr?.mascara ?? pr?.texto ?? '';
    const chave = pr ? `${visto}|${pr.dig}|${pr.ativo}` : '';
    if (chave !== cachePrompt) {
      cachePrompt = chave;
      const el = $('prompt-text');
      if (!pr || !pr.texto) {
        trocar(el, h('span', { class: 'dica' }, 'digite a palavra de um inimigo...'));
      } else {
        const prox = visto[pr.dig] === ' ' ? '␣' : visto[pr.dig] || '';
        trocar(
          el,
          h('span', { class: 'feito' }, visto.slice(0, pr.dig)),
          h('span', { class: 'prox' }, prox),
          h('span', { class: 'resto' }, visto.slice(pr.dig + 1)),
        );
      }
      $('prompt').classList.toggle('inativo', !!pr && !pr.ativo);
    }
  }

  function logLinha(msg: string, cor?: string) {
    const box = $('log');
    box.append(h('div', cor ? { style: { color: cor } } : null, msg));
    while (box.children.length > 4) box.firstChild?.remove();
  }

  function piscar(cls: string) {
    const f = $('flash');
    f.className = '';
    void f.offsetWidth;
    f.className = cls;
  }

  battle.on('log', logLinha);
  battle.on('erro', () => {
    const pr = $('prompt');
    pr.classList.remove('erro');
    void pr.offsetWidth;
    pr.classList.add('erro');
  });
  battle.on('dano', () => piscar('dano'));
  battle.on('chefeDerrotado', () => piscar('branco'));

  document
    .querySelectorAll<HTMLElement>('.modo')
    .forEach(el => el.addEventListener('click', () => escolherModo(el.dataset.modo as ModoId)));

  // ================= INATIVIDADE =================
  // Se um visitante abandona o jogo num menu, o jogo encerra sozinho
  // (a pontuação é salva) e volta ao título para a próxima pessoa.
  function atividade() {
    ultimaAtividade = performance.now();
  }
  setInterval(() => {
    if (performance.now() - ultimaAtividade < CONFIG.ociosoSeg * 1000) return;
    if (MENUS_SEM_PARTIDA.includes(estado)) {
      atividade();
      irTitulo();
    } else if (MENUS_DA_PARTIDA.includes(estado)) {
      atividade();
      desistir();
    }
  }, 1000);

  // ================= TECLADO (menus) =================
  // O que cada tecla faz em cada tela. A batalha e o banner são tratados antes.
  const TECLAS: Partial<Record<Estado, (k: string, e: KeyboardEvent) => void>> = {
    titulo: (k, e) => {
      if (e.ctrlKey && e.shiftKey && (k === 'O' || k === 'o')) {
        e.preventDefault();
        telaPin(false);
      } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        irNick();
      }
    },
    nick: (k, e) => {
      if (k === 'Enter') {
        e.preventDefault();
        confirmarNick();
      } else if (k === 'Escape') irTitulo();
    },
    modo: k => {
      if (k === '1') escolherModo('normal');
      else if (k === '2') escolherModo('rapido');
      else if (k === '3') escolherModo('duelo');
      else if (k === 'Escape') irTitulo();
    },
    tutorial: (k, e) => {
      if (k === 'Enter') {
        e.preventDefault();
        iniciarAndar();
      }
    },
    concluido: k => k === 'Enter' && irUpgrade(),
    upgrade: k => {
      if (/^[1-3]$/.test(k)) escolherCarta(+k - 1);
      else if (k === 'r' || k === 'R') rerrolarCartas();
    },
    rota: k => teclaRota(k),
    loja: k => {
      if (/^[1-4]$/.test(k)) comprar(+k - 1);
      else if (k === 'Enter') proximoAndar();
    },
    pausa: k => {
      if (k === '1' || k === 'Escape') continuar();
      else if (k === '2') {
        Sound.alternar();
        $('pause-sound').textContent = textoSomPausa();
      } else if (k === '3') desistir();
    },
    fim: k => k === 'Enter' && depoisDoFim(),
    duelo: k => (k === 'Enter' || k === 'Escape') && irTitulo(),
    relatorio: k => k === 'Enter' && irRanking(),
    ranking: k => (k === 'Enter' || k === 'Escape') && irTitulo(),
    pin: (k, e) => {
      if (k === 'Enter') {
        e.preventDefault();
        confirmarPin();
      } else if (k === 'Escape') irTitulo();
    },
    novoPin: (k, e) => {
      if (k === 'Enter') {
        e.preventDefault();
        salvarNovoPin();
      } else if (k === 'Escape') irPainel();
    },
    painel: k => (k === 'Escape' ? irTitulo() : teclaPainel(k)),
  };

  function tecla(e: KeyboardEvent) {
    const k = e.key;
    // Tecla SEGURADA: o teclado repete o evento ~30x por segundo. Nenhuma ação de menu,
    // item ou pausa pode repetir (antes, segurar o 5 no painel confirmava sozinho e
    // apagava o ranking — AUD-05). Letras seguradas continuam digitando normalmente.
    const repetida = e.repeat;
    atividade();
    if (estado === 'carregando') {
      e.preventDefault();
      return;
    }
    if (estado === 'batalha') {
      if (k === 'Escape') {
        e.preventDefault();
        if (!repetida) pausar();
      } else if (k === 'Backspace') {
        e.preventDefault();
        battle.soltarAlvo();
      } else if (/^[1-4]$/.test(k)) {
        e.preventDefault();
        if (!repetida) battle.usarItem(+k - 1);
      }
      return;
    }
    if (estado === 'banner') {
      if (k.length === 1 || k === 'Enter') e.preventDefault();
      return;
    }
    if (travado() || repetida) {
      if (k === 'Enter') e.preventDefault();
      return;
    }
    TECLAS[estado]?.(k, e);
    if (k === 'Enter') e.preventDefault();
  }

  // Atalhos de desenvolvimento:
  //   ?andar=5          começa direto no andar 5
  //   ?andar=5&chefe=1  começa direto no chefão do andar 5
  function inicioDebug(andar: number, chefe?: boolean) {
    Sound.init();
    limparConquistas();
    battle.novaPartida('DEV', 'normal', { semente: sementeUrl() });
    run().debug = true;
    battle.irParaAndar(andar - 1);
    run().p.creditos = 200;
    estado = 'carregando'; // atalho de desenvolvimento: pode começar de qualquer tela
    iniciarAndar();
    if (chefe) battle.estado!.restante = 0;
  }

  aplicarEfeitosReduzidos();

  return {
    irTitulo,
    tecla,
    focar,
    atualizarHud,
    inicioDebug,
    atividade,
    aplicarEfeitosReduzidos,
    gerarCsv: () => gerarCsv(ranking.carregar()),
    get estado() {
      return estado;
    },
    mostraBatalha: () => MOSTRA_BATALHA.includes(estado),
  };
}

// ?semente=N fixa a aleatoriedade da partida (bugs reproduzíveis e testes)
function sementeUrl(): number | undefined {
  const s = new URLSearchParams(location.search).get('semente');
  return s != null && /^\d+$/.test(s) ? Number(s) : undefined;
}

export type UI = ReturnType<typeof criarUI>;
