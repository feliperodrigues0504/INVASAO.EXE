// Robustez para o modo quiosque: visitantes que abandonam o jogo, teclas
// apertadas fora de hora, navegador sem armazenamento e "teclado esmagado".

import { expect, test } from './ajuda';

test('visitante que abandona um menu: o jogo volta sozinho (e salva a partida)', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.eval(j => (j.config.ociosoSeg = 1));
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('nick');
  await jogo.pular(2600);
  expect(await jogo.estado(), 'nick abandonado volta ao título').toBe('titulo');
  await jogo.debug(1);
  await jogo.tecla('Escape');
  expect(await jogo.estado()).toBe('pausa');
  await jogo.pular(2600);
  expect(await jogo.estado(), 'pausa abandonada encerra a partida').toBe('fim');
});

test('o ciclo fim → relatório → ranking → título anda sozinho', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.debug(1);
  await jogo.forcarFimDoAndar('morte');
  expect(await jogo.estado()).toBe('fim');
  for (const proximo of ['relatorio', 'ranking', 'titulo']) {
    await jogo.pular(25_500);
    expect(await jogo.estado()).toBe(proximo);
  }
});

test('ESPAÇO também inicia no título', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.teclaDepois(' ');
  expect(await jogo.estado()).toBe('nick');
});

test('ENTER ou número apertado duas vezes seguidas não pula telas', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.debug(1);
  await jogo.forcarFimDoAndar('morte');
  await jogo.pular(1600);
  await jogo.tecla('Enter');
  await jogo.tecla('Enter');
  expect(await jogo.estado(), 'o 2º ENTER não pula o relatório').toBe('relatorio');
  // carta escolhida com "1" duplo não compra item na loja
  await jogo.debug(1);
  await jogo.eval(j => (j.battle.run!.p.creditos = 500));
  await jogo.forcarFimDoAndar('vitoria');
  await jogo.teclaDepois('Enter', 1000);
  await jogo.teclaDepois('1');
  await jogo.pular(550); // a loja abre aos 500 ms; o "1" repetido chega logo depois
  expect(await jogo.estado()).toBe('loja');
  await jogo.tecla('1');
  expect(await jogo.eval(j => j.battle.run!.inventario.cafe), 'o "1" duplicado não comprou nada').toBe(0);
});

test('Ctrl+Shift+O é consumido (o navegador não abre os favoritos por cima do jogo)', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.pular(700);
  const consumido = await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', {
      key: 'O',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(consumido).toBe(true);
});

test('navegador sem armazenamento (anônimo/disco cheio): o jogo segue até o fim', async ({ jogo, page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('cheio', 'QuotaExceededError');
    };
    Storage.prototype.getItem = () => {
      throw new DOMException('negado', 'SecurityError');
    };
  });
  await jogo.abrir();
  expect(await jogo.estado()).toBe('titulo');
  await jogo.entrarNaBatalha('Sem Disco', '2');
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3');
  expect(await jogo.estado(), 'fim de jogo mesmo sem conseguir salvar').toBe('fim');
  await jogo.teclaDepois('Enter', 1600);
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado(), 'ranking (vazio) abre').toBe('ranking');
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  await jogo.pular(700);
  await jogo.preencher('pin-input', '2026');
  await jogo.tecla('Enter');
  await jogo.teclaDepois('1');
  await jogo.tecla('3');
  expect(await jogo.estado(), 'painel funciona sem salvar ajustes').toBe('painel');
});

test('segurança: nick com HTML adulterado no armazenamento nunca vira código na tela', async ({ jogo, page }) => {
  const ataque = '<img src=x id=xss onerror=window.__xss=1>';
  await page.addInitScript(a => {
    localStorage.setItem(
      'invasao_exe_ranking_v1',
      JSON.stringify([
        { nick: a, pontos: 50, andar: 1, total: 9, modo: 'normal', venceu: false, ppm: 1, precisao: 1, conquistas: [] },
        { nick: a, pontos: 40, andar: 1, total: 3, modo: 'rapido', venceu: false, ppm: 1, precisao: 1, conquistas: [] },
      ]),
    );
  }, ataque);
  const semInjecao = async (onde: string) => {
    const r = await page.evaluate(() => ({
      el: !!document.getElementById('xss'),
      exec: !!(window as never as { __xss?: number }).__xss,
    }));
    expect(r, `HTML injetado em: ${onde}`).toEqual({ el: false, exec: false });
  };
  await jogo.abrir();
  await semInjecao('título');
  await expect(page.locator('#title-rank-normal')).toContainText('<img');
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  await jogo.pular(700);
  await jogo.preencher('pin-input', '2026');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('painel');
  await semInjecao('painel do organizador');
  await jogo.debug(1);
  await jogo.eval(j => (j.battle.run!.debug = false));
  await jogo.forcarFimDoAndar('morte');
  await jogo.teclaDepois('Enter', 1600);
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('ranking');
  await semInjecao('ranking');
});

