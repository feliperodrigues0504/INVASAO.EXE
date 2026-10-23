import { expect, NICK30, test } from './ajuda';

test('fluxo completo de um visitante pela interface, com teclado real', async ({ jogo, page }) => {
  await jogo.abrir();

  await test.step('título → nick inválido → nick de 30 caracteres → modo → tutorial → batalha', async () => {
    await jogo.teclaDepois('Enter');
    expect(await jogo.estado()).toBe('nick');
    await jogo.pular(700);
    await jogo.preencher('nick-input', 'a');
    await jogo.tecla('Enter');
    await expect(page.locator('#nick-error')).not.toBeEmpty();
    expect(await jogo.estado()).toBe('nick');
    await jogo.preencher('nick-input', NICK30);
    await jogo.tecla('Enter');
    expect(await jogo.estado()).toBe('modo');
    await jogo.teclaDepois('1');
    expect(await jogo.estado()).toBe('tutorial');
    expect(await jogo.eval(j => [j.battle.run!.nick, j.battle.run!.modo])).toEqual([NICK30, 'normal']);
    await jogo.teclaDepois('Enter');
    expect(await jogo.estado()).toBe('banner');
    await jogo.pular(3800);
    expect(await jogo.estado()).toBe('batalha');
    await jogo.avancar(500);
    const hud = await page.evaluate(() => {
      const top = document.getElementById('hud-top')!;
      return {
        scroll: top.scrollWidth,
        client: top.clientWidth,
        nick: document.getElementById('hud-nick')!.offsetWidth,
      };
    });
    expect(hud.scroll, 'HUD estourou com nick longo').toBeLessThanOrEqual(hud.client + 1);
    expect(hud.nick, 'nick no HUD deveria ser cortado com reticências').toBeLessThanOrEqual(250);
  });

  await test.step('digitação pelo campo escondido: tecla real, acento composto, NFD e colar bloqueado', async () => {
    await jogo.avancar(3000);
    await jogo.eval(j => {
      const e = j.battle.estado!.inimigos.find(x => !x.morrendo)!;
      e.hp = e.maxHp = 999;
      e.texto = 'ação';
      e.dig = 0;
      j.battle.soltarAlvo();
    });
    const dig = () => jogo.eval(j => j.battle.estado!.inimigos.find(x => x.texto === 'ação')?.dig);
    const erros = await jogo.eval(j => j.battle.run!.stats.erros);
    await page.keyboard.type('a'); // tecla real, pelo <input> escondido
    expect(await dig()).toBe(1);
    // tecla morta: durante a composição nada é processado
    await page.evaluate(() => {
      const ent = document.getElementById('type-input') as HTMLInputElement;
      ent.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      ent.value = '´';
      ent.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    });
    expect(await dig()).toBe(1);
    await page.evaluate(() => {
      const ent = document.getElementById('type-input') as HTMLInputElement;
      ent.value = 'ç';
      ent.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'ç' }));
      ent.value = '';
      ent.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    expect(await dig(), 'ç processado no fim da composição, sem duplicar').toBe(2);
    await page.evaluate(() => {
      const ent = document.getElementById('type-input') as HTMLInputElement;
      ent.value = 'ã'.normalize('NFD'); // a + til combinante
      ent.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    expect(await dig(), 'ã em NFD é aceito').toBe(3);
    const colar = await page.evaluate(() => {
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      document.getElementById('type-input')!.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(colar, 'colar deveria ser bloqueado').toBe(true);
    expect(await jogo.eval(j => j.battle.run!.stats.erros)).toBe(erros);
  });

  await test.step('itens pelas teclas, ESC pausa, som liga/desliga, continuar', async () => {
    await jogo.eval(j => (j.battle.run!.inventario.cafe = 1));
    await jogo.tecla('1');
    expect(await jogo.eval(j => [j.battle.estado!.lento > 0, j.battle.run!.inventario.cafe])).toEqual([true, 0]);
    await jogo.tecla('Escape');
    expect(await jogo.estado()).toBe('pausa');
    await jogo.teclaDepois('2');
    await expect(page.locator('#pause-sound')).toHaveText('[2] Som: OFF');
    await jogo.tecla('2');
    await expect(page.locator('#pause-sound')).toHaveText('[2] Som: ON');
    await jogo.tecla('1');
    expect(await jogo.estado()).toBe('batalha');
  });

  await test.step('não dá para pausar durante a vitória ou a derrota', async () => {
    for (const etapa of ['vitoria', 'morte'] as const) {
      const anterior = await jogo.eval((j, e) => {
        const b = j.battle.estado!;
        const antes = b.etapa;
        b.etapa = e;
        return antes;
      }, etapa);
      await jogo.tecla('Escape');
      expect(await jogo.estado(), `não pausa em ${etapa}`).toBe('batalha');
      await jogo.eval((j, e) => (j.battle.estado!.etapa = e), anterior);
    }
  });

  await test.step('andar concluído → curiosidade → carta → loja → rota → próximo andar', async () => {
    await jogo.forcarFimDoAndar('vitoria');
    expect(await jogo.estado()).toBe('concluido');
    expect((await page.locator('#clear-fact').textContent())!.length).toBeGreaterThan(20);
    await jogo.teclaDepois('Enter', 1000);
    expect(await jogo.estado()).toBe('upgrade');
    await expect(page.locator('.card')).toHaveCount(3);
    await jogo.teclaDepois('1');
    await jogo.pular(700);
    expect(await jogo.estado()).toBe('loja');
    await jogo.eval(j => (j.battle.run!.p.creditos = 100));
    await jogo.teclaDepois('1');
    expect(await jogo.eval(j => [j.battle.run!.inventario.cafe, j.battle.run!.p.creditos])).toEqual([1, 70]);
    await jogo.tecla('Enter');
    expect(await jogo.estado()).toBe('rota');
    await expect(page.locator('#rota-opcoes')).toContainText('ROTA DE ELITE');
    await jogo.teclaDepois('2'); // rota de elite
    expect(await jogo.estado()).toBe('banner');
    expect(await jogo.eval(j => [j.battle.run!.andar, j.battle.estado!.elite])).toEqual([1, true]);
    await jogo.pular(3800);
  });

  await test.step('desistir pela pausa salva no ranking e mostra fim → relatório → ranking → título', async () => {
    expect(await jogo.estado()).toBe('batalha');
    await jogo.tecla('Escape');
    await jogo.teclaDepois('3');
    expect(await jogo.estado()).toBe('fim');
    const salvo = await jogo.eval((j, n) => j.ranking.carregar().find(r => r.nick === n), NICK30);
    expect(salvo).toMatchObject({ andar: 2, total: 9, modo: 'normal' });
    await jogo.teclaDepois('Enter', 1600);
    expect(await jogo.estado()).toBe('relatorio');
    await jogo.teclaDepois('Enter');
    expect(await jogo.estado()).toBe('ranking');
    await expect(page.locator('#rank-table tr.eu')).toHaveCount(1);
    await jogo.teclaDepois('Enter');
    expect(await jogo.estado()).toBe('titulo');
    await expect(page.locator('#title-rank-normal')).toContainText('Hacker');
  });
});

test('modo rápido: partida completa pela interface até a vitória, com ranking próprio', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.eval(j =>
    j.ranking.adicionar({
      nick: 'NoRankingNormal',
      pontos: 999999,
      andar: 9,
      total: 9,
      venceu: true,
      ppm: 90,
      precisao: 99,
      modo: 'normal',
    }),
  );
  await jogo.entrarNaBatalha('Visitante Rápido', '2');
  expect(await jogo.eval(j => j.battle.run!.modo)).toBe('rapido');
  for (let i = 0; i < 3; i++) {
    if (i > 0) await jogo.pular(3800);
    expect(await jogo.estado()).toBe('batalha');
    await jogo.avancar(100);
    await expect(page.locator('#hud-andar')).toHaveText(new RegExp(`^RÁPIDO · ANDAR ${i + 1}/3`));
    await jogo.forcarFimDoAndar('vitoria');
    if (i < 2) {
      expect(await jogo.estado()).toBe('concluido');
      await jogo.teclaDepois('Enter', 1000);
      await jogo.teclaDepois('1');
      await jogo.pular(600); // a loja abre 500 ms depois da carta
      await jogo.teclaDepois('Enter');
      await jogo.teclaDepois('1'); // rota segura
    }
  }
  expect(await jogo.estado()).toBe('fim');
  await expect(page.locator('#end-title')).toContainText('RESTAURADO');
  await expect(page.locator('#end-stats')).toContainText('3/3');
  await expect(page.locator('#end-rank')).toContainText('1º'); // o recorde do normal não conta
  const salvo = await jogo.eval(j => j.ranking.carregar().find(r => r.nick === 'Visitante Rápido'));
  expect(salvo).toMatchObject({ modo: 'rapido', total: 3, venceu: true });
  expect(salvo!.conquistas).toContain('zerou');
  await jogo.teclaDepois('Enter', 1600);
  await expect(page.locator('#rel-barras .rel-linha')).toHaveCount(3);
  await jogo.teclaDepois('Enter');
  await expect(page.locator('#rank-title')).toContainText('RÁPIDO');
  await expect(page.locator('#rank-table')).not.toContainText('NoRankingNormal');
  await jogo.teclaDepois('Enter');
  await expect(page.locator('#title-rank-rapido')).toContainText('Visitante');
  await expect(page.locator('#title-rank-normal')).toContainText('NoRankingNormal');
});

test('relatório: teclas mais erradas, precisão nos acentos e análise', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.debug(5);
  await jogo.avancar(3000);
  await jogo.eval(j => {
    j.battle.run!.p.maxHp = j.battle.run!.p.hp = 1e6;
    const e = j.battle.estado!.inimigos.find(x => !x.morrendo)!;
    e.hp = e.maxHp = 1e6;
    e.texto = 'ação';
    e.dig = 0;
    j.battle.soltarAlvo();
    for (const ch of ['a', 'c', 'c', 'ç', 'a', 'ã', 'o']) j.battle.digitar(ch);
  });
  expect(await jogo.eval(j => j.battle.run!.stats)).toMatchObject({
    acentoOk: 2,
    acentoErro: 3,
    errosTecla: { ç: 2, ã: 1 },
  });
  await jogo.forcarFimDoAndar('morte');
  expect(await jogo.estado()).toBe('fim');
  await jogo.teclaDepois('Enter', 1600);
  expect(await jogo.estado()).toBe('relatorio');
  await expect(page.locator('#rel-teclas .chip').first()).toHaveText(/^ç/);
  await expect(page.locator('#rel-insight')).toContainText('acentos');
  await expect(page.locator('#rel-resumo')).toContainText('40%'); // 2 de 5
});
