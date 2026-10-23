// Utilidades de texto usadas pela digitação (acentos do teclado ABNT2)

export const semAcento = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const temAcento = (ch: string | undefined): boolean => !!ch && ch.normalize('NFD').length > 1;
