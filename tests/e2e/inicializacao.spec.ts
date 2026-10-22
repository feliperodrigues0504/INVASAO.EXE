import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from './ajuda';

test.describe('abertura do jogo', () => {
  test('abre via file://, offline, sem nenhuma requisição externa, na tela título', async ({ jogo, page }) => {
    const requisicoes: string[] = [];
    page.on('request', r => requisicoes.push(r.url()));
    await jogo.abrir();
    expect(await jogo.estado()).toBe('titulo');
    await expect(page.locator('#screen-title')).toBeVisible();
    await expect(page.locator('#title-event')).toHaveText('OBSERVATÓRIO DE CURSOS');
    await expect(page.locator('#title-course')).toHaveText('SISTEMAS DE INFORMAÇÃO');
    // um único arquivo: nada além do próprio index.html (fontes e scripts embutidos)
    expect(requisicoes.filter(u => !u.startsWith('data:'))).toHaveLength(1);
  });

  test('as fontes pixel art embutidas carregam', async ({ jogo, page }) => {
    await jogo.abrir();
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return [document.fonts.check('26px VT323L'), document.fonts.check('18px SilkscreenL')];
    });
    expect(ok).toEqual([true, true]);
  });

  for (const [w, h, escala] of [
    [960, 540, 1],
    [1366, 768, 768 / 540],
    [1920, 1080, 2],
    [1280, 1024, 1280 / 960],
  ] as const) {
    test(`texto do canvas nítido em ${w}x${h}: camada de texto na resolução real`, async ({ jogo, page }) => {
      await page.setViewportSize({ width: w, height: h });
      await jogo.abrir('?andar=8');
      const tam = await page.evaluate(() => {
        const base = document.getElementById('canvas') as HTMLCanvasElement;
        const texto = document.getElementById('canvas-texto') as HTMLCanvasElement;
        const r = document.getElementById('game')!.getBoundingClientRect();
        return {
          base: [base.width, base.height],
          texto: [texto.width, texto.height],
          visivel: !texto.hidden,
          gw: r.width,
          gh: r.height,
        };
      });
      // a pixel art fica em 960x540 (ampliada por CSS); só o texto usa a resolução real
      expect(tam.base).toEqual([960, 540]);
      expect(tam.texto).toEqual([Math.round(960 * escala), Math.round(540 * escala)]);
      expect(tam.visivel).toBe(escala > 1);
      // o jogo inteiro cabe na janela, sem cortar nada
      expect(tam.gw).toBeLessThanOrEqual(w + 1);
      expect(tam.gh).toBeLessThanOrEqual(h + 1);
    });
  }

  test('conteúdo inválido mostra o motivo na tela em vez de uma tela preta', async ({ jogo, page }, info) => {
    jogo.permitirErros = true; // aqui o erro é o esperado
    // cópia do build com um erro de edição de verdade no andares.json (acentos inválido)
    const html = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
    expect(html).toContain('"acentos":"nenhum"');
    const quebrado = info.outputPath('quebrado.html');
    fs.writeFileSync(quebrado, html.replace('"acentos":"nenhum"', '"acentos":"talvez"'));
    await page.goto(pathToFileURL(quebrado).href);
    await jogo.avancar(2000);
    await expect(page.locator('#erro-fatal')).toBeVisible();
    await expect(page.locator('#erro-fatal')).toContainText('andares.json: 0.acentos');
  });
});
