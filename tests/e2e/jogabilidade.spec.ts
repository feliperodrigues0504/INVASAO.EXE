// Funcionalidades de jogabilidade da versão 4 pela interface real.

import { expect, test } from './ajuda';

test('duelo em revezamento: J1 → J2 com o mesmo desafio → placar → título', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.teclaDepois('Enter');
  await jogo.pular(700);
  await jogo.preencher('nick-input', 'Ana');
  await jogo.tecla('Enter');
  expect(await jogo.estado()).toBe('modo');
  await jogo.teclaDepois('3');
  expect(await jogo.estado()).toBe('tutorial');
  const semente = await jogo.eval(j => j.battle.run!.semente);
  expect(await jogo.eval(j => j.battle.run!.modo)).toBe('rapido');
  await jogo.teclaDepois('Enter');
  await jogo.pular(3800);
  await jogo.eval(j => (j.battle.run!.pontos = 5000));
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3'); // J1 desiste
  expect(await jogo.estado()).toBe('fim');
  await expect(page.locator('#end-press')).toContainText('VEZ DO JOGADOR 2');

  await jogo.teclaDepois('Enter', 1600);
  expect(await jogo.estado()).toBe('nick');
  await jogo.pular(2000);
  await expect(page.locator('#nick-lines')).toContainText('jogador 2');
  await jogo.preencher('nick-input', 'Bruno');
  await jogo.tecla('Enter');
  expect(await jogo.estado(), 'o J2 pula a escolha de modo').toBe('tutorial');
  expect(await jogo.eval(j => j.battle.run!.semente), 'mesmo desafio inicial').toBe(semente);
  await jogo.teclaDepois('Enter');
  await jogo.pular(3800);
  await jogo.avancar(6000);
  await expect(page.locator('#hud-extra')).toContainText('Ana'); // o J2 corre contra o J1
  await expect(page.locator('#hud-extra [data-icone=fantasma]')).toBeVisible();
  await jogo.eval(j => (j.battle.run!.pontos = 7000));
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3');
  await expect(page.locator('#end-press')).toContainText('RESULTADO DO DUELO');
  await jogo.teclaDepois('Enter', 1600);
  expect(await jogo.estado()).toBe('duelo');
  await expect(page.locator('#duelo-titulo')).toContainText('Bruno VENCEU');
  await expect(page.locator('#duelo-placar')).toContainText('Ana');
  await jogo.cabeNaTela('#screen-duelo .terminal-box');
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('titulo');
  // as duas partidas valem no ranking do modo rápido
  const nicks = await jogo.eval(j => j.ranking.carregar().map(r => `${r.nick}/${r.modo}`));
  expect(nicks).toEqual(expect.arrayContaining(['Ana/rapido', 'Bruno/rapido']));
});

test('rota: servidor misterioso aposta créditos uma vez; depois escolhe a rota', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.debug(1);
  await jogo.eval(j => {
    j.battle.sortearServidor = () => true;
    j.battle.run!.p.creditos = 120;
  });
  await jogo.forcarFimDoAndar('vitoria');
  await jogo.teclaDepois('Enter', 1000);
  await jogo.teclaDepois('1');
  await jogo.pular(600);
  await jogo.teclaDepois('Enter');
  expect(await jogo.estado()).toBe('rota');
  await expect(page.locator('#rota-opcoes')).toContainText('SERVIDOR MISTERIOSO');
  await jogo.cabeNaTela('#screen-rota .terminal-box');
  const antes = await jogo.eval(j => j.battle.run!.p.creditos);
  await jogo.teclaDepois('3');
  const depois = await jogo.eval(j => j.battle.run!.p.creditos);
  expect(Math.abs(depois - antes)).toBe(50);
  await expect(page.locator('#rota-msg')).not.toBeEmpty();
  await expect(page.locator('#rota-opcoes')).not.toContainText('SERVIDOR MISTERIOSO'); // uma aposta só
  await jogo.tecla('3');
  expect(await jogo.eval(j => j.battle.run!.p.creditos)).toBe(depois);
  await jogo.tecla('1');
  expect(await jogo.estado()).toBe('banner');
  expect(await jogo.eval(j => j.battle.estado!.elite)).toBe(false);
});

