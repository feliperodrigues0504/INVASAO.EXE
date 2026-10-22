// =====================================================================
//  Construtor de DOM seguro. Todo texto vira um nó de TEXTO, nunca HTML:
//  um nick como "<img onerror=...>" aparece na tela exatamente assim,
//  sem precisar lembrar de escapar nada (o antigo innerHTML + esc()).
// =====================================================================

export type Filho = Node | string | number | null | undefined | false | Filho[];

type Atributos = {
  class?: string;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  data?: Record<string, string | number>;
  onClick?: (ev: MouseEvent) => void;
  [atributo: string]: unknown;
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento #${id} não existe no index.html`);
  return el as T;
};

function nos(filhos: Filho[]): Node[] {
  const saida: Node[] = [];
  for (const f of filhos) {
    if (f == null || f === false) continue;
    if (Array.isArray(f)) saida.push(...nos(f));
    else if (f instanceof Node) saida.push(f);
    else saida.push(document.createTextNode(String(f)));
  }
  return saida;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos?: Atributos | null,
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') {
      for (const [prop, valor] of Object.entries(v as Record<string, string>)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, valor);
        else (el.style as unknown as Record<string, string>)[prop] = valor;
      }
    } else if (k === 'data') {
      for (const [d, valor] of Object.entries(v as Record<string, string | number>)) el.dataset[d] = String(valor);
    } else if (k === 'onClick') el.addEventListener('click', v as (ev: Event) => void);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  el.append(...nos(filhos));
  return el;
}

// Troca todo o conteúdo de um elemento
export function trocar(el: HTMLElement, ...filhos: Filho[]): void {
  el.replaceChildren(...nos(filhos));
}

// Linhas "rótulo: valor" usadas nas telas de estatísticas
export const linhaStat = (rotulo: string, valor: Filho, classeValor?: string) =>
  h('div', null, h('span', null, rotulo), h('b', classeValor ? { class: classeValor } : null, valor));

// Reinicia uma animação CSS (forçando o navegador a recalcular o estilo)
export function reiniciarAnimacao(el: HTMLElement, aplicar?: () => void): void {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  aplicar?.();
}
