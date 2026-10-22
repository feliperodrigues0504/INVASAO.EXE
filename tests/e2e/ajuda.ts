// =====================================================================
//  Base dos testes E2E. Cada teste:
//   - abre o build (dist/index.html) via file://, como no evento;
//   - BLOQUEIA toda a rede e falha se o jogo tentar acessar a internet;
//   - falha se aparecer qualquer erro no console do navegador;
//   - usa um relógio falso (page.clock): os 3,6 s do banner ou os 25 s da
//     tela de fim passam instantaneamente, e o resultado é determinístico.
// =====================================================================

import { test as base, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InvasaoGlobal } from '../../src/debug';

export const URL_JOGO = pathToFileURL(path.resolve('dist/index.html')).href;
export const NICK30 = 'Hacker Supremo da Computação 1';
export const ALTURA = 540;
export const LARGURA = 960;
const INICIO = new Date('2026-10-17T09:00:00-03:00'); // dia do evento (data fixa = testes reproduzíveis)

export class Jogo {
  readonly erros: string[] = [];
  permitirErros = false; // para testes em que o erro é o esperado
  constructor(
    readonly page: Page,
    readonly relogio: boolean,
  ) {}

  async abrir(query = '') {
    await this.page.goto(URL_JOGO + query);
    // o relógio é falso: avança em passos até o jogo terminar de iniciar (fontes etc.)
    await expect
      .poll(
        async () => {
          await this.avancar(100);
          return this.page.evaluate(() => document.documentElement.dataset.pronto);
        },
        { timeout: 15_000, intervals: [50] },
      )
      .toBe('1');
  }

  // avança o relógio quadro a quadro: a batalha anda (inimigos, ataques, vitória...)
  avancar = (ms: number) => this.page.clock.runFor(ms);
  // salta no tempo: dispara os timers vencidos (menus, banner, inatividade) sem simular cada quadro
  pular = (ms: number) => this.page.clock.fastForward(ms);

  // executa uma função no navegador com acesso a window.INVASAO
  eval<R, A = undefined>(fn: (j: InvasaoGlobal, arg: A) => R, arg?: A): Promise<R> {
    return this.page.evaluate(([f, a]) => new Function('j', 'a', `return (${f})(j, a)`)(window.INVASAO, a) as R, [
      fn.toString(),
      arg,
    ] as const);
  }

  estado = () => this.eval(j => j.ui.estado);
  tecla = (k: string) => this.page.keyboard.press(k);
  ctrlShiftO = () => this.page.keyboard.press('Control+Shift+O');

  // espera a "trava" anti-ENTER-duplo de cada tela (600 ms) e aperta
  async teclaDepois(k: string, ms = 700) {
    await this.pular(ms);
    await this.tecla(k);
  }

  async preencher(id: 'nick-input' | 'pin-input', valor: string) {
    await this.page.evaluate(([i, v]) => ((document.getElementById(i) as HTMLInputElement).value = v), [id, valor]);
  }

  // título → nick → modo → tutorial → banner → batalha
  async entrarNaBatalha(nick = 'Visitante', modo: '1' | '2' = '1') {
    await this.eval(j => j.ui.irTitulo());
    await this.teclaDepois('Enter');
    await this.pular(700);
    await this.preencher('nick-input', nick);
    await this.tecla('Enter');
    if ((await this.estado()) === 'modo') await this.teclaDepois(modo);
    await this.teclaDepois('Enter');
    await this.pular(3800);
    expect(await this.estado()).toBe('batalha');
  }

  // começa direto num andar (atalho ?andar=N), já na batalha
  async debug(andar: number, chefe = false) {
    await this.eval((j, a) => j.ui.inicioDebug(a.andar, a.chefe), { andar, chefe });
    await this.pular(3800);
  }

  async forcarFimDoAndar(etapa: 'vitoria' | 'morte' = 'vitoria') {
    await this.eval((j, e) => Object.assign(j.battle.estado!, { etapa: e, tempoEtapa: 0, avisou: false }), etapa);
    await this.avancar(3000);
  }

  // confere que um elemento está inteiro dentro da tela de 960x540
  async cabeNaTela(seletor: string) {
    const caixa = await this.page.evaluate(s => {
      const el = document.querySelector(s) as HTMLElement;
      return { topo: el.offsetTop, base: el.offsetTop + el.offsetHeight };
    }, seletor);
    expect(caixa.topo, `${seletor} começa acima da tela`).toBeGreaterThanOrEqual(0);
    expect(caixa.base, `${seletor} termina abaixo da tela`).toBeLessThanOrEqual(ALTURA);
  }
}

export const test = base.extend<{ jogo: Jogo; relogio: boolean }>({
  relogio: [true, { option: true }],
  jogo: async ({ page, relogio }, use) => {
    const jogo = new Jogo(page, relogio);
    page.on('console', m => {
      if (m.type() === 'error') jogo.erros.push(`console: ${m.text()}`);
    });
    page.on('pageerror', e => jogo.erros.push(`pageerror: ${e.message}`));
    // o jogo precisa funcionar 100% offline: qualquer acesso à rede é um erro
    await page.route(
      url => !['file:', 'data:', 'blob:'].includes(url.protocol),
      route => {
        jogo.erros.push(`acesso à rede: ${route.request().url()}`);
        return route.abort();
      },
    );
    if (relogio) {
      // relógio parado: o tempo do jogo só anda quando o teste mandar (vale também após recarregar)
      await page.clock.install({ time: INICIO });
      await page.clock.pauseAt(new Date(INICIO.getTime() + 5_000));
    }
    await use(jogo);
    if (!jogo.permitirErros) expect(jogo.erros, 'erros durante o teste').toEqual([]);
  },
});

export { expect };
