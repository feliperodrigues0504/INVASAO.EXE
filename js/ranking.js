// =====================================================================
//  Ranking salvo no navegador (localStorage) + validação de nick
// =====================================================================

const NICK_MAX = 30;

const Ranking = (() => {
  const CHAVE = 'invasao_exe_ranking_v1';
  const LIMITE = 1000;

  // Lê o ranking ignorando qualquer dado corrompido ou de versões antigas
  function carregar() {
    let dados;
    try { dados = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return []; }
    if (!Array.isArray(dados)) return [];
    return dados
      .filter(e => e && typeof e === 'object' && typeof e.nick === 'string' && Number.isFinite(e.pontos))
      .map(e => ({
        id: e.id, nick: e.nick.slice(0, NICK_MAX), pontos: Math.round(e.pontos),
        andar: Number.isFinite(e.andar) ? e.andar : 1, venceu: !!e.venceu,
        ppm: Number.isFinite(e.ppm) ? e.ppm : 0, precisao: Number.isFinite(e.precisao) ? e.precisao : 0,
        data: typeof e.data === 'string' ? e.data : '',
        modo: e.modo === 'rapido' ? 'rapido' : 'normal',
        total: Number.isFinite(e.total) ? e.total : 9,
        conquistas: Array.isArray(e.conquistas) ? e.conquistas.filter(c => typeof c === 'string') : [],
      }))
      .sort((a, b) => b.pontos - a.pontos);
  }

  function salvar(lista) {
    try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* sem armazenamento */ }
  }

  // Adiciona e devolve a posição dentro do ranking do mesmo modo (1 = primeiro lugar)
  function adicionar(entrada) {
    entrada.modo = entrada.modo === 'rapido' ? 'rapido' : 'normal';
    const lista = carregar();
    entrada.id = Date.now() + Math.random();
    lista.push(entrada);
    lista.sort((a, b) => b.pontos - a.pontos);
    salvar(lista.slice(0, LIMITE));
    const doModo = lista.filter(e => e.modo === entrada.modo);
    return { posicao: doModo.findIndex(e => e.id === entrada.id) + 1, total: doModo.length, id: entrada.id, modo: entrada.modo };
  }

  function top(n, modo) { return carregar().filter(e => !modo || e.modo === modo).slice(0, n); }

  function limpar() { salvar([]); }

  return { adicionar, top, limpar, carregar, CHAVE };
})();

// Ajustes feitos no painel do organizador (sobrevivem a fechar o navegador)
const Ajustes = (() => {
  const CHAVE = 'invasao_exe_ajustes_v1';
  const PADRAO = { modoFixo: null, som: true, volume: 0.75 };

  function carregar() {
    let d;
    try { d = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    return {
      modoFixo: d.modoFixo === 'normal' || d.modoFixo === 'rapido' ? d.modoFixo : null,
      som: typeof d.som === 'boolean' ? d.som : PADRAO.som,
      volume: [0.25, 0.5, 0.75, 1].includes(d.volume) ? d.volume : PADRAO.volume,
    };
  }

  function salvar(a) {
    try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch (e) { /* sem armazenamento */ }
  }

  return { carregar, salvar, CHAVE };
})();

const Nick = (() => {
  // Palavras bloqueadas em três níveis, para não barrar nicks inocentes
  // (ex.: "computação" contém "puta", "controlador" contém "rola", "enviado" contém "viado").
  const EM_QUALQUER_LUGAR = ['caralho', 'buceta', 'porra', 'merda', 'arrombad', 'piroca', 'xereca',
    'cacete', 'punheta', 'xoxota', 'siririca', 'hitler', 'nazista', 'fuck', 'bitch'];
  const NO_INICIO = ['puta', 'foda', 'foder', 'bosta', 'corno', 'penis', 'vagina', 'shit', 'dick', 'cuzao'];
  const EXATAS = ['cu', 'pau', 'rola', 'fdp', 'vsf', 'pqp', 'krl', 'tnc', 'viado', 'nazi'];
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

  function palavras(nick) {
    return nick.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[0-9]/g, d => LEET[d] || d)
      .split(/[^a-z]+/).filter(Boolean);
  }

  // remove espaços nas pontas e espaços repetidos no meio
  const limpar = nick => nick.trim().replace(/ +/g, ' ');

  function validar(nick) {
    nick = limpar(nick);
    if (nick.length < 2) return 'O nick precisa ter pelo menos 2 caracteres.';
    if (nick.length > NICK_MAX) return `Máximo de ${NICK_MAX} caracteres.`;
    if (!/^[\p{L}\p{N}_\-. ]+$/u.test(nick)) return 'Use apenas letras, números, espaço, _ - .';
    if ((nick.match(/[\p{L}\p{N}]/gu) || []).length < 2) return 'O nick precisa ter pelo menos 2 letras ou números.';
    const tokens = palavras(nick);
    const junto = tokens.join('');
    const bloqueado = EM_QUALQUER_LUGAR.some(p => junto.includes(p))
      || tokens.some(t => EXATAS.includes(t) || NO_INICIO.some(p => t.startsWith(p)));
    if (bloqueado) return 'Acesso negado: nick inválido.';
    return null;
  }

  return { validar, limpar };
})();
