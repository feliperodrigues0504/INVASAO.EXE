// =====================================================================
//  Liga os eventos da batalha aos efeitos visuais e sonoros.
//  (A lógica diz "o inimigo levou 12 de dano"; aqui decidimos que isso
//  vira um número flutuante, faíscas, tremor e o som de golpe.)
// =====================================================================

import { Sound } from '../audio/sound';
import { POS_JOGADOR, type Battle, type Inimigo } from '../game/battle';
import { rv } from './aleatorio';
import { ESCALA_JOGADOR, spriteDe } from './battleRenderer';
import { FX } from './fx';
import { Ritmo } from './ritmo';
import { sprite } from './sprites';

export function ligarEfeitos(battle: Battle) {
  const px = POS_JOGADOR.x;
  const pyAviso = POS_JOGADOR.y - 120;
  const pyItem = POS_JOGADOR.y - 140;

  battle.on('andarIniciado', () => {
    FX.limpar();
    Ritmo.limpar();
  });

  battle.on('acerto', alvo => {
    Sound.sfx.tecla(battle.estado?.combo ?? 0);
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
      Ritmo.impacto(0.05);
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
    Ritmo.camLenta(1.2);
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
    FX.tremer(atacante?.chefe ? 16 : 10);
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

  // ---------------- mecânicas da versão 4 ----------------
  const topo = (e: Inimigo) => e.y - spriteDe(e).h;
  battle.on('teclaBloqueada', () => Sound.sfx.bloqueada());
  battle.on('parry', e => {
    FX.texto(e.x, topo(e) - 60, 'CONTRA-ATAQUE!', '#00e5ff', 30, 1.1);
    FX.faiscas(e.x, e.y - spriteDe(e).h / 2, '#00e5ff', 20);
    FX.tremer(6);
    Ritmo.impacto(0.08);
    Sound.sfx.parry();
  });
  battle.on('especial', (e, tipo, valor) => {
    if (tipo === 'dourada') {
      FX.texto(e.x, topo(e) - 60, `+${valor} ₿`, '#ffd700', 30, 1.3);
      Sound.sfx.moeda();
    } else if (tipo === 'explosiva') {
      FX.faiscas(e.x, e.y - spriteDe(e).h / 2, '#ff8c1a', 40);
      FX.texto(e.x, topo(e) - 60, 'BOOM!', '#ff8c1a', 32, 0.9);
      FX.tremer(10);
      Sound.sfx.critico();
    } else {
      FX.texto(e.x, topo(e) - 60, `CORROMPIDA +${valor}`, '#b46cff', 26, 1.2);
      Sound.sfx.negado();
    }
  });
  battle.on('overdrivePronto', () => {
    FX.texto(px, pyItem - 30, 'OVERDRIVE PRONTO!', '#ff2bd6', 28, 1.6);
    Sound.sfx.overdrivePronto();
  });
  battle.on('overdrive', e => {
    FX.texto(e.x, topo(e) - 70, 'OVERDRIVE!', '#ff2bd6', 40, 1.2);
    FX.faiscas(e.x, e.y - spriteDe(e).h / 2, '#ff2bd6', 50);
    FX.tremer(16);
    Ritmo.impacto(0.12);
    Sound.sfx.overdrive();
  });
  battle.on('armadilha', e => {
    FX.texto(e.x, topo(e) - 60, 'PHISHING! VOCÊ CLICOU NO LINK', '#ff3355', 24, 1.6);
    Sound.sfx.armadilha();
  });
  battle.on('replicou', (_original, copia) => {
    FX.faiscas(copia.x, copia.y - 40, '#39ff14', 18);
    FX.texto(copia.x, topo(copia) - 60, 'REPLICOU!', '#ff3355', 24, 1.2);
  });
  battle.on('embaralhou', e => FX.texto(e.x, topo(e) - 60, '¿?¡!', '#e6ffe6', 22, 0.7));
  battle.on('infectou', (de, para) => {
    FX.laser(de.x, de.y - 40, para.x, para.y - 40, '#b46cff');
    FX.texto(para.x, topo(para) - 60, 'INFECTADO!', '#b46cff', 24, 1.2);
  });
  battle.on('pacoteChegou', e => FX.texto(e.x, topo(e) - 40, 'ENTREGUE!', '#ff3355', 26, 1));
  battle.on('rollback', (e, n) => {
    FX.texto(e.x, topo(e) - 50, `ROLLBACK -${n}`, '#ff3355', 28, 1.1);
    Sound.sfx.rollback();
  });
  battle.on('prazoEstourado', () => {
    FX.tremer(14);
    Sound.sfx.alerta();
  });
  battle.on('sinergia', () => Sound.sfx.sinergia());
}
