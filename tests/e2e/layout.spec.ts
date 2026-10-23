// Layout no pior caso: nicks de 30 caracteres, nomes de andar longos,
// números grandes, ranking cheio. Tudo precisa caber na tela de 960x540.

import { expect, NICK30, test } from './ajuda';

test('banners com todos os nomes, descrições e dicas reais de andar e de chefão cabem', async ({ jogo }) => {
  await jogo.abrir();
  const problemas = await jogo.eval(j => {
    const el = document.getElementById('banner')!;
    const erros: string[] = [];
    for (const A of j.conteudo.ANDARES)
      for (const [nome, chefe, sub, dica] of [
        [A.nome, false, A.desc, A.dica],
        [A.chefe.nome, true, `"${A.chefe.falas.intro}"`, A.chefe.dica ?? ''],
      ] as const) {
        el.className = chefe ? 'chefe' : '';
        document.getElementById('banner-top')!.textContent = 'ANDAR 9/9';
        document.getElementById('banner-title')!.textContent = nome;
        document.getElementById('banner-sub')!.textContent = sub;
        document.getElementById('banner-tip')!.textContent = dica;
        const t = document.getElementById('banner-title')!;
        if (t.scrollWidth > t.clientWidth + 1) erros.push(`"${nome}" estoura o banner`);
        if (el.offsetTop + el.offsetHeight > 440) erros.push(`"${nome}": banner desce até o prompt`);
      }
    el.classList.add('hidden');
    return erros;
  });
  expect(problemas).toEqual([]);
});

test('HUD com nick de 30, andar de nome mais longo e números grandes', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.debug(8);
  const r = await jogo.eval((j, nick) => {
    Object.assign(j.battle.run!, { nick, pontos: 9999999 });
    j.battle.run!.p.creditos = 99999;
    j.quadro(0.05, 0);
    const medir = (id: string) => {
      const el = document.getElementById(id)!;
      return el.scrollWidth <= el.clientWidth + 1;
    };
    return { top: medir('hud-top'), score: medir('hud-score'), cred: medir('hud-cred') };
  }, NICK30);
  expect(r).toEqual({ top: true, score: true, cred: true });
});

test('a frase mais longa de chefão cabe no prompt sem cobrir o chefão', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.debug(8);
  const r = await jogo.eval(j => {
    const longa = j.conteudo.ANDARES.flatMap(A => A.chefe.frases).sort((a, b) => b.length - a.length)[0];
    const original = j.battle.prompt;
    j.battle.prompt = () => ({ texto: longa, dig: 12, nome: 'x', ativo: true });
    try {
      j.quadro(0.05, 0);
      const pr = document.getElementById('prompt')!;
      return { cabe: pr.scrollWidth <= pr.clientWidth + 1, topo: pr.offsetTop };
    } finally {
      j.battle.prompt = original;
    }
  });
  expect(r.cabe, 'frase estoura o prompt na horizontal').toBe(true);
  expect(r.topo, 'prompt sobe demais e cobre o chefão').toBeGreaterThanOrEqual(400);
});

test('palavra mais longa de cada andar cabe no rótulo do canvas (medida com a fonte real)', async ({ jogo }) => {
  await jogo.abrir();
  const problemas = await jogo.eval(j => {
    j.ctx.font = `26px ${j.FONTE}`;
    return j.conteudo.ANDARES.flatMap((A, i) => {
      const maior = A.palavras.slice().sort((a, b) => b.length - a.length)[0];
      const w = [...maior].reduce((s, ch) => s + j.ctx.measureText(ch).width, 0);
      return w + 16 + 34 + 10 <= 960 ? [] : [`andar ${i + 1}: "${maior}" (${Math.round(w)}px) não cabe`];
    });
  });
  expect(problemas).toEqual([]);
});

