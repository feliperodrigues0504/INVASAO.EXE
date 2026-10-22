// Partidas completas jogadas por um robô (?bot=ms entre letras), do título
// ao fim, como um visitante de verdade. Servem para balanceamento e para
// garantir que nenhum fluxo trava. Rodam no projeto "robo" (mais lento).
// ?render=10 desenha 1 a cada 10 quadros: a simulação é completa e o render de todos
// os andares continua exercitado, mas a partida roda ~10x mais rápido sem GPU.

import { expect, test, type Jogo } from './ajuda';

async function jogarAte(jogo: Jogo, alvo: string, limiteMin: number) {
  for (let seg = 0; seg < limiteMin * 60; seg += 10) {
    if ((await jogo.estado()) === alvo) return seg;
    await jogo.avancar(10_000);
  }
  throw new Error(`o robô não chegou em "${alvo}" em ${limiteMin} min de jogo (parou em ${await jogo.estado()})`);
}

const PARTIDAS = [
  { nome: 'rápido (110 ms/letra), modo normal', query: '?render=10&bot=110&parar=fim&semente=11' },
  { nome: 'lento (400 ms/letra), modo normal', query: '?render=10&bot=400&parar=fim&semente=12' },
  { nome: 'rápido (110 ms/letra), modo rápido', query: '?render=10&bot=110&parar=fim&modo=2&semente=13' },
  { nome: 'muito lento (850 ms/letra), modo rápido', query: '?render=10&bot=850&parar=fim&modo=2&semente=14' },
];

for (const p of PARTIDAS) {
  test(`robô ${p.nome}: título → nick (30 caracteres) → andares → fim`, async ({ jogo, page }) => {
    await jogo.abrir(p.query);
    const seg = await jogarAte(jogo, 'fim', 20);
    const andar = await page.locator('#end-stats div:nth-child(2) b').textContent();
    const ppm = await page.locator('#end-stats div:nth-child(3) b').textContent();
    test
      .info()
      .annotations.push({ type: 'resultado', description: `andar ${andar} · ${ppm} · ${Math.round(seg / 60)} min` });
    const salvo = await jogo.eval(j => j.ranking.carregar()[0]);
    expect(salvo.nick).toMatch(/^Robô Testador da Computação \d\d$/);
    expect(salvo.nick).toHaveLength(30);
  });
}

test('resistência: 12 min jogando sem parar, ciclo fim → ranking → título → nova partida', async ({ jogo, page }) => {
  let fins = 0;
  page.on('console', m => {
    if (m.text().includes('[INVASAO] fim de jogo')) fins++;
  });
  await jogo.abrir('?render=30&bot=400&semente=21');
  for (let seg = 0; seg < 12 * 60; seg += 10) await jogo.avancar(10_000);
  expect(fins, 'partidas terminadas em 12 min').toBeGreaterThanOrEqual(2);
});
