// =====================================================================
//  Simulação de balanceamento: centenas de partidas de "visitantes" com
//  velocidades diferentes, para ver até onde cada um chega.
//  Rode com:  npm run balanceamento   (resultado em reports/balanceamento.txt)
//
//  O visitante simulado: digita na velocidade indicada errando 5% das
//  letras, desvia das armadilhas de phishing, usa Patch com a vida baixa,
//  escolhe a carta ao acaso e sempre a rota segura.
// =====================================================================

import fs from 'node:fs';
import { it } from 'vitest';
import { Battle } from '../../src/game/battle';
import { criarRng } from '../../src/game/rng';

const PARTIDAS = Number(process.env.PARTIDAS) || 12;
const VELOCIDADES = [15, 25, 35, 45, 60, 80, 100];

export function jogar(ppm: number, modo: 'normal' | 'rapido', semente: number, comprar: boolean) {
  const battle = new Battle();
  const run = battle.novaPartida('sim', modo, { semente });
  const rnd = criarRng(semente * 7 + 1);
  const intervaloLetra = 60 / (ppm * 5);
  let fim: 'venceu' | 'perdeu' | null = null;
  let concluido: boolean;
  battle.on('andarConcluido', () => (concluido = true));
  battle.on('gameOver', () => (fim = 'perdeu'));
  let tempo = 0;
  for (let k = 0; k < run.rota.length && !fim; k++) {
    battle.iniciarAndar();
    concluido = false;
    let proxLetra = 0;
    for (let t = 0; t < 1200 && !concluido && !fim; t += 1 / 60) {
      tempo += 1 / 60;
      if (t >= proxLetra) {
        proxLetra = t + intervaloLetra;
        const b = battle.estado!;
        if (b.etapa === 'ondas' || b.etapa === 'chefe') {
          if (run.p.hp < run.p.maxHp * 0.4 && run.inventario.patch > 0) battle.usarItem(1);
          if (b.alvo?.armadilha) battle.soltarAlvo();
          const alvo = b.alvo && !b.alvo.morrendo ? b.alvo : b.inimigos.find(e => !e.morrendo && !e.armadilha);
          if (alvo) battle.digitar(rnd() < 0.05 ? '#' : alvo.texto[alvo.dig]);
        }
      }
      battle.atualizar(1 / 60);
    }
    if (fim) break;
    battle.registrarAndar(true);
    if (k === run.rota.length - 1) {
      fim = 'venceu';
      break;
    }
    battle.curarEntreAndares();
    const cartas = battle.sortearCartas(3);
    if (cartas.length) battle.aplicarUpgrade(cartas[Math.floor(rnd() * cartas.length)]);
    if (comprar) while (battle.comprar(1) === 'ok');
    battle.escolherRota(false);
    battle.avancar();
  }
  return { andar: battle.posicao(), venceu: fim === 'venceu', min: tempo / 60 };
}

it('balanceamento', () => {
  const linhas = ['modo    itens         ppm   vitórias   andares alcançados (12 partidas)   duração média'];
  for (const modo of ['normal', 'rapido'] as const)
    for (const comprar of [false, true])
      for (const ppm of VELOCIDADES) {
        const r = Array.from({ length: PARTIDAS }, (_, i) => jogar(ppm, modo, 100 + i, comprar));
        const vitorias = r.filter(x => x.venceu).length;
        const andares = r.map(x => x.andar).sort((a, b) => a - b);
        const dur = (r.reduce((s, x) => s + x.min, 0) / r.length).toFixed(1);
        linhas.push(
          `${modo.padEnd(7)} ${(comprar ? 'compra patch' : 'sem itens').padEnd(13)} ${String(ppm).padStart(3)}   ${String(vitorias).padStart(2)}/${PARTIDAS}      ${andares.join(',').padEnd(30)}   ${dur} min`,
        );
      }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/balanceamento.txt', linhas.join('\n') + '\n');
}, 900_000);
