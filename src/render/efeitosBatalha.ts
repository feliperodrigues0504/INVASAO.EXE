// =====================================================================
//  Liga os eventos da batalha aos efeitos visuais e sonoros.
//  (A lógica diz "o inimigo levou 12 de dano"; aqui decidimos que isso
//  vira um número flutuante, faíscas, tremor e o som de golpe.)
// =====================================================================

import { Sound } from '../audio/sound';
import { POS_JOGADOR, type Battle } from '../game/battle';
import { rv } from './aleatorio';
import { ESCALA_JOGADOR, spriteDe } from './battleRenderer';
import { FX } from './fx';
import { sprite } from './sprites';

export function ligarEfeitos(battle: Battle) {
  const px = POS_JOGADOR.x;
  const pyAviso = POS_JOGADOR.y - 120;
  const pyItem = POS_JOGADOR.y - 140;

  battle.on('andarIniciado', () => FX.limpar());

  battle.on('acerto', alvo => {
    Sound.sfx.tecla();
    const topo = alvo.y - spriteDe(alvo).h / 2;
    FX.laser(px + 45, POS_JOGADOR.y - 38, alvo.x + (rv() - 0.5) * 30, topo + (rv() - 0.5) * 30);
  });
  battle.on('erro', () => Sound.sfx.erro());
  battle.on('alvoSolto', () => Sound.sfx.selecao());
  battle.on('comboMarco', combo => FX.texto(px, pyItem, `COMBO x${combo}!`, '#ffd23f', 30, 1.3));

  battle.on('inimigoAtingido', (e, dano, crit) => {
    const spr = spriteDe(e);
    const topo = e.y - spr.h;
    FX.texto(e.x + (rv() - 0.5) * 30, topo - 10, `-${dano}`, crit ? '#ff2bd6' : '#ffffff', crit ? 38 : 28);
    if (crit) {
      FX.texto(e.x, topo - 44, 'CRÍTICO!', '#ff2bd6', 30, 0.9);
      Sound.sfx.critico();
      FX.tremer(9);
    } else {
      Sound.sfx.golpe();
      FX.tremer(3);
    }
    FX.faiscas(e.x, e.y - spr.h / 2, '#39ff14', crit ? 24 : 12);
  });
  battle.on('furia', () => FX.tremer(14));

  battle.on('abate', (e, cred) => {
    const spr = spriteDe(e);
    FX.explodir(spr, e.x - spr.w / 2, e.y - spr.h);
    if (cred) FX.texto(e.x, e.y - spr.h - 30, `+${cred} ₿`, '#ffb000', 24, 1.2);
    if (!e.chefe) Sound.sfx.abate();
  });
  battle.on('desintegrar', e => {
    const spr = spriteDe(e);
    FX.explodir(spr, e.x - spr.w / 2, e.y - spr.h);
  });

  battle.on('chefeSurgiu', () => Sound.tocarMusica('chefe'));
  battle.on('alertaChefe', () => {
    Sound.pararMusica();
    Sound.sfx.alerta();
  });
  battle.on('chefeDerrotado', () => {
    Sound.sfx.chefeMorre();
    Sound.pararMusica();
    FX.tremer(20);
  });

  battle.on('bloqueado', tipo => {
    if (tipo === 'firewall') FX.texto(px, pyAviso, 'BLOQUEADO!', '#00e5ff', 28);
    else FX.texto(px, pyAviso, 'CRIPTOGRAFADO!', '#00e5ff', 26);
    Sound.sfx.bloqueio();
  });
  battle.on('dano', (dano, atacante) => {
    FX.texto(px + (rv() - 0.5) * 30, pyAviso, `-${dano}`, '#ff3355', 34);
    FX.faiscas(px, POS_JOGADOR.y - 50, '#ff3355', 16);
    FX.tremer(atacante.chefe ? 16 : 10);
    Sound.sfx.dano();
  });
  battle.on('backupRestaurado', () => {
    FX.texto(px, pyAviso - 30, 'BACKUP RESTAURADO!', '#ff2bd6', 30, 1.6);
    Sound.sfx.levelUp();
  });
  battle.on('jogadorDerrotado', () => {
    Sound.pararMusica();
    Sound.sfx.gameOver();
    const spr = sprite('hacker', ESCALA_JOGADOR);
    FX.explodir(spr, px - spr.w / 2, POS_JOGADOR.y - spr.h);
    FX.tremer(20);
  });

  battle.on('itemNegado', () => Sound.sfx.negado());
  battle.on('itemUsado', (id, valor) => {
    if (id === 'cafe') FX.texto(px, pyItem, 'CAFEÍNA!', '#ffb000', 30);
    else if (id === 'patch') FX.texto(px, pyItem, `+${valor}`, '#39ff14', 32);
    else if (id === 'antivirus') {
      FX.tremer(12);
      FX.texto(480, 200, 'VARREDURA COMPLETA!', '#00e5ff', 34);
    } else FX.texto(px, pyItem, 'FIREWALL +2', '#00e5ff', 30);
    Sound.sfx.item();
  });
}
