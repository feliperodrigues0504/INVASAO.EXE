import { describe, expect, it } from 'vitest';
import { criarAjustes, hashPin } from '../../src/storage/ajustes';
import { armazenamentoMemoria, type Armazenamento } from '../../src/storage/armazenamento';
import { gerarCsv } from '../../src/storage/csv';
import { limparNick, NICK_MAX, validarNick } from '../../src/storage/nick';
import { CHAVE_RANKING, criarRanking, LIMITE_POR_MODO } from '../../src/storage/ranking';

const resultado = (nick: string, pontos: number, extra: Record<string, unknown> = {}) => ({
  nick,
  pontos,
  andar: 1,
  venceu: false,
  ppm: 20,
  precisao: 90,
  ...extra,
});

describe('nick', () => {
  it('aceita nomes comuns, acentos, espaços e até 30 caracteres', () => {
    const ok = [
      'Fernanda',
      'joão_silva',
      'Ana Clara',
      'computeiro',
      'Computação',
      'deputado',
      'Rolando',
      'controlador',
      'Yoshito',
      'enviado',
      'Esmeralda',
      'Pinto',
      'Paulo',
      'Cuca',
      'Nazaré',
      'Disputa',
      'xX_Hacker_Xx',
      'Hacker Supremo da Computação 1',
      'SI-2026',
      'a.b',
    ];
    for (const nk of ok) expect(validarNick(nk), `"${nk}" deveria ser aceito`).toBeNull();
    expect('Hacker Supremo da Computação 1').toHaveLength(NICK_MAX);
  });

  it('bloqueia palavrões, nicks curtos/longos e caracteres especiais', () => {
    const ruins = [
      '',
      'a',
      '   ',
      'x'.repeat(31),
      'porra',
      'PORRA123',
      'c4r4lh0',
      'puta',
      'putaria',
      'fdp',
      'Cu',
      'viado',
      'xXcaralhoXx',
      'foda-se',
      'hitler1',
      '<script>',
      'nick😀',
      'a/b',
    ];
    for (const nk of ruins) expect(validarNick(nk), `"${nk}" deveria ser bloqueado`).not.toBeNull();
  });

  it('exige 2 letras/números e junta espaços repetidos', () => {
    for (const nk of ['..', '- -', '_.', 'a.', '  .  ']) expect(validarNick(nk)).not.toBeNull();
    expect(limparNick('  Ana    Clara  ')).toBe('Ana Clara');
    expect(validarNick('Ana' + ' '.repeat(40) + 'Clara')).toBeNull();
  });
});