test('cartas: [R] troca as 3 cartas por créditos e o preço sobe', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.debug(1);
  await jogo.eval(j => (j.battle.run!.p.creditos = 100));
  await jogo.forcarFimDoAndar('vitoria');
  await jogo.teclaDepois('Enter', 1000);
  expect(await jogo.estado()).toBe('upgrade');
  await expect(page.locator('#rerrolar')).toContainText('25 ₿');
  await expect(page.locator('#sinergias')).toContainText('SEGURANÇA 0/4');
  await jogo.teclaDepois('r');
  expect(await jogo.eval(j => j.battle.run!.p.creditos)).toBe(75);
  await expect(page.locator('#rerrolar')).toContainText('35 ₿');
  await expect(page.locator('.card')).toHaveCount(3);
});

test('HUD: PPM ao vivo e o fantasma do recordista (verde à frente, vermelho atrás)', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.eval(j => j.fantasmas.registrar('normal', 'Recordista', 99999, [0, 50000, 99999]));
  await jogo.entrarNaBatalha('Visitante', '1');
  await jogo.avancar(8000);
  await expect(page.locator('#hud-extra')).toContainText('PPM');
  await expect(page.locator('#hud-extra .fantasma')).toContainText('Recordista: -50000');
  // ícone em pixel art no lugar do emoji (a TV do quiosque não tem fonte de emoji)
  await expect(page.locator('#hud-extra .fantasma [data-icone=fantasma]')).toBeVisible();
  expect(await page.locator('#hud').innerText()).not.toMatch(/[👻⚡★🏆]/u);
  await expect(page.locator('#hud-extra .fantasma')).toHaveClass(/red/);
});

test('fim de partida: quem bate o recorde vira o novo fantasma; apagar o ranking apaga o fantasma', async ({
  jogo,
  page,
}) => {
  await jogo.abrir();
  await jogo.entrarNaBatalha('Nova Recordista', '2');
  await jogo.eval(j => (j.battle.run!.pontos = 4321));
  await jogo.tecla('Escape');
  await jogo.teclaDepois('3');
  expect(await jogo.eval(j => j.fantasmas.carregar('rapido')?.nick)).toBe('Nova Recordista');
  await jogo.eval(j => j.ui.irTitulo());
  await jogo.pular(700);
  await jogo.ctrlShiftO();
  await jogo.pular(700);
  await jogo.preencher('pin-input', '2026');
  await jogo.tecla('Enter');
  await jogo.teclaDepois('5');
  await jogo.tecla('5');
  await expect(page.locator('#painel-msg')).toContainText('ranking apagado');
  expect(await jogo.eval(j => j.fantasmas.carregar('rapido'))).toBeNull();
});

test('impressora: o prompt mostra a frase chegando (░) e a letra que não chegou não vira erro', async ({
  jogo,
  page,
}) => {
  await jogo.abrir();
  await jogo.debug(1, true); // andar 1, direto no chefão (Impressora)
  await jogo.avancar(4500);
  expect(await jogo.eval(j => j.battle.estado!.chefe?.truques)).toContain('impressao');
  await jogo.eval(j => {
    const c = j.battle.estado!.chefe!;
    c.visivel = 3; // só 3 letras impressas
    c.revelarT = 99;
  });
  await jogo.avancar(50);
  await expect(page.locator('#prompt-text')).toContainText('░');
  const erros = await jogo.eval(j => j.battle.run!.stats.erros);
  const frase = await jogo.eval(j => j.battle.estado!.chefe!.texto);
  await page.keyboard.type(frase.slice(0, 5));
  expect(await jogo.eval(j => j.battle.estado!.chefe!.dig)).toBe(3);
  expect(await jogo.eval(j => j.battle.run!.stats.erros)).toBe(erros);
});

test('HUD do design: medidor até o overdrive e vinheta vermelha com vida baixa', async ({ jogo, page }) => {
  await jogo.abrir();
  await jogo.debug(1);
  await jogo.eval(j => (j.battle.estado!.combo = 10));
  await jogo.avancar(200);
  const largura = () => page.locator('#combo-medidor i').evaluate(el => (el as HTMLElement).style.width);
  expect(await largura(), 'combo 10 de 20 = metade').toBe('50%');
  await jogo.eval(j => (j.battle.estado!.overdrive = true));
  await jogo.avancar(200);
  await expect(page.locator('#combo-medidor')).toHaveClass(/pronto/);
  expect(await largura()).toBe('100%');

  await expect(page.locator('#perigo')).not.toHaveClass(/ativo/);
  await jogo.eval(j => (j.battle.run!.p.hp = Math.ceil(j.battle.run!.p.maxHp * 0.2)));
  await jogo.avancar(200);
  await expect(page.locator('#perigo'), 'vida abaixo de 30% acende a vinheta').toHaveClass(/ativo/);
});