test('todas as cartas de upgrade cabem no cartão (com a etiqueta de área)', async ({ jogo }) => {
  await jogo.abrir();
  const total = await jogo.eval(j => j.conteudo.UPGRADES.length);
  for (let i = 0; i < total; i += 3) {
    await jogo.debug(1);
    await jogo.eval((j, ini) => {
      const grupo = j.conteudo.UPGRADES.slice(ini, ini + 3);
      j.battle.sortearCartas = () => grupo;
    }, i);
    await jogo.forcarFimDoAndar('vitoria');
    await jogo.teclaDepois('Enter', 1000);
    expect(await jogo.estado()).toBe('upgrade');
    const problemas = await jogo.eval(() =>
      [...document.querySelectorAll<HTMLElement>('.card')].flatMap(c => {
        const desc = c.querySelector<HTMLElement>('.card-desc')!,
          area = c.querySelector<HTMLElement>('.card-area')!,
          lvl = c.querySelector<HTMLElement>('.card-lvl')!;
        const nome = c.querySelector('.card-name')!.textContent;
        return [
          ...(c.scrollHeight > c.clientHeight + 1 ? [`carta "${nome}" transborda`] : []),
          ...(desc.offsetTop + desc.offsetHeight > area.offsetTop
            ? [`carta "${nome}": descrição encosta na etiqueta de área`]
            : []),
          ...(area.offsetTop + area.offsetHeight > lvl.offsetTop ? [`carta "${nome}": área encosta no nível`] : []),
        ];
      }),
    );
    expect(problemas).toEqual([]);
    await jogo.cabeNaTela('#cards');
    await jogo.eval(j => delete (j.battle as Partial<typeof j.battle>).sortearCartas); // volta ao método da classe
  }
});

test('fim de jogo, relatório e ranking cheio (nicks de 30, jogador fora do top 10) cabem', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.eval((j, nick) => {
    for (let i = 0; i < 14; i++)
      j.ranking.adicionar({
        nick: `${nick.slice(0, 27)} ${String(i).padStart(2, '0')}`,
        pontos: 99999 - i,
        andar: 9,
        venceu: i < 2,
        ppm: 120,
        precisao: 100,
      });
  }, NICK30);
  await jogo.debug(8);
  await jogo.eval((j, nick) => {
    const run = j.battle.run!;
    Object.assign(run, { debug: false, nick });
    // pior caso do relatório: 9 andares, muitas teclas erradas, todas as conquistas
    for (let i = 0; i < 8; i++)
      run.historico.push({
        nome: j.conteudo.ANDARES[i].nome,
        concluido: true,
        ppm: 40 + i * 9,
        precisao: 90 + i,
        tempo: 60,
      });
    'çãéêíóõú '.split('').forEach((ch, i) => (run.stats.errosTecla[ch] = 20 - i));
    j.conteudo.CONQUISTAS.forEach(c => run.conquistas.includes(c.id) || run.conquistas.push(c.id));
  }, NICK30);
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3');
  expect(await jogo.estado()).toBe('fim');
  await jogo.cabeNaTela('#screen-end .terminal-box');
  await jogo.teclaDepois('Enter', 1600);
  expect(await jogo.estado()).toBe('relatorio');
  await jogo.cabeNaTela('#screen-report .terminal-box');
  await expect(page.locator('#rel-barras .rel-linha')).toHaveCount(9);
  await expect(page.locator('#rel-conquistas .conq.on')).toHaveCount(12);
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('ranking');
  await expect(page.locator('#rank-table tr')).toHaveCount(1 + 10 + 1 + 1); // cabeçalho + top 10 + separador + jogador
  await jogo.cabeNaTela('#screen-ranking .terminal-box');
  const tabela = await jogo.eval(() => {
    const tab = document.getElementById('rank-table')!;
    const nicksCortados = [...tab.querySelectorAll<HTMLTableCellElement>('td:nth-child(2)')]
      .filter(td => td.colSpan === 1 && td.scrollWidth > td.clientWidth)
      .map(td => td.textContent);
    return { cabe: tab.scrollWidth <= tab.parentElement!.clientWidth, nicksCortados };
  });
  expect(tabela).toEqual({ cabe: true, nicksCortados: [] });
});

test('escolha de modo, tutorial e aviso de conquista cabem na tela', async ({ jogo }) => {
  await jogo.abrir();
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.preencher('nick-input', 'Layout');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('modo');
  await jogo.cabeNaTela('#modos');
  await jogo.teclaDepois('1');
  await jogo.cabeNaTela('#screen-tutorial .terminal-box');
  const toast = await jogo.eval(() => {
    const t = document.getElementById('toast')!;
    t.classList.remove('hidden');
    t.replaceChildren(
      '9/9 ★ CONQUISTA DESBLOQUEADA · +300 Multithread Humano — Digite uma frase de chefão a 60 ppm ou mais.',
    );
    const ok = t.offsetLeft - t.offsetWidth / 2 >= 0 && t.offsetLeft + t.offsetWidth / 2 <= 960;
    t.classList.add('hidden');
    return ok;
  });
  expect(toast).toBe(true);
});
