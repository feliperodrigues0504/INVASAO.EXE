// Emissor de eventos tipado: a lógica avisa o que aconteceu e quem
// apresenta (som, efeitos, interface) decide como mostrar.

type Mapa = { [evento: string]: unknown[] };

export class Emissor<M extends Mapa> {
  private ouvintes: { [K in keyof M]?: Array<(...args: M[K]) => void> } = {};

  on<K extends keyof M>(evento: K, fn: (...args: M[K]) => void): () => void {
    (this.ouvintes[evento] ??= []).push(fn);
    return () => {
      this.ouvintes[evento] = this.ouvintes[evento]?.filter(f => f !== fn);
    };
  }

  emit<K extends keyof M>(evento: K, ...args: M[K]): void {
    this.ouvintes[evento]?.forEach(fn => fn(...args));
  }
}
