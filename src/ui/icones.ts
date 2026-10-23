// Ícones em pixel art no HTML: troca ⚠ ★ ⚡ 👻 🏆... por <img> desenhadas
// a partir de content/icones.ts (mesmo estilo dos sprites do jogo).

import { EMOJI_PARA_ICONE } from '../content/icones';
import { sprite } from '../render/sprites';
import { h, type Filho } from './dom';

const cache = new Map<string, string>();

export function icone(nome: string, escala = 2): HTMLImageElement {
  const chave = `${nome}|${escala}`;
  let url = cache.get(chave);
  if (!url) {
    url = (sprite(nome, escala).canvas as HTMLCanvasElement).toDataURL();
    cache.set(chave, url);
  }
  return h('img', {
    src: url,
    class: 'icone-px',
    'data-icone': nome,
    alt: '',
    'aria-hidden': 'true',
    width: 8 * escala,
    height: 8 * escala,
  });
}

const SIMBOLOS = new RegExp(`(${Object.keys(EMOJI_PARA_ICONE).join('|')})`, 'u');

// "★ CONQUISTA" → [<img estrela>, " CONQUISTA"] (escala maior para títulos grandes)
export function comIcones(texto: string, escala = 2): Filho[] {
  return texto
    .split(SIMBOLOS)
    .filter(Boolean)
    .map(parte => (parte in EMOJI_PARA_ICONE ? icone(EMOJI_PARA_ICONE[parte], escala) : parte));
}

// Troca os símbolos do HTML estático (tutorial etc.) uma vez, na inicialização
export function hidratarIcones(raiz: HTMLElement) {
  const caminhante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const alvos: Text[] = [];
  for (let n = caminhante.nextNode(); n; n = caminhante.nextNode())
    if (SIMBOLOS.test(n.nodeValue ?? '')) alvos.push(n as Text);
  for (const t of alvos)
    t.replaceWith(...comIcones(t.nodeValue ?? '').map(p => (typeof p === 'string' ? p : (p as Node))));
}