test('fuzz: 3000 teclas aleatórias em todas as telas sem erro, estado inválido ou trapaça', async ({ jogo }) => {
  test.setTimeout(240_000);
  await jogo.abrir();
  await jogo.eval(j => (j.config.ociosoSeg = 4)); // também exercita o vigia de inatividade
  const visitados = new Set<string>();
  let semente = 20261017;
  // As teclas são processadas em lotes de 15 dentro da página (rápido); entre os
  // lotes o relógio salta 250 ms, para os timers das telas (banner, loja...) andarem.
  for (let lote = 0; lote < 200; lote++) {
    const r = await jogo.eval(
      (j, a) => {
        const TECLAS = [
          ...'abcdefghijklmnopqrstuvwxyzáéíóúâêôãõç ,.!?:*-',
          'Enter',
          'Enter',
          'Escape',
          'Backspace',
          '1',
          '2',
          '3',
          '4',
          '5',
          '0',
          'Tab',
          'Dead',
          'Shift',
          'F5',
          'ArrowUp',
          ' ',
        ];
        const NICKS = ['Ana', 'porra', '..', 'Computação', 'x'.repeat(31), '<b>oi</b>', 'Visitante 07'];
        let s = a.semente;
        const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
        const entrada = document.getElementById('type-input') as HTMLInputElement;
        const estados: string[] = [];
        for (let k = 0; k < 15; k++) {
          const passo = a.inicio + k;
          const tecla = pick(TECLAS);
          if (j.ui.estado === 'nick' && rnd() < 0.3)
            (document.getElementById('nick-input') as HTMLInputElement).value = pick(NICKS);
          document.dispatchEvent(new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true }));
          if (tecla.length === 1 && j.ui.estado === 'batalha') {
            entrada.value = tecla;
            entrada.dispatchEvent(new InputEvent('input', { bubbles: true }));
          }
          const b = j.battle.estado;
          // de vez em quando acerta de propósito, para a partida avançar
          if (j.ui.estado === 'batalha' && b && rnd() < 0.5) {
            const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : b.inimigos.find(e => !e.morrendo);
            if (alvo) j.battle.digitar(alvo.texto[alvo.dig]);
          }
          // depois de ~100 passos em batalha força uma vitória, para o fuzz também martelar cartas e loja
          const w = window as unknown as { passosEmBatalha?: number };
          if (j.ui.estado === 'batalha' && b && (b.etapa === 'ondas' || b.etapa === 'chefe')) {
            w.passosEmBatalha = (w.passosEmBatalha ?? 0) + 1;
            if (w.passosEmBatalha >= 100) {
              Object.assign(b, { etapa: 'vitoria', tempoEtapa: 0, avisou: false });
              w.passosEmBatalha = 0;
            }
          }
          j.quadro(0.05, passo * 0.05);
          estados.push(j.ui.estado);
          const run = j.battle.run;
          if (run) {
            const inv = Object.values(run.inventario);
            if (run.p.hp > run.p.maxHp) return { erro: `vida acima do máximo (passo ${passo})` };
            if (run.p.creditos < 0) return { erro: `créditos negativos (passo ${passo})` };
            if (!Number.isFinite(run.pontos) || run.pontos < 0) return { erro: `pontuação inválida (passo ${passo})` };
            if (inv.some(q => q < 0 || q > j.conteudo.BAL.itemMax))
              return { erro: `inventário fora do limite (passo ${passo})` };
          }
        }
        return { erro: null, estados, semente: s };
      },
      { semente, inicio: lote * 15 },
    );
    expect(r.erro).toBeNull();
    r.estados!.forEach(e => visitados.add(e));
    semente = r.semente!;
    await jogo.pular(250);
  }
  const ESTADOS = [
    'titulo',
    'nick',
    'modo',
    'tutorial',
    'banner',
    'batalha',
    'pausa',
    'concluido',
    'upgrade',
    'escolhendo',
    'loja',
    'rota',
    'fim',
    'relatorio',
    'ranking',
  ];
  const faltando = ESTADOS.filter(e => !visitados.has(e));
  expect(faltando.length, `o fuzz não passou pelas telas: ${faltando.join(', ')}`).toBeLessThanOrEqual(1);
  const nicks = await jogo.eval(j => j.ranking.carregar().map(r => [r.nick, j.validarNick(r.nick)]));
  for (const [nick, erro] of nicks) expect(erro, `nick inválido entrou no ranking: "${nick}"`).toBeNull();
  await jogo.eval(j => j.ui.irTitulo());
  expect(await jogo.estado()).toBe('titulo');
});

test('título parado vira demonstração; qualquer tecla volta ao título sem sujar o ranking', async ({ jogo, page }) => {
  await jogo.abrir();
  const rankingAntes = await page.evaluate(() => JSON.stringify(localStorage));
  await jogo.pular(31_500);
  expect(await jogo.eval(j => j.ui.emVitrine), 'demonstração começou').toBe(true);
  await expect(page.locator('#vitrine')).toBeVisible();
  await jogo.pular(3800);
  expect(await jogo.estado()).toBe('batalha');
  // o robô joga sozinho: acerta letras e derruba inimigos
  await jogo.avancar(12_000);
  expect(await jogo.eval(j => j.battle.run!.stats.acertos), 'o robô digitou').toBeGreaterThan(20);
  await jogo.tecla('a');
  expect(await jogo.estado(), 'a tecla volta ao título').toBe('titulo');
  expect(await jogo.eval(j => j.ui.emVitrine)).toBe(false);
  await expect(page.locator('#vitrine')).toBeHidden();
  expect(await page.evaluate(() => JSON.stringify(localStorage)), 'nada foi salvo').toBe(rankingAntes);
  // e a próxima tecla já começa uma partida normal
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('nick');
});
