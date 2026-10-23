// =====================================================================
//  Sons 8-bit sintetizados na hora (Web Audio) — nenhum arquivo de áudio.
// =====================================================================

let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
let ligado = true;
let mudo = false; // silêncio temporário (modo vitrine), sem mexer no ajuste do organizador
let volume = 0.75; // 0..1, ajustado no painel do organizador
const VOLUME_BASE = 0.8;

function init() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = VOLUME_BASE * volume;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.55;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.22;
  musicBus.connect(master);
}

interface Tom {
  freq?: number;
  type?: OscillatorType;
  dur?: number;
  vol?: number;
  slide?: number;
  delay?: number;
  bus?: GainNode;
}

function tone({ freq = 440, type = 'square', dur = 0.08, vol = 0.3, slide = 0, delay = 0, bus }: Tom) {
  if (!ctx || !ligado || mudo) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(bus || sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise({ dur = 0.15, vol = 0.3, delay = 0, freq = 2000, bus }: Omit<Tom, 'type' | 'slide'>) {
  if (!ctx || !ligado || mudo) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus || sfxBus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const arp = (notas: number[], passo: number, opts: Tom) =>
  notas.forEach((n, i) => tone({ freq: n, delay: i * passo, ...opts }));

// prettier-ignore
const sfx = {
  // o tom da tecla sobe com o combo (até x30): o jogador OUVE que está indo bem
  tecla:   (combo = 0) => tone({ freq: 900 + Math.min(combo, 30) * 22 + Math.random() * 150, dur: 0.03, vol: 0.12 }),
  erro:    () => tone({ freq: 110, type: 'sawtooth', dur: 0.15, vol: 0.25, slide: -40 }),
  golpe:   () => { noise({ dur: 0.12, vol: 0.35, freq: 3000 }); tone({ freq: 220, dur: 0.1, vol: 0.2, slide: -120 }); },
  critico: () => { noise({ dur: 0.2, vol: 0.4, freq: 5000 }); arp([880, 1320], 0.05, { dur: 0.1, vol: 0.2 }); },
  abate:   () => { noise({ dur: 0.3, vol: 0.35, freq: 1500 }); arp([660, 440, 220, 110], 0.05, { dur: 0.1, vol: 0.2, type: 'square' }); },
  dano:    () => { noise({ dur: 0.25, vol: 0.5, freq: 800 }); tone({ freq: 160, type: 'sawtooth', dur: 0.3, vol: 0.3, slide: -100 }); },
  bloqueio:() => arp([1200, 1600], 0.04, { dur: 0.08, vol: 0.18, type: 'triangle' }),
  alerta:  () => { for (let i = 0; i < 3; i++) { tone({ freq: 440, type: 'sawtooth', dur: 0.22, vol: 0.25, delay: i * 0.45 }); tone({ freq: 330, type: 'sawtooth', dur: 0.2, vol: 0.25, delay: i * 0.45 + 0.22 }); } },
  chefeMorre: () => { for (let i = 0; i < 6; i++) noise({ dur: 0.3, vol: 0.4, freq: 1200 + i * 300, delay: i * 0.12 }); arp([523, 659, 784, 1046], 0.12, { dur: 0.25, vol: 0.2, delay: 0.7 }); },
  levelUp: () => arp([523, 659, 784, 1046, 1318], 0.07, { dur: 0.15, vol: 0.2, type: 'triangle' }),
  selecao: () => tone({ freq: 660, dur: 0.06, vol: 0.18, type: 'triangle' }),
  compra:  () => arp([988, 1318], 0.06, { dur: 0.12, vol: 0.2, type: 'square' }),
  negado:  () => tone({ freq: 200, type: 'square', dur: 0.12, vol: 0.18, slide: -60 }),
  item:    () => arp([440, 660, 880], 0.04, { dur: 0.1, vol: 0.2, type: 'triangle' }),
  vitoria: () => arp([523, 523, 784, 784, 880, 1046, 1318, 1568], 0.12, { dur: 0.2, vol: 0.2, type: 'square' }),
  gameOver:() => arp([440, 415, 392, 370, 349, 330, 165], 0.18, { dur: 0.3, vol: 0.22, type: 'sawtooth' }),
  boot:    () => arp([220, 330, 440, 660], 0.06, { dur: 0.08, vol: 0.12 }),
  parry:   () => { arp([1500, 2250], 0.03, { dur: 0.09, vol: 0.22, type: 'triangle' }); noise({ dur: 0.08, vol: 0.25, freq: 6000 }); },
  overdrivePronto: () => arp([392, 523, 659, 784, 1046], 0.05, { dur: 0.12, vol: 0.18, type: 'square' }),
  overdrive: () => { noise({ dur: 0.5, vol: 0.5, freq: 2500 }); arp([1046, 784, 523, 262], 0.06, { dur: 0.2, vol: 0.25, type: 'sawtooth' }); },
  armadilha: () => arp([600, 450, 300, 150], 0.07, { dur: 0.12, vol: 0.25, type: 'sawtooth' }),
  bloqueada: () => tone({ freq: 140, type: 'square', dur: 0.04, vol: 0.1 }),
  rollback: () => arp([880, 660, 440], 0.04, { dur: 0.06, vol: 0.18, type: 'square' }),
  especial: () => arp([1318, 1568, 2093], 0.04, { dur: 0.08, vol: 0.18, type: 'triangle' }),
  sinergia: () => arp([523, 659, 784, 1046, 1318, 1568], 0.06, { dur: 0.16, vol: 0.2, type: 'triangle' }),
  moeda:   () => arp([1568, 2093], 0.05, { dur: 0.1, vol: 0.2, type: 'square' }),
};

// ---------------- música: baixo + arpejo em loop ----------------
const BAIXO = [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 40, 40, 52, 47];
const ACORDES = [
  [69, 72, 76],
  [67, 71, 74],
  [65, 69, 72],
  [64, 68, 71],
];
type ModoMusica = 'normal' | 'chefe';
const musica = {
  tocando: false,
  passo: 0,
  proximo: 0,
  bpm: 118,
  timer: 0 as ReturnType<typeof setInterval> | 0,
  modo: 'normal' as ModoMusica,
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function agendar() {
  if (!ctx) return;
  // se a aba ficou em segundo plano o timer atrasa: pula as notas perdidas
  // em vez de tocar todas de uma vez
  if (musica.proximo < ctx.currentTime - 0.1) musica.proximo = ctx.currentTime + 0.05;
  while (musica.proximo < ctx.currentTime + 0.12) {
    const s = musica.passo;
    const passoDur = 60 / musica.bpm / 2;
    const delay = Math.max(0, musica.proximo - ctx.currentTime);
    if (ligado) {
      tone({ freq: midi(BAIXO[s % 16]), type: 'triangle', dur: passoDur * 0.9, vol: 0.5, delay, bus: musicBus });
      const ac = ACORDES[Math.floor(s / 4) % 4];
      const nota = ac[s % 3] + (musica.modo === 'chefe' ? 12 : 0);
      if (s % 2 === 0 || musica.modo === 'chefe')
        tone({ freq: midi(nota), type: 'square', dur: passoDur * 0.5, vol: 0.12, delay, bus: musicBus });
      if (s % 4 === 2) noise({ dur: 0.04, vol: 0.15, freq: 8000, delay, bus: musicBus });
      if (musica.modo === 'chefe' && s % 4 === 0) noise({ dur: 0.1, vol: 0.4, freq: 300, delay, bus: musicBus });
    }
    musica.passo = (s + 1) % 64;
    musica.proximo += passoDur;
  }
}

function tocarMusica(modo: ModoMusica = 'normal') {
  if (!ctx) return;
  musica.modo = modo;
  musica.bpm = modo === 'chefe' ? 150 : 118;
  if (musica.tocando) return;
  musica.tocando = true;
  musica.proximo = ctx.currentTime + 0.05;
  musica.timer = setInterval(agendar, 30);
}

function pararMusica() {
  musica.tocando = false;
  if (musica.timer) clearInterval(musica.timer);
  musica.timer = 0;
}

export const Sound = {
  init,
  sfx,
  tocarMusica,
  pararMusica,
  alternar: () => (ligado = !ligado),
  silenciar: (v: boolean) => {
    mudo = v;
  },
  definirLigado: (v: boolean) => {
    ligado = !!v;
  },
  definirVolume: (v: number) => {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = VOLUME_BASE * volume;
  },
  get ligado() {
    return ligado;
  },
  get volume() {
    return volume;
  },
};
