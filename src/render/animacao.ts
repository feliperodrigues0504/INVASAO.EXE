// =====================================================================
//  Estado das animações do jogador (só visual): digitando e ferido.
//  Os efeitos ligam os contadores; o loop principal os faz diminuir.
// =====================================================================

let digitando = 0; // segundos restantes da animação de digitar
let ferido = 0; // segundos restantes do "piscar vermelho" de dano

export const Animacao = {
  digitar() {
    digitando = 0.3;
  },
  ferir() {
    ferido = 0.35;
  },
  atualizar(dt: number) {
    digitando = Math.max(0, digitando - dt);
    ferido = Math.max(0, ferido - dt);
  },
  limpar() {
    digitando = ferido = 0;
  },
  get digitando() {
    return digitando > 0;
  },
  // intensidade do vermelho (1 logo depois do dano, some em 0,35 s)
  get ferido() {
    return ferido / 0.35;
  },
};
