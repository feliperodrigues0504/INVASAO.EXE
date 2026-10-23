// Regressão visual: compara cada tela com uma screenshot de referência
// (tests/e2e/__screenshots__). Com ?semente e o relógio falso, a chuva Matrix,
// os inimigos e as palavras saem idênticos a cada execução.
//
// Mudou o visual de propósito? Atualize as referências com:
//   npm run test:e2e:update
// e confira as imagens novas no diff antes de commitar.

import { expect, test, type Jogo } from './ajuda';

const foto = (jogo: Jogo, nome: string) => expect(jogo.page).toHaveScreenshot(`${nome}.png`);

test('telas de menu', async ({ jogo }) => {
  await jogo.abrir('?semente=1');
  await jogo.avancar(500);
  await foto(jogo, '01-titulo');
  await jogo.teclaDepois('Enter');
  await jogo.pular(2000);
  await jogo.avancar(100);
  await foto(jogo, '02-nick');
  await jogo.preencher('nick-input', 'Visitante');
  await jogo.tecla('Enter');
  await jogo.avancar(100);
  await foto(jogo, '03-modo');
  await jogo.teclaDepois('1');
  await jogo.avancar(100);
  await foto(jogo, '04-tutorial');
  await jogo.teclaDepois('Enter');
  await jogo.avancar(1000);
  await foto(jogo, '05-banner');
});

test('batalha, chefão e telas entre andares', async ({ jogo }) => {
  await jogo.abrir('?semente=7');
  await jogo.debug(7);
  await jogo.eval(j => (j.battle.run!.p.maxHp = j.battle.run!.p.hp = 1e6));
  await jogo.avancar(4000);
  await foto(jogo, '06-batalha');
  await jogo.debug(2, true);
  await jogo.eval(j => (j.battle.run!.p.maxHp = j.battle.run!.p.hp = 1e6));
  await jogo.avancar(6000);
  await foto(jogo, '07-chefao');
  await jogo.forcarFimDoAndar('vitoria');
  await foto(jogo, '08-andar-concluido');
  await jogo.teclaDepois('Enter', 1000);
  await jogo.avancar(600);
  await foto(jogo, '09-cartas');
  await jogo.teclaDepois('1');
  await jogo.pular(700);
  await jogo.avancar(100);
  await foto(jogo, '10-loja');
  await jogo.eval(j => (j.battle.sortearServidor = () => true));
  await jogo.teclaDepois('Enter');
  await jogo.avancar(100);
  await foto(jogo, '10b-rota');
});

test('batalha com as marcações da versão 4 (armadilha, especiais, elite, overdrive, fantasma)', async ({ jogo }) => {
  await jogo.abrir('?semente=7');
  await jogo.eval(j => j.fantasmas.registrar('normal', 'Recordista', 99999, [0, 400, 800]));
  await jogo.debug(7);
  await jogo.eval(j => {
    const run = j.battle.run!;
    run.p.maxHp = run.p.hp = 1e6;
    j.ui.irTitulo(); // sem o fantasma do modo debug: recomeça pelo fluxo normal
  });
  await jogo.entrarNaBatalha('Visitante', '1');
  await jogo.eval(j => {
    const run = j.battle.run!;
    run.p.maxHp = run.p.hp = 1e6;
    j.battle.estado!.elite = true;
  });
  await jogo.avancar(6000);
  await jogo.eval(j => {
    const b = j.battle.estado!;
    b.overdrive = true;
    b.inimigos.forEach(e => (e.elite = true));
    const [a, c] = b.inimigos.filter(e => !e.morrendo);
    if (a) Object.assign(a, { armadilha: true, armadilhaT: 99, especial: null });
    if (c) c.especial = 'dourada';
  });
  await jogo.avancar(100);
  await foto(jogo, '06b-mecanicas');
});

test('resultado do duelo', async ({ jogo }) => {
  await jogo.abrir('?semente=5');
  for (const [nick, pontos] of [
    ['Ana Clara', 5230],
    ['Bruno', 6110],
  ] as const) {
    if (nick === 'Ana Clara') {
      await jogo.teclaDepois('Enter');
      await jogo.pular(700);
      await jogo.preencher('nick-input', nick);
      await jogo.tecla('Enter');
      await jogo.teclaDepois('3');
    } else {
      await jogo.teclaDepois('Enter', 1600);
      await jogo.pular(2000);
      await jogo.preencher('nick-input', nick);
      await jogo.tecla('Enter');
    }
    await jogo.teclaDepois('Enter');
    await jogo.pular(3800);
    await jogo.eval((j, p) => (j.battle.run!.pontos = p), pontos);
    await jogo.tecla('Escape');
    await jogo.teclaDepois('3');
  }
  await jogo.teclaDepois('Enter', 1600);
  await jogo.avancar(100);
  await foto(jogo, '16-duelo');
});

test('fim, relatório, ranking e painel', async ({ jogo }) => {
  await jogo.abrir('?semente=3');
  await jogo.eval(j => {
    const nomes = ['Ana Clara', 'Bruno', 'Carla', 'Diego', 'Eduarda'];
    nomes.forEach((nick, i) =>
      j.ranking.adicionar({
        nick,
        pontos: 30000 - i * 4000,
        andar: 9 - i,
        total: 9,
        venceu: i === 0,
        ppm: 70 - i * 6,
        precisao: 97 - i,
        data: '2026-10-17T10:00:00.000Z',
      }),
    );
  });
  await jogo.debug(4);
  await jogo.eval(j => {
    const run = j.battle.run!;
    Object.assign(run, { debug: false, nick: 'Visitante', pontos: 12345 });
    run.historico.push(
      { nome: 'SUPORTE TÉCNICO', concluido: true, ppm: 32, precisao: 94, tempo: 60 },
      { nome: 'SISTEMAS OPERACIONAIS', concluido: true, ppm: 38, precisao: 91, tempo: 70 },
      { nome: 'PROGRAMAÇÃO', concluido: true, ppm: 41, precisao: 89, tempo: 80 },
    );
    Object.assign(run.stats, {
      errosTecla: { ç: 4, ã: 3, r: 2 },
      acentoOk: 9,
      acentoErro: 7,
      palavras: 48,
      tempo: 245,
      maiorCombo: 14,
    });
    run.conquistas.push('primeiro', 'combo10', 'chefe');
  });
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3');
  await jogo.avancar(100);
  await foto(jogo, '11-fim');
  await jogo.teclaDepois('Enter', 1600);
  await jogo.avancar(100);
  await foto(jogo, '12-relatorio');
  await jogo.teclaDepois('Enter');
  await jogo.avancar(100);
  await foto(jogo, '13-ranking');
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  await jogo.pular(700);
  await jogo.preencher('pin-input', '2026');
  await jogo.tecla('Enter');
  await jogo.avancar(100);
  await foto(jogo, '14-painel');
});

test('batalha em Full HD (canvas na resolução real)', async ({ jogo, page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await jogo.abrir('?semente=7');
  await jogo.debug(8);
  await jogo.eval(j => (j.battle.run!.p.maxHp = j.battle.run!.p.hp = 1e6));
  await jogo.avancar(4000);
  await foto(jogo, '15-batalha-1920x1080');
});
