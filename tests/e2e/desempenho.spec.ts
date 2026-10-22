// Desempenho em tempo REAL (sem relógio falso): a cena mais pesada
// (andar 7, 3 inimigos, explosões, café, escudo, HUD) num navegador sem GPU,
// que é o pior caso. Orçamento: 16,6 ms por quadro = 60 fps.
// Mede 3 lotes e usa o MELHOR: outros programas rodando na máquina só
// atrasam, nunca adiantam, então o menor tempo é o custo real do jogo.

import { expect, test } from './ajuda';

test.use({ relogio: false });

const ORCAMENTO_MS = 1000 / 60;

for (const [w, h] of [
  [960, 540],
  [1920, 1080],
] as const) {
  test(`cena pesada a ${w}x${h}: cabe em 60 fps sem GPU`, async ({ jogo, page }) => {
    await page.setViewportSize({ width: w, height: h });
    await jogo.abrir();
    await jogo.eval(j => j.ui.inicioDebug(7));
    const lotes = await jogo.eval(j => {
      const b = j.battle;
      b.run!.p.maxHp = b.run!.p.hp = 1e6;
      for (let i = 0; i < 600 && b.estado!.inimigos.filter(e => !e.morrendo && e.nascendo <= 0).length < 3; i++)
        b.atualizar(1 / 60);
      Object.assign(b.estado!, { lento: 99, escudo: 3 });
      const bot = () => {
        const est = b.estado!;
        const alvo = est.alvo && !est.alvo.morrendo ? est.alvo : est.inimigos.find(e => !e.morrendo);
        if (alvo && (est.etapa === 'ondas' || est.etapa === 'chefe')) b.digitar(alvo.texto[alvo.dig]);
      };
      const N = 200;
      const tempos: number[] = [];
      for (let lote = 0; lote < 3; lote++) {
        const t0 = performance.now();
        for (let i = 0; i < N; i++) {
          if (i % 60 === 0) for (let k = 0; k < 3; k++) j.fx.explodir(j.sprite('ransomware', 7), 300 + k * 120, 200);
          bot();
          b.atualizar(1 / 60);
          j.quadro(1 / 60, (lote * N + i) / 60);
        }
        tempos.push((performance.now() - t0) / N);
      }
      return tempos;
    });
    const melhor = Math.min(...lotes);
    test.info().annotations.push({
      type: 'desempenho',
      description: `${melhor.toFixed(2)} ms por quadro (lotes: ${lotes.map(x => x.toFixed(1)).join(' / ')})`,
    });
    expect(melhor).toBeLessThan(ORCAMENTO_MS);
  });
}
