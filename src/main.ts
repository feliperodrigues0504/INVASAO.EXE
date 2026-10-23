// =====================================================================
//  Inicialização: loop principal, escala da tela e captura do teclado.
// =====================================================================

import './styles/style.css';
import { Sound } from './audio/sound';
import { CONFIG } from './config';
import { ANDARES, BAL, CONQUISTAS, ITENS, MODOS, UPGRADES } from './content';
import { ALTURA, Battle, LARGURA } from './game/battle';
import { criarRng } from './game/rng';
import { desenharBatalha } from './render/battleRenderer';
import { ligarEfeitos } from './render/efeitosBatalha';
import { FONTE, FX } from './render/fx';
import { sprite } from './render/sprites';
import { CHAVE_AJUSTES, criarAjustes } from './storage/ajustes';
import { armazenamentoLocal } from './storage/armazenamento';
import { espelharEmArquivo, noApp, restaurarBackups } from './storage/backup';
import { validarNick } from './storage/nick';
import { CHAVE_RANKING, criarRanking } from './storage/ranking';
import { criarUI } from './ui/ui';
import type { InvasaoGlobal } from './debug';

const params = new URLSearchParams(location.search);
const semente = /^\d+$/.test(params.get('semente') ?? '') ? Number(params.get('semente')) : null;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const canvasTexto = document.getElementById('canvas-texto') as HTMLCanvasElement;
const ctxTexto = canvasTexto.getContext('2d')!;
const jogo = document.getElementById('game')!;
const entrada = document.getElementById('type-input') as HTMLInputElement;

// ---------------- dados salvos ----------------
await restaurarBackups([CHAVE_RANKING, CHAVE_AJUSTES]); // só no app de desktop
const armazenamento = armazenamentoLocal(espelharEmArquivo);
const ranking = criarRanking(armazenamento);
const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ajustes = criarAjustes(armazenamento, { efeitosReduzidos: reduzirMovimento });
{
  const a = ajustes.carregar();
  CONFIG.modoFixo = a.modoFixo;
  CONFIG.efeitosReduzidos = a.efeitosReduzidos;
  CONFIG.pinHash = a.pinHash;
  Sound.definirLigado(a.som);
  Sound.definirVolume(a.volume);
}

const battle = new Battle();
ligarEfeitos(battle);
const UI = criarUI({ battle, ranking, ajustes, config: CONFIG });

// ---------------- escala para caber em qualquer tela ----------------
// O jogo é desenhado em 960x540 "lógicos" e ampliado por CSS (pixel art com
// pixels duros). Os TEXTOS do canvas (palavras, números de dano, falas) vão
// para uma segunda camada na resolução REAL da tela, para ficarem nítidos em
// Full HD/4K. Só o texto paga o custo da resolução alta: em PCs sem GPU,
// desenhar o quadro inteiro em 1920x1080 custava 3x mais.
let escala = 1;
let txt = ctx; // em 960x540 (escala 1) as duas camadas são a mesma
function redimensionar() {
  const s = Math.min(window.innerWidth / LARGURA, window.innerHeight / ALTURA);
  jogo.style.transform = `translate(-50%, -50%) scale(${s})`;
  escala = Math.min(3, Math.max(1, s * (window.devicePixelRatio || 1)));
  canvasTexto.width = Math.round(LARGURA * escala);
  canvasTexto.height = Math.round(ALTURA * escala);
  canvasTexto.hidden = escala === 1;
  txt = escala === 1 ? ctx : ctxTexto;
}
window.addEventListener('resize', redimensionar);
redimensionar();

// ---------------- digitação na batalha ----------------
// Lemos o texto de um <input> escondido (e não tecla por tecla) para que
// os acentos do teclado ABNT2 (´ ~ ^ ` + letra) funcionem corretamente.
function processarEntrada() {
  const valor = entrada.value;
  entrada.value = '';
  if (UI.estado !== 'batalha') return;
  for (const ch of valor.normalize('NFC')) battle.digitar(ch);
}
entrada.addEventListener('input', e => {
  if (!(e as InputEvent).isComposing) processarEntrada();
});
entrada.addEventListener('compositionend', processarEntrada);
// colar ou arrastar texto seria trapaça
entrada.addEventListener('paste', e => e.preventDefault());
entrada.addEventListener('drop', e => e.preventDefault());

document.addEventListener('keydown', e => {
  if (e.key === 'Tab') e.preventDefault();
  UI.tecla(e);
});

// mantém o foco no campo certo (cliques fora, alt+tab etc.)
document.addEventListener('mousedown', e => {
  Sound.init();
  UI.atividade();
  if (!(e.target as Element).closest('.card, .shop-item, .modo')) {
    e.preventDefault();
    UI.focar();
  }
});
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('focus', () => UI.focar());
entrada.addEventListener('blur', () =>
  setTimeout(() => {
    if (UI.estado !== 'nick') UI.focar();
  }, 0),
);

// ---------------- loop ----------------
// A simulação anda em passos FIXOS de 1/60 s, não importa o fps da máquina:
// o jogo se comporta igual num notebook fraco e num PC gamer.
const PASSO = 1 / 60;
const MAX_PASSOS = 15; // se a máquina engasgar, não tenta "recuperar" segundos inteiros

function atualizar(dt: number) {
  FX.atualizar(dt);
  if (UI.estado === 'batalha') battle.atualizar(dt);
}

