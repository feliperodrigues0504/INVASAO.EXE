import { defineConfig, devices } from '@playwright/test';

// Os testes E2E abrem o BUILD (dist/index.html) direto do disco, via file://,
// exatamente como no dia do evento. Rode `npm run build` antes (o script
// `npm run test:e2e` já faz isso).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 120_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  expect: {
    // tolerância pequena para diferenças de antialiasing entre máquinas
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide' },
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 960, height: 540 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // as screenshots de referência não dependem do sistema (fontes embutidas no jogo)
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  projects: [
    { name: 'jogo', testIgnore: /(robo|desempenho)\.spec\.ts/ },
    // desempenho mede tempo real: roda DEPOIS dos outros e um caso por vez, sem disputar CPU
    { name: 'desempenho', testMatch: /desempenho\.spec\.ts/, dependencies: ['jogo'], fullyParallel: false },
    // partidas completas do robô: mais lentas, rodam em paralelo com o resto
    { name: 'robo', testMatch: /robo\.spec\.ts/, timeout: 1_200_000 },
  ],
});
