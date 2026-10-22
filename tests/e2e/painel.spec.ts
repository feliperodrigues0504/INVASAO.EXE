import fs from 'node:fs';
import { expect, test, type Jogo } from './ajuda';

async function abrirPainel(jogo: Jogo, pin = '2026') {
  await jogo.eval(j => j.ui.irTitulo());
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  expect(await jogo.estado()).toBe('pin');
  await jogo.pular(700);
  await jogo.preencher('pin-input', pin);
  await jogo.tecla('Enter');
}

test('só abre no título, com Ctrl+Shift+O e o PIN certo', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  expect(await jogo.estado(), 'não abre fora do título').toBe('nick');
  await jogo.eval(j => j.ui.irTitulo());
  await jogo.teclaDepois('O');
  expect(await jogo.estado(), 'O sozinho não abre').toBe('titulo');
  await abrirPainel(jogo, '0000');
  expect(await jogo.estado(), 'PIN errado não entra').toBe('pin');
  await expect(page.locator('#pin-error')).toContainText('incorreto');
  await jogo.preencher('pin-input', '2026');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('painel');
  await jogo.cabeNaTela('#screen-panel .terminal-box');
});

test('modo fixo, som, volume e efeitos ficam salvos (sobrevivem a recarregar a página)', async ({ jogo, page }) => {
  await jogo.abrir();
  await abrirPainel(jogo);
  await jogo.teclaDepois('1');
  expect(await jogo.eval(j => j.config.modoFixo)).toBe('normal');
  await jogo.tecla('1');
  expect(await jogo.eval(j => j.config.modoFixo)).toBe('rapido');
  await jogo.tecla('2');
  await jogo.tecla('3');
  await jogo.tecla('6');
  await expect(page.locator('html')).toHaveClass(/efeitos-reduzidos/);
  const salvos = await jogo.eval(j => j.ajustes.carregar());
  expect(salvos).toMatchObject({ modoFixo: 'rapido', som: false, volume: 1, efeitosReduzidos: true });

  // recarrega: tudo continua igual
  await jogo.abrir();
  expect(await jogo.eval(j => [j.config.modoFixo, j.sound.ligado, j.sound.volume, j.config.efeitosReduzidos])).toEqual([
    'rapido',
    false,
    1,
    true,
  ]);
  await expect(page.locator('html')).toHaveClass(/efeitos-reduzidos/);

  // com modo fixo "rápido", o jogador nem vê a escolha de modo
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.preencher('nick-input', 'Fila Grande');
  await jogo.tecla('Enter');
  expect(await jogo.estado(), 'pulou a escolha de modo').toBe('tutorial');
  expect(await jogo.eval(j => j.battle.run!.modo)).toBe('rapido');
});

test('exporta o ranking em CSV para o Excel e só apaga com confirmação', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.eval(j => {
    j.ranking.adicionar({
      nick: 'Ana; "A"',
      pontos: 10,
      andar: 1,
      total: 9,
      venceu: false,
      ppm: 10,
      precisao: 50,
      modo: 'normal',
      conquistas: ['primeiro'],
    });
    j.ranking.adicionar({
      nick: 'Bruno',
      pontos: 20,
      andar: 3,
      total: 3,
      venceu: true,
      ppm: 30,
      precisao: 90,
      modo: 'rapido',
    });
  });
  await abrirPainel(jogo);
  await expect(page.locator('#painel-stats')).toContainText('2 (normal 1 · rápido 1)');
  await expect(page.locator('#painel-stats')).toContainText('Bruno · 20');
  await expect(page.locator('#painel-stats')).toContainText('Ana; "A" · 10');
  await jogo.pular(700);
  const [download] = await Promise.all([page.waitForEvent('download'), jogo.tecla('4')]);
  expect(download.suggestedFilename()).toMatch(/^ranking-invasao-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = fs.readFileSync((await download.path())!, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('1;Bruno;20;rapido;3;3;sim');
  await expect(page.locator('#painel-msg')).toContainText('exportado');

  await jogo.tecla('5');
  expect(await jogo.eval(j => j.ranking.carregar().length), '1º toque só pede confirmação').toBe(2);
  await expect(page.locator('#painel-msg')).toContainText('certeza');
  await jogo.tecla('5');
  expect(await jogo.eval(j => j.ranking.carregar().length), '2º toque apaga').toBe(0);
});

test('o PIN pode ser trocado pelo painel (e o antigo deixa de funcionar)', async ({ jogo, page }) => {
  await jogo.abrir();
  await abrirPainel(jogo);
  await jogo.teclaDepois('7');
  expect(await jogo.estado()).toBe('novoPin');
  await expect(page.locator('#pin-titulo')).toContainText('NOVO PIN');
  await jogo.pular(700);
  await jogo.preencher('pin-input', '12');
  await jogo.tecla('Enter');
  await expect(page.locator('#pin-error')).toContainText('4 a 12');
  await jogo.preencher('pin-input', '987654');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('painel');
  await expect(page.locator('#painel-msg')).toContainText('PIN alterado');
  // o PIN não fica em texto puro nos dados salvos
  expect(await page.evaluate(() => localStorage.getItem('invasao_exe_ajustes_v1'))).not.toContain('987654');

  await jogo.abrir(); // recarrega
  await abrirPainel(jogo, '2026');
  expect(await jogo.estado(), 'o PIN antigo não entra mais').toBe('pin');
  await jogo.preencher('pin-input', '987654');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('painel');
});

test.describe('avisos de conquista', () => {
  test('aparecem na tela, uma vez só, com nome e descrição', async ({ jogo, page }) => {
    await jogo.abrir();
    await jogo.debug(1);
    expect(await jogo.eval(j => [j.battle.conquista('primeiro'), j.battle.conquista('primeiro')])).toEqual([
      true,
      false,
    ]);
    await jogo.pular(50);
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Primeiro Commit');
  });

  test('rajadas passam rápido e avisos de um visitante não vazam para o próximo', async ({ jogo, page }) => {
    await jogo.abrir();
    await jogo.debug(1);
    await jogo.eval(j =>
      ['chefe', 'limpo', 'intocavel', 'raiz', 'acentos', 'porumfio'].forEach(id => j.battle.conquista(id)),
    );
    let ms = 0;
    for (; ms < 20_000 && (await page.locator('#toast').isVisible()); ms += 200) await jogo.pular(200);
    expect(ms, '6 avisos seguidos levam no máximo 10 s').toBeLessThanOrEqual(10_000);
    await jogo.eval(j => (j.battle.conquista('combo10'), j.battle.conquista('combo20')));
    await jogo.eval(j => j.ui.irTitulo()); // próximo visitante
    await expect(page.locator('#toast')).toBeHidden();
    await jogo.debug(1);
    await jogo.eval(j => j.battle.conquista('primeiro'));
    await jogo.pular(50);
    await expect(page.locator('#toast')).toContainText('Primeiro Commit');
    await jogo.pular(3000);
    await expect(page.locator('#toast'), 'sem avisos antigos depois').toBeHidden();
  });
});