function desenhar(t: number) {
  const b = battle.estado;
  const naBatalha = UI.mostraBatalha() && !!b;
  FX.desenharFundo(ctx, naBatalha ? b!.A.cores[0] : '#39ff14', t, naBatalha);
  if (txt !== ctx) {
    txt.setTransform(1, 0, 0, 1, 0, 0);
    txt.clearRect(0, 0, canvasTexto.width, canvasTexto.height);
    txt.setTransform(escala, 0, 0, escala, 0, 0);
  }
  if (naBatalha) {
    // o tremor de tela vale para as duas camadas
    const o = FX.offset();
    ctx.save();
    ctx.translate(o.x, o.y);
    txt.save();
    if (txt !== ctx) txt.translate(o.x, o.y);
    desenharBatalha(ctx, battle, t, txt);
    FX.desenharEfeitos(ctx, txt);
    txt.restore();
    ctx.restore();
  }
  UI.atualizarHud();
}

// Um quadro completo (os testes chamam direto para ver qualquer erro)
function quadro(dt: number, t: number) {
  atualizar(dt);
  desenhar(t);
}

// ?render=N (testes do robô): desenha só 1 a cada N quadros. A simulação continua
// completa; partidas inteiras de 10 min rodam bem mais rápido no navegador de testes.
const DESENHAR_A_CADA = Math.max(1, Math.floor(Number(params.get('render'))) || 1);
let ultimo = performance.now();
let acumulado = 0;
let quadros = 0;
function loop(agora: number) {
  acumulado += Math.min(0.25, Math.max(0, (agora - ultimo) / 1000));
  ultimo = agora;
  try {
    let passos = 0;
    while (acumulado >= PASSO && passos < MAX_PASSOS) {
      atualizar(PASSO);
      acumulado -= PASSO;
      passos++;
    }
    if (passos === MAX_PASSOS) acumulado = 0;
    if (++quadros % DESENHAR_A_CADA === 0) desenhar(agora / 1000);
  } catch (err) {
    // nunca deixar o jogo congelar no meio do evento
    console.error(err);
  }
  requestAnimationFrame(loop);
}

// Ferramentas para quem estiver cuidando do estande (abra o console com F12):
//   INVASAO.limparRanking()   -> apaga o ranking
//   INVASAO.exportarRanking() -> mostra o ranking em formato de tabela
// O restante (battle, ui...) é usado pelos testes automatizados (tests/e2e).
window.INVASAO = {
  limparRanking: () => {
    ranking.limpar();
    UI.irTitulo();
    return 'ranking apagado';
  },
  exportarRanking: () => console.table(ranking.carregar()),
  battle,
  ui: UI,
  ranking,
  ajustes,
  config: CONFIG,
  sound: Sound,
  fx: FX,
  conteudo: { ANDARES, BAL, CONQUISTAS, ITENS, MODOS, UPGRADES },
  sprite,
  validarNick,
  quadro,
  ctx,
  FONTE,
  noApp: noApp(),
  escala: () => escala,
} satisfies InvasaoGlobal;

// ?bot=1 (ou ?bot=ms) -> um robô joga sozinho, para testar o jogo.
// ?parar=loja faz o robô parar quando chegar naquela tela.
// ?modo=2 faz o robô escolher o modo rápido.
function iniciarBot() {
  const parar = params.get('parar');
  const teclaModo = params.get('modo') === '2' ? '2' : '1';
  const rnd = criarRng(semente ?? 1);
  if (parar) CONFIG.voltarTituloSeg = CONFIG.ociosoSeg = 99999;
  let espera = 0;
  const tecla = (key: string, extra: KeyboardEventInit = {}) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
  const intervalo = Number(params.get('bot')) > 1 ? Number(params.get('bot')) : 110;
  setInterval(() => {
    const est = UI.estado,
      b = battle.estado;
    if (est === parar) return;
    if (est === 'batalha' && b) {
      const alvo = b.alvo || b.inimigos.find(e => !e.morrendo);
      if (alvo) battle.digitar(rnd() < 0.05 ? 'x' : alvo.texto[alvo.dig]);
      return;
    }
    if (++espera < 12) return;
    espera = 0;
    const input = (id: string) => document.getElementById(id) as HTMLInputElement;
    // ?parar=painel: o robô abre o painel do organizador (para a screenshot)
    if (parar === 'painel' && est === 'titulo') tecla('O', { ctrlKey: true, shiftKey: true });
    else if (est === 'pin') {
      input('pin-input').value = CONFIG.pinPadrao;
      tecla('Enter');
    } else if (est === 'modo') tecla(teclaModo);
    else if (est === 'upgrade') tecla('1');
    else if (est === 'loja') tecla(battle.run!.inventario.cafe < 1 ? '1' : 'Enter');
    // nick de 30 caracteres (o máximo) para validar o layout no pior caso
    else if (est === 'nick') {
      input('nick-input').value = 'Robô Testador da Computação ' + (10 + Math.floor(rnd() * 90));
      tecla('Enter');
    } else if (['titulo', 'tutorial', 'concluido', 'fim', 'relatorio', 'ranking'].includes(est)) tecla('Enter');
  }, intervalo);
}

function iniciar() {
  const andar = Number(params.get('andar'));
  if (andar >= 1 && andar <= ANDARES.length) UI.inicioDebug(andar, !!params.get('chefe'));
  else UI.irTitulo();
  requestAnimationFrame(loop);
  if (params.get('bot')) iniciarBot();
  document.documentElement.dataset.pronto = '1'; // sinal para os testes automatizados
}

// espera as fontes carregarem (com limite, caso algo dê errado)
await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]);
iniciar();
