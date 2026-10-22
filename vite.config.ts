import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// O build gera UM único dist/index.html (JS, CSS e fontes embutidos).
// Assim o jogo continua abrindo com dois cliques, sem servidor e sem internet,
// e o mesmo arquivo é empacotado pelo Tauri no executável do evento.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/ui/**', 'src/audio/**', 'src/**/*.d.ts'],
      reporter: ['text', 'html'],
      // a CI reprova se a cobertura da lógica do jogo cair abaixo disto
      thresholds: { 'src/game/**': { lines: 95, branches: 85 }, 'src/storage/**': { lines: 70 } },
    },
  },
});
