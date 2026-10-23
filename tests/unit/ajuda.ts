// Utilitários compartilhados pelos testes de unidade (rodam no Node, sem navegador)

import { Battle, type EventosBatalha, type Jogador } from '../../src/game/battle';
import { definirFabricaCanvas } from '../../src/render/sprites';

// ---------------------------------------------------------------------
//  Canvas falso: aceita qualquer chamada de desenho e FALHA se alguma
//  coordenada vier NaN/Infinity (pega erros de conta no render).
// ---------------------------------------------------------------------
const METODOS_COM_NUMEROS = new Set([
  'fillRect',
  'strokeRect',
  'drawImage',
  'fillText',
  'moveTo',
  'lineTo',
  'ellipse',
  'translate',
  'setTransform',
]);

export function criarCtxFalso() {
  const contagem: Record<string, number> = {};
  const gradiente = { addColorStop() {} };
  const base: Record<string | symbol, unknown> = {
    measureText: (t: string) => ({ width: [...t].length * 13 }),
    createLinearGradient: () => gradiente,
    createRadialGradient: () => gradiente,
    canvas: { width: 960, height: 540 },
  };
  const ctx = new Proxy(base, {
    get(alvo, prop) {
      if (prop in alvo) return alvo[prop];
      return (...args: unknown[]) => {
        const nome = String(prop);
        contagem[nome] = (contagem[nome] || 0) + 1;
        if (METODOS_COM_NUMEROS.has(nome))
          for (const a of args)
            if (typeof a === 'number' && !Number.isFinite(a))
              throw new Error(`${nome} recebeu um número inválido: ${args.join(', ')}`);
      };
    },
    set(alvo, prop, valor) {
      alvo[prop] = valor;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, contagem };
}

export function usarCanvasFalso() {
  definirFabricaCanvas((w, h) => ({ width: w, height: h, getContext: () => criarCtxFalso().ctx }) as never);
}

// ---------------------------------------------------------------------
//  Batalha de teste
// ---------------------------------------------------------------------
const EVENTOS: (keyof EventosBatalha)[] = [
  'andarConcluido',
  'gameOver',
  'alertaChefe',
  'chefeDerrotado',
  'erro',
  'dano',
  'conquista',
  'abate',
  'acerto',
];

export function novaBatalha(
  andarIdx: number,
  extraP: Partial<Jogador> = {},
  opcoes: { modo?: string; semente?: number } = {},
) {
  const battle = new Battle();
  const cont: Record<string, number> = {};
  EVENTOS.forEach(ev => battle.on(ev, () => (cont[ev] = (cont[ev] || 0) + 1)));
  const run = battle.novaPartida('teste', opcoes.modo ?? 'normal', { semente: opcoes.semente ?? 12345 });
  run.debug = true;
  battle.irParaAndar(andarIdx);
  Object.assign(run.p, extraP);
  battle.iniciarAndar();

  const b = () => battle.estado!;
  const vivos = () => b().inimigos.filter(e => !e.morrendo);
  const n = (ev: keyof EventosBatalha) => cont[ev] || 0;
  const zerar = () => Object.keys(cont).forEach(k => (cont[k] = 0));
  const simular = (seg: number, parar?: () => boolean) => {
    for (let t = 0; t < seg; t += 0.05) {
      battle.atualizar(0.05);
      if (parar?.()) return true;
    }
    return false;
  };
  const ateInimigos = (q: number) => simular(15, () => vivos().length >= q && vivos().every(e => e.nascendo <= 0));
  const digitar = (s: string) => {
    for (const ch of s) battle.digitar(ch);
  };
  // pula a onda: remove quem estiver vivo e espera o chefão terminar de aparecer
  const ateChefe = () => {
    b().restante = 0;
    b().inimigos.forEach(e => (e.morrendo = true));
    return simular(8, () => !!b().chefe && b().chefe!.nascendo <= 0);
  };
  // um "jogador perfeito": digita sempre a letra certa do alvo atual
  const botTecla = () => {
    const est = b();
    if (est.etapa !== 'ondas' && est.etapa !== 'chefe') return;
    const alvo = est.alvo && !est.alvo.morrendo ? est.alvo : est.inimigos.find(e => !e.morrendo);
    if (alvo) battle.digitar(alvo.texto[alvo.dig]);
  };

  return { battle, run, b, vivos, n, zerar, simular, ateInimigos, digitar, ateChefe, botTecla };
}
