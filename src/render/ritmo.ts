// =====================================================================
//  Ritmo: micropausas ("hit-stop") e câmera lenta para dar peso aos
//  golpes. Só mexe na VELOCIDADE com que o tempo passa no loop
//  principal; as regras da batalha não sabem que isso existe.
// =====================================================================

let pausa = 0; // segundos congelado (golpe crítico, contra-ataque, overdrive)
let lenta = 0; // segundos em câmera lenta (último golpe no chefão)
const FATOR_LENTO = 0.3;

export const Ritmo = {
  impacto(seg: number) {
    pausa = Math.max(pausa, seg);
  },
  camLenta(seg: number) {
    lenta = Math.max(lenta, seg);
  },
  // Recebe o tempo real do passo e devolve quanto o jogo deve andar
  escalar(dt: number): number {
    if (pausa > 0) {
      pausa -= dt;
      return 0;
    }
    if (lenta > 0) {
      lenta -= dt;
      return dt * FATOR_LENTO;
    }
    return dt;
  },
  limpar() {
    pausa = lenta = 0;
  },
};