describe('ranking', () => {
  it('ordena por pontos e devolve a posição correta', () => {
    const r = criarRanking(armazenamentoMemoria());
    r.adicionar(resultado('b', 100));
    r.adicionar(resultado('a', 300));
    const pos = r.adicionar(resultado('c', 200));
    expect(pos).toMatchObject({ posicao: 2, total: 3, modo: 'normal' });
    expect(r.top(3).map(x => x.nick)).toEqual(['a', 'c', 'b']);
  });

  it('modos têm rankings separados', () => {
    const r = criarRanking(armazenamentoMemoria());
    r.adicionar(resultado('normal', 999, { modo: 'normal' }));
    const pos = r.adicionar(resultado('rapido', 10, { modo: 'rapido' }));
    expect(pos.posicao).toBe(1);
    expect(r.top(5, 'rapido').map(x => x.nick)).toEqual(['rapido']);
  });

  it('dados corrompidos ou antigos não quebram', () => {
    for (const lixo of ['{"a":1}', 'lixo{', 'null', '[null, {"nick":5}, {"nick":"ok","pontos":"x"}]']) {
      const r = criarRanking(armazenamentoMemoria({ [CHAVE_RANKING]: lixo }));
      expect(r.carregar()).toEqual([]);
    }
    const r = criarRanking(armazenamentoMemoria({ [CHAVE_RANKING]: '[{"nick":"velho","pontos":50}]' }));
    expect(r.carregar()[0]).toMatchObject({ nick: 'velho', precisao: 0, modo: 'normal', total: 9, conquistas: [] });
  });

  it('nick adulterado no armazenamento é cortado em NICK_MAX', () => {
    const ataque = '<img src=x id=xss onerror=window.__xss=1>';
    const r = criarRanking(armazenamentoMemoria({ [CHAVE_RANKING]: JSON.stringify([resultado(ataque, 5)]) }));
    expect(r.carregar()[0].nick).toBe(ataque.slice(0, NICK_MAX));
  });

  it('com 1000 jogadores: ordem, posição e limite continuam certos', () => {
    const lista = Array.from({ length: 1000 }, (_, i) => ({
      ...resultado(`Jogador ${i}`, 1000 - i),
      id: i,
      total: 9,
      modo: 'normal',
    }));
    const r = criarRanking(armazenamentoMemoria({ [CHAVE_RANKING]: JSON.stringify(lista) }));
    expect(r.adicionar(resultado('No Meio', 500.4)).posicao).toBe(501);
    expect(r.carregar()).toHaveLength(1000);
    expect(r.top(1, 'normal')[0].nick).toBe('Jogador 0');
  });

  it('o limite é POR MODO: um dia de partidas rápidas não apaga o ranking do normal', () => {
    const normal = Array.from({ length: 5 }, (_, i) => ({ ...resultado(`N${i}`, 10 + i), modo: 'normal' }));
    const rapido = Array.from({ length: LIMITE_POR_MODO }, (_, i) => ({
      ...resultado(`R${i}`, 1000 + i),
      modo: 'rapido',
    }));
    const r = criarRanking(armazenamentoMemoria({ [CHAVE_RANKING]: JSON.stringify([...normal, ...rapido]) }));
    r.adicionar(resultado('R-novo', 5000, { modo: 'rapido' }));
    const lista = r.carregar();
    expect(lista.filter(x => x.modo === 'normal')).toHaveLength(5);
    expect(lista.filter(x => x.modo === 'rapido')).toHaveLength(LIMITE_POR_MODO);
  });

  it('simular devolve a posição sem salvar (partidas de teste)', () => {
    const arm = armazenamentoMemoria();
    const r = criarRanking(arm);
    r.adicionar(resultado('a', 100));
    expect(r.simular(50, 'normal')).toMatchObject({ posicao: 2, total: 1, id: null });
    expect(r.carregar()).toHaveLength(1);
  });

  it('armazenamento que falha (anônimo/disco cheio) não quebra', () => {
    const quebrado: Armazenamento = {
      ler: () => null,
      gravar: () => {
        /* engole como o localStorage protegido */
      },
    };
    const r = criarRanking(quebrado);
    expect(r.adicionar(resultado('x', 1)).posicao).toBe(1);
    expect(r.carregar()).toEqual([]);
  });
});

describe('CSV para o Excel', () => {
  it('tem BOM, ";" como separador e protege ; e aspas', () => {
    const r = criarRanking(armazenamentoMemoria());
    r.adicionar(resultado('Ana; "A"', 10, { total: 9, conquistas: ['primeiro'] }));
    r.adicionar(resultado('Bruno', 20, { andar: 3, total: 3, venceu: true, ppm: 30, modo: 'rapido' }));
    const csv = gerarCsv(r.carregar());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const linhas = csv.slice(1).split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[0].startsWith('posicao;nick;pontos;modo')).toBe(true);
    expect(linhas[1].startsWith('1;Bruno;20;rapido;3;3;sim')).toBe(true);
    expect(linhas[2]).toContain('"Ana; ""A"""');
  });

  it('protege quebras de linha dentro de um campo', () => {
    const csv = gerarCsv([{ ...resultado('a\nb', 1), id: 1, total: 9, modo: 'normal', data: '', conquistas: [] }]);
    expect(csv).toContain('"a\nb"');
  });
});

describe('ajustes do painel', () => {
  it('salvam e carregam; valores corrompidos viram o padrão', () => {
    const arm = armazenamentoMemoria();
    const a = criarAjustes(arm);
    a.salvar({ modoFixo: 'rapido', som: false, volume: 0.5, efeitosReduzidos: true, pinHash: hashPin('1234') });
    expect(a.carregar()).toEqual({
      modoFixo: 'rapido',
      som: false,
      volume: 0.5,
      efeitosReduzidos: true,
      pinHash: hashPin('1234'),
    });
    arm.gravar(a.CHAVE, '{"modoFixo":"hack","volume":7,"som":"sim","pinHash":"<b>"}');
    expect(a.carregar()).toEqual({ modoFixo: null, som: true, volume: 0.75, efeitosReduzidos: false, pinHash: null });
  });

  it('o padrão de efeitos reduzidos pode vir do sistema (reduzir movimento)', () => {
    expect(criarAjustes(armazenamentoMemoria(), { efeitosReduzidos: true }).carregar().efeitosReduzidos).toBe(true);
  });

  it('hash do PIN é estável, de 8 dígitos hex, e diferencia PINs', () => {
    expect(hashPin('2026')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashPin('2026')).toBe(hashPin('2026'));
    expect(hashPin('2026')).not.toBe(hashPin('2027'));
  });
});
