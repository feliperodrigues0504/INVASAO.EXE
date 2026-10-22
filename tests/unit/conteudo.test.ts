import { describe, expect, it } from 'vitest';
import andaresJson from '../../src/content/andares.json';
import jogoJson from '../../src/content/jogo.json';
import {
  ANDARES,
  carregarConteudo,
  CONQUISTAS,
  ConteudoInvalido,
  ITENS,
  JOGADOR_BASE,
  RARIDADES,
  SPRITES,
  TIPOS_INIMIGO,
  UPGRADES,
} from '../../src/content';
import { aplicarEfeitos, type Jogador } from '../../src/game/battle';
import { temAcento } from '../../src/game/texto';
import { sprite } from '../../src/render/sprites';
import { usarCanvasFalso } from './ajuda';

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('conteúdo dos andares', () => {
  it('tem 9 andares completos (palavras, chefão, falas, curiosidade)', () => {
    expect(ANDARES).toHaveLength(9);
    ANDARES.forEach(A => {
      expect(A.palavras.length).toBeGreaterThanOrEqual(15);
      expect(A.chefe.frases.length).toBeGreaterThanOrEqual(4);
      expect(A.tipos.every(t => TIPOS_INIMIGO[t])).toBe(true);
    });
  });

  it('todo texto é digitável num teclado ABNT2 (NFC, minúsculo, sem espaço sobrando)', () => {
    const permitido = 'abcdefghijklmnopqrstuvwxyzáéíóúâêôãõçà ,.!?:*-';
    for (const [i, A] of ANDARES.entries()) {
      for (const t of [...A.palavras, ...A.chefe.frases]) {
        const onde = `andar ${i + 1} "${t}"`;
        expect(t, `${onde} não está em NFC`).toBe(t.normalize('NFC'));
        expect(t, `${onde} tem espaço sobrando`).toBe(t.trim());
        expect(t.includes('  '), `${onde} tem espaço duplo`).toBe(false);
        for (const ch of t) expect(permitido.includes(ch), `${onde}: caractere "${ch}"`).toBe(true);
      }
    }
  });

  it('andares "sem acento" realmente não têm acento', () => {
    for (const A of ANDARES.filter(a => a.acentos === 'nenhum'))
      for (const t of [...A.palavras, ...A.chefe.frases]) expect([...t].some(temAcento), `"${t}"`).toBe(false);
  });

  it('sem palavras repetidas e com primeiras letras variadas', () => {
    ANDARES.forEach((A, i) => {
      expect(new Set(A.palavras).size, `andar ${i + 1}: palavra repetida`).toBe(A.palavras.length);
      const iniciais = new Set(A.palavras.map(w => w[0].normalize('NFD')[0]));
      expect(iniciais.size, `andar ${i + 1}: poucas letras iniciais`).toBeGreaterThanOrEqual(A.maxTela + 3);
    });
  });
});

describe('sprites', () => {
  it('todos existem, toda cor usada está na paleta e nenhum fica vazio', () => {
    usarCanvasFalso();
    for (const [nome, def] of Object.entries(SPRITES)) {
      def.grid.forEach((linha, y) => {
        for (const ch of linha)
          expect(ch === '.' || !!def.pal[ch], `sprite ${nome} linha ${y}: cor "${ch}"`).toBe(true);
      });
      const s = sprite(nome, 2);
      expect(s.w > 0 && s.h > 0 && s.pixels.length > 0, `sprite ${nome} vazio`).toBe(true);
    }
    Object.values(TIPOS_INIMIGO).forEach(t => expect(SPRITES[t.sprite]).toBeDefined());
  });
});

describe('upgrades, itens e conquistas', () => {
  it('upgrades têm ids únicos, raridades válidas e efeitos que não quebram', () => {
    expect(new Set(UPGRADES.map(u => u.id)).size).toBe(UPGRADES.length);
    for (const u of UPGRADES) {
      expect(RARIDADES[u.raridade]).toBeDefined();
      const p: Jogador = { ...JOGADOR_BASE, maxHp: 100 };
      aplicarEfeitos(p, u);
      for (const v of Object.values(p)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('existem 4 itens (teclas 1 a 4)', () => expect(ITENS).toHaveLength(4));

  it('12 conquistas válidas e sem id repetido', () => {
    expect(CONQUISTAS).toHaveLength(12);
    expect(new Set(CONQUISTAS.map(c => c.id)).size).toBe(12);
  });
});

describe('validação do conteúdo (erros de edição no JSON viram mensagens claras)', () => {
  it('o conteúdo oficial é válido', () => {
    expect(() => carregarConteudo(jogoJson, andaresJson)).not.toThrow();
  });

  it('aponta campo faltando, tipo errado e valor fora do permitido', () => {
    const andares = copia(andaresJson) as Record<string, unknown>[];
    delete andares[0].fato;
    andares[1].hp = 'muito';
    andares[2].acentos = 'talvez';
    try {
      carregarConteudo(jogoJson, andares);
      expect.unreachable('deveria rejeitar');
    } catch (e) {
      expect(e).toBeInstanceOf(ConteudoInvalido);
      const msgs = (e as ConteudoInvalido).erros.join('\n');
      expect(msgs).toContain('0.fato');
      expect(msgs).toContain('1.hp');
      expect(msgs).toContain('2.acentos');
    }
  });

  it('aponta referências quebradas (sprite, tipo de inimigo, raridade, rota)', () => {
    const jogo = copia(jogoJson);
    const andares = copia(andaresJson);
    andares[0].chefe.sprite = 'nao_existe';
    andares[1].tipos = ['dragao'];
    jogo.upgrades[0].raridade = 'lendario';
    jogo.modos.rapido.rota = [0, 42];
    const erros = (() => {
      try {
        carregarConteudo(jogo, andares);
        return [];
      } catch (e) {
        return (e as ConteudoInvalido).erros;
      }
    })().join('\n');
    expect(erros).toContain('nao_existe');
    expect(erros).toContain('dragao');
    expect(erros).toContain('lendario');
    expect(erros).toContain('andar 42');
  });

  it('PIN padrão precisa ser numérico', () => {
    const jogo = copia(jogoJson);
    jogo.evento.pinPadrao = 'abc';
    expect(() => carregarConteudo(jogo, andaresJson)).toThrow(/PIN/);
  });
});
