// =====================================================================
//  Validação de nick: até 30 caracteres e filtro de palavrões que não
//  barra nomes inocentes.
// =====================================================================

export const NICK_MAX = 30;

// Palavras bloqueadas em três níveis, para não barrar nicks inocentes
// (ex.: "computação" contém "puta", "controlador" contém "rola", "enviado" contém "viado").
// prettier-ignore
const EM_QUALQUER_LUGAR = ['caralho', 'buceta', 'porra', 'merda', 'arrombad', 'piroca', 'xereca',
  'cacete', 'punheta', 'xoxota', 'siririca', 'hitler', 'nazista', 'fuck', 'bitch'];
const NO_INICIO = ['puta', 'foda', 'foder', 'bosta', 'corno', 'penis', 'vagina', 'shit', 'dick', 'cuzao'];
const EXATAS = ['cu', 'pau', 'rola', 'fdp', 'vsf', 'pqp', 'krl', 'tnc', 'viado', 'nazi'];
const LEET: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

function palavras(nick: string): string[] {
  return nick
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]/g, d => LEET[d] || d)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// remove espaços nas pontas e espaços repetidos no meio
export const limparNick = (nick: string): string => nick.trim().replace(/ +/g, ' ');

// Devolve a mensagem de erro, ou null se o nick é válido
export function validarNick(bruto: string): string | null {
  const nick = limparNick(bruto);
  if (nick.length < 2) return 'O nick precisa ter pelo menos 2 caracteres.';
  if (nick.length > NICK_MAX) return `Máximo de ${NICK_MAX} caracteres.`;
  if (!/^[\p{L}\p{N}_\-. ]+$/u.test(nick)) return 'Use apenas letras, números, espaço, _ - .';
  if ((nick.match(/[\p{L}\p{N}]/gu) || []).length < 2) return 'O nick precisa ter pelo menos 2 letras ou números.';
  const tokens = palavras(nick);
  const junto = tokens.join('');
  const bloqueado =
    EM_QUALQUER_LUGAR.some(p => junto.includes(p)) ||
    tokens.some(t => EXATAS.includes(t) || NO_INICIO.some(p => t.startsWith(p)));
  if (bloqueado) return 'Acesso negado: nick inválido.';
  return null;
}
