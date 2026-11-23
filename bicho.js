// Mascota: bichito de neón líquido (una masa redondeada + 4 patitas cortas, ojos de matriz de LEDs).
// Canvas 2D, sin WebGL: robusto, ligero y nítido a cualquier tamaño (también a 40 px).
// API: const m = crearMascota(canvas, {transparente, vista, sombra, calidad});
//   m.estado('reposo|pensar|leer|escribir|comando|web|esperando|enviar|hecho|error|parado|dormir|escuchando')
//   (escuchando: el renderer llama a estado('escuchando') y manda extras({voz: 0..1}) con el nivel de la voz)
//   m.espontanea(nombre), m.listaEspontaneas(); opcion crearMascota(c, {espontaneas:false}) las desactiva
//   m.ojos('1'..'9') cambia el estilo de ojos en vivo (opcion crearMascota(c, {ojos:'2'})); m.expresion('wow'|'happy'|'x'|..., seg) fuerza una expresion; m.listaOjos()
//   m.reloj(frac) deja el bicho en forma de reloj de arena (1 = arriba llena, 0 = vacia); m.reloj(null) lo devuelve a la normalidad
//   m.enfado(0..1) lo pone rojo, con ceño, temblando y echando vapor (0 = normal); convive con las espontaneas
//   m.forma('coche|viga|buho'), m.proyectos(n), m.voz(0..1), m.atento(bool), m.dormir(), m.despertar(),
//   m.extras({proyectosTrabajando, voz, atento, dormir}), m.avanzar(dt), m.saltar(seg), m.destruir()

const TAU = Math.PI * 2;
// paleta amarillo marcador: base #F0C24B, luz/crema calido, sombras marron-ambar
const BASE = [240, 194, 75], ROJO = [194, 85, 75];
const ESTADOS = ['reposo', 'pensar', 'leer', 'escribir', 'comando', 'web', 'esperando', 'enviar', 'hecho', 'error', 'parado', 'dormir', 'proyectos', 'escuchando'];
const FORMAS = ['circulo', 'coche', 'viga', 'buho', 'pesa', 'reloj'];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mezcla = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const hh = x => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = x => x * x * (3 - 2 * x);
const rnd = (a, b) => a + Math.random() * (b - a);

class Muelle {
  constructor(x, k, z) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = 2 * z * Math.sqrt(k); }
  paso(dt) { const n = Math.ceil(dt / 0.008), h = dt / n; for (let i = 0; i < n; i++) { this.v += (this.k * (this.t - this.x) - this.c * this.v) * h; this.x += this.v * h; } }
}

// ---------- contornos de N puntos (todas las formas se interpolan punto a punto) ----------
const NP = 96, sin = Math.sin, cos = Math.cos, PI = Math.PI;
const LEGX = [-0.60, -0.20, 0.20, 0.60], LEGB = [-0.10, -0.03, 0.03, 0.10];
const arcPts = (cx, cy, r, a0, a1, n = 8) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + cos(a) * r, cy + sin(a) * r]); } return o; };
function remuestrear(pts) {
  const n = pts.length, L = [0]; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; L.push(L[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const tot = L[n], out = new Array(NP); let j = 0;
  for (let k = 0; k < NP; k++) { const d = tot * k / NP; while (j < n - 1 && L[j + 1] < d) j++; const a = pts[j], b = pts[(j + 1) % n], seg = (L[j + 1] - L[j]) || 1, f = (d - L[j]) / seg; out[k] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  return out;
}
const yBase = x => -0.05 + 0.8 * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x)), 2.5)), 0.4);
function ptsBicho(t, wob, legs) {
  const raw = [], th1 = 0.7134;
  const rp = th => 1 + wob * (0.035 * sin(th * 5 + t * 9) + 0.025 * sin(th * 3 - t * 7)) + 0.006 * sin(th * 4 + t * 1.3);
  const sup = th => { const c = cos(th), s = sin(th), r = rp(th); return [Math.sign(c) * Math.pow(Math.abs(c), 0.8) * r, -0.05 + 0.8 * Math.sign(s) * Math.pow(Math.abs(s), 0.8) * r]; };
  for (let i = 0; i <= 20; i++) raw.push(sup(-PI / 2 + (th1 + PI / 2) * i / 20));
  let lastX = 0.80;
  for (let i = 3; i >= 0; i--) {
    const L = legs ? legs[i] : null, len = 0.42 + (L ? L.dl : 0) + 0.015 * sin(t * 1.5 + i * 1.7), dx = L ? L.dx : 0, xi = LEGX[i], bend = LEGB[i] + dx, w = 0.17, xr = xi + w, xl = xi - w;
    const n = Math.max(2, Math.round((lastX - xr) / 0.08)); for (let k = 1; k <= n; k++) { const x = lastX + (xr - lastX) * k / n; raw.push([x, yBase(x)]); }
    const tipY = 0.45 + len;
    raw.push([xr + bend * 0.5, (yBase(xr) + tipY) / 2]);
    raw.push(...arcPts(xi + bend, tipY, w, 0, PI, 8));
    raw.push([xl + bend * 0.5, (yBase(xl) + tipY) / 2]);
    raw.push([xl, yBase(xl)]);
    lastX = xl;
  }
  const n2 = Math.max(2, Math.round((lastX + 0.80) / 0.08)); for (let k = 1; k <= n2; k++) { const x = lastX + (-0.80 - lastX) * k / n2; raw.push([x, yBase(x)]); }
  const a0 = PI - th1; for (let i = 0; i < 21; i++) raw.push(sup(a0 + (PI * 1.5 - a0) * i / 21));
  return remuestrear(raw);
}
const rrPts = (x0, y0, x1, y1, r) => [[(x0 + x1) / 2, y0], ...arcPts(x1 - r, y0 + r, r, -PI / 2, 0, 5), ...arcPts(x1 - r, y1 - r, r, 0, PI / 2, 5), ...arcPts(x0 + r, y1 - r, r, PI / 2, PI, 5), ...arcPts(x0 + r, y0 + r, r, PI, PI * 1.5, 5)];
const ellPts = (cx, cy, rx, ry, n = 48) => { const o = []; for (let i = 0; i < n; i++) { const a = -PI / 2 + i / n * 2 * PI; o.push([cx + cos(a) * rx, cy + sin(a) * ry]); } return o; };
function gruesa(P, r) { // contorno de una polilinea con grosor r (extremos redondos), en sentido horario
  const d = [], n = []; for (let i = 0; i < P.length - 1; i++) { const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dy); d.push([dx / l, dy / l]); n.push([dy / l, -dx / l]); }
  const out = [], m = P.length - 1;
  out.push([P[0][0] + n[0][0] * r, P[0][1] + n[0][1] * r]);
  for (let i = 1; i < m; i++) { const k = 1 + n[i - 1][0] * n[i][0] + n[i - 1][1] * n[i][1]; out.push([P[i][0] + (n[i - 1][0] + n[i][0]) / k * r, P[i][1] + (n[i - 1][1] + n[i][1]) / k * r]); }
  const an = Math.atan2(n[m - 1][1], n[m - 1][0]); out.push(...arcPts(P[m][0], P[m][1], r, an, an + PI, 8));
  for (let i = m - 1; i >= 1; i--) { const k = 1 + n[i - 1][0] * n[i][0] + n[i - 1][1] * n[i][1]; out.push([P[i][0] - (n[i - 1][0] + n[i][0]) / k * r, P[i][1] - (n[i - 1][1] + n[i][1]) / k * r]); }
  const a2 = Math.atan2(-n[0][1], -n[0][0]); out.push(...arcPts(P[0][0], P[0][1], r, a2, a2 + PI, 8));
  let k0 = 0; out.forEach((p, i) => { if (p[1] < out[k0][1]) k0 = i; }); return out.slice(k0).concat(out.slice(0, k0));
}
const PTS = {};
function ptsFijo(n) {
  if (PTS[n]) return PTS[n];
  let r;
  if (n === 'hoja') r = rrPts(-0.80, -0.95, 0.80, 1.0, 0.12);
  else if (n === 'avion') r = [[-0.8, -0.62], [1, 0], [-0.8, 0.62], [-0.40, 0]];
  else if (n === 'check') r = gruesa([[-0.75, 0.05], [-0.25, 0.55], [0.85, -0.55]], 0.17);
  else if (n === 'viga') r = [[0, -0.78], [1, -0.78], [1, -0.48], [0.2, -0.48], [0.2, 0.48], [1, 0.48], [1, 0.78], [-1, 0.78], [-1, 0.48], [-0.2, 0.48], [-0.2, -0.48], [-1, -0.48], [-1, -0.78]];
  else if (n === 'pesa') { const R = [[0, -0.30], [0.40, -0.30], [0.40, -0.10], [0.50, -0.10], [0.50, -0.78], [0.72, -0.78], [0.72, -0.55], [0.92, -0.55], [0.92, 0.55], [0.72, 0.55], [0.72, 0.78], [0.50, 0.78], [0.50, 0.10], [0.40, 0.10], [0.40, 0.30], [0, 0.30]];
    r = [...R, ...R.slice(1, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => [x * 1.22, y * 1.05]); }
  else if (n === 'reloj') { const R = [[0, -0.92], [0.78, -0.92], [0.78, -0.78], [0.66, -0.78], [0.64, -0.62], [0.55, -0.40], [0.38, -0.19], [0.15, -0.05], [0.10, 0], [0.15, 0.05], [0.38, 0.19], [0.55, 0.40], [0.64, 0.62], [0.66, 0.78], [0.78, 0.78], [0.78, 0.92], [0, 0.92]];
    r = [...R, ...R.slice(1, -1).reverse().map(([x, y]) => [-x, y])]; }
  else if (n === 'coche') r = [[0, -0.52], [0.34, -0.52], [0.52, -0.40], [0.66, -0.08], [0.95, -0.02], [1.0, 0.05], [1.0, 0.30], [0.96, 0.40], [0.82, 0.45], ...arcPts(0.55, 0.45, 0.24, 0, PI, 8), [0.31, 0.45], [0, 0.45], [-0.31, 0.45], ...arcPts(-0.55, 0.45, 0.24, 0, PI, 8), [-0.79, 0.45], [-0.96, 0.40], [-1.0, 0.30], [-1.0, 0.05], [-0.95, -0.02], [-0.66, -0.08], [-0.52, -0.40], [-0.34, -0.52]];
  else if (n === 'buho') { r = []; const E = th => [0.78 * cos(th), 0.05 + 0.86 * sin(th)]; for (let i = 0; i <= 4; i++) r.push(E(-PI / 2 + (-1.0 + PI / 2) * i / 4)); r.push([0.62, -1.08], E(-0.45)); for (let i = 1; i <= 14; i++) r.push(E(-0.45 + (PI + 0.45 + 0.45) * i / 14)); r.push([-0.62, -1.08]); for (let i = 0; i < 4; i++) r.push(E(PI + 1.0 + (PI * 1.5 - PI - 1.0) * i / 4)); }
  else if (n === 'arco') r = [[0, -0.92], ...arcPts(0, -0.1, 0.82, -PI / 2, 0, 12), [0.82, 0.72], [0.34, 0.72], [0.34, -0.1], ...arcPts(0, -0.1, 0.34, 0, -PI, 12), [-0.34, 0.72], [-0.82, 0.72], ...arcPts(0, -0.1, 0.82, PI, PI * 1.5, 12)];
  else if (n === 'casita') r = [[0, -0.95], [0.40, -0.62], [0.40, -0.92], [0.64, -0.92], [0.64, -0.44], [1.0, -0.12], [0.84, -0.12], [0.84, 0.72], [-0.84, 0.72], [-0.84, -0.12], [-1.0, -0.12]];
  else if (n === 'charco') r = ellPts(0, 0.62, 1.15, 0.30);
  else if (n === 'punto') r = ellPts(0, 0.1, 0.12, 0.12, 16);
  else if (n === 'teclado') r = rrPts(-1.9, -0.68, 1.9, 0.88, 0.28);
  else if (n === 'carga') r = ellPts(0, 0.1, 0.02, 0.02, 16);
  return (PTS[n] = remuestrear(r));
}
const ptsForma = (n, t, wob, legs) => n === 'bicho' ? ptsBicho(t, wob, legs) : ptsFijo(n);
const INFO = {
  bicho: { a: 1, eyes: 1, ey: -0.12, pitch: 0.082, kb: 0, hoja: 0, fw: 1 }, hoja: { a: 1, eyes: 1, ey: -0.55, pitch: 0.082, kb: 0, hoja: 1, fw: 0.6 },
  avion: { a: 1, eyes: 0, ey: -0.12, pitch: 0.082, kb: 0, hoja: 0, fw: 1 }, coche: { a: 1, eyes: 0, ey: -0.12, pitch: 0.082, kb: 0, hoja: 0, fw: 1 }, viga: { a: 1, eyes: 0, ey: -0.12, pitch: 0.082, kb: 0, hoja: 0, fw: 1 },
  pesa: { a: 1, eyes: 1, ey: -0.02, pitch: 0.05, kb: 0, hoja: 0, fw: 0.5 },
  reloj: { a: 1, eyes: 1, ey: -0.42, pitch: 0.046, kb: 0, hoja: 0, fw: 0.55 },
  buho: { a: 1, eyes: 1, ey: -0.12, pitch: 0.075, kb: 0, hoja: 0, fw: 0.88 }, charco: { a: 1, eyes: 1, ey: 0.62, pitch: 0.058, kb: 0, hoja: 0, fw: 1 }, punto: { a: 1, eyes: 0, ey: 0.1, pitch: 0.05, kb: 0, hoja: 0, fw: 1 },
  arco: { a: 1, eyes: 0, ey: -0.12, pitch: 0.08, kb: 0, hoja: 0, fw: 1 }, casita: { a: 1, eyes: 1, ey: 0.22, pitch: 0.068, kb: 0, hoja: 0, fw: 0.9 },
  teclado: { a: 0.30, eyes: 0, ey: -0.12, pitch: 0.082, kb: 1, hoja: 0, fw: 1 }, carga: { a: 0, eyes: 0, ey: 0.1, pitch: 0.05, kb: 0, hoja: 0, fw: 1 }, check: { a: 1, eyes: 0, ey: 0, pitch: 0.06, kb: 0, hoja: 0, fw: 1 },
};
function pathPts(p) { const P = new Path2D(), n = p.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(p[n - 1], p[0]); P.moveTo(m0[0], m0[1]); for (let i = 0; i < n; i++) { const q = p[i], m = mid(q, p[(i + 1) % n]); P.quadraticCurveTo(q[0], q[1], m[0], m[1]); } P.closePath(); return P; }

// ---------- ojos de matriz 6x6 ----------
const HAPPY = new Set([8, 9, 13, 16, 18, 23]), XX = new Set([7, 10, 14, 15, 20, 21, 25, 28].map(v => v));
// X dentro de 6x6 (filas 1..4): (1,1)=7 (1,4)=10 (2,2)=14 (2,3)=15 (3,2)=20 (3,3)=21 (4,1)=25 (4,4)=28
const PAT = (() => { const H = ['011011', '111111', '111111', '011110', '001100', '000000'], Hs = ['000000', '010010', '011110', '011110', '001100', '000000'], St = ['001100', '001100', '111111', '011110', '011110', '110011'], Ss = ['000000', '000000', '001100', '011110', '001100', '000000'],
  Gt = ['110000', '001100', '000011', '001100', '110000', '000000'], Lt = ['000011', '001100', '110000', '001100', '000011', '000000'], Dos = ['000000', '001100', '001100', '000000', '001100', '001100'], Par = ['011000', '000100', '000010', '000010', '000100', '011000'], O = ['011110', '110011', '100001', '100001', '110011', '011110'];
  return { heart: [H, H], heartS: [Hs, Hs], star: [St, St], starS: [Ss, Ss], strain: [Gt, Lt], smile: [Dos, Par], wow: [O, O] }; })();
function celdaObj(expr, r, c, side, E) {
  const i = r * 6 + c;
  if (PAT[expr]) return PAT[expr][side < 0 ? 0 : 1][r][c] === '1' ? 1 : 0;
  if (expr === 'noise') return hh(i * 1.37 + side * 11 + E.seed * 3.1) > 0.45 ? 1 : 0;
  if (expr === 'wink' && side > 0) return HAPPY.has(i) ? 1 : 0;
  if (expr === 'happy') return HAPPY.has(i) ? 1 : 0;
  if (expr === 'x') return XX.has(i) ? 1 : 0;
  if (expr === 'sleep') return r === 3 ? 0.75 : 0;
  const dx = c - 2.5, dy = r - 2.5;
  if (dx * dx + dy * dy > 9.6) return 0;
  const inner = side < 0 ? dx : -dx, cut = E.lid * 6 + E.tilt * inner * 0.9 - 0.2;
  if (r < cut) return 0.04;
  if (Math.abs(dy) > Math.max(0.16, E.open) * 3.4) return 0;
  const pd = Math.hypot(c - (2.5 + E.px * 1.3), r - (2.5 + E.py * 1.3));
  return pd < 0.9 ? 1 : Math.max(0.5, 1 - (pd - 0.9) * 0.3);
}
function spriteLed(col) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, rgba(col, .55)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = col === ROJO ? '#FFE0DB' : '#FFF1E6'; x.beginPath(); x.roundRect(21, 21, 22, 22, 5); x.fill();
  return c;
}

export function crearMascota(canvas, op = {}) {
  const O = Object.assign({ vista: 0.85, sombra: true, transparente: false, calidad: 1, volverForma: 6, hogar: [0, 0.04], volumen: true, giro: 0 }, op);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  const SPR = { cian: spriteLed(BASE), rojo: spriteLed(ROJO) };
  const HX = O.hogar[0], HY = O.hogar[1], S0 = 0.40, GROUND = -0.62;
  const S = { x: new Muelle(HX, 120, .8), y: new Muelle(HY, 120, .8), s: new Muelle(1, 160, .8), r: new Muelle(0, 140, .8), sx: new Muelle(0, 220, .75), sy: new Muelle(0, 220, .75) };
  let tiempo = 0, est = 'reposo', t0 = 0, formaSel = null, formaT = 0, wob = 0, col = BASE.slice(), colT = BASE;
  let puntero = null, arrastre = null, atentoOn = false, vozN = 0, proxVoz = 0, np = 1, durProy = 4, cerrar = 0;
  let gesto = null, proxGesto = 7, proxParp = 2, parp = -1, tapT = -9, fasePrev = -1;
  let congelado = 0, dimv = 0, shapeTo = 'bicho', morphU = 1, morphDur = 0.5, fromPts = null, fromInfo = null, ptsActual = null, infoActual = { ...INFO.bicho };
  const E = { expr: 'n', lid: 0, tilt: 0, open: 1, px: 0, py: 0, rojo: 0 }, ELook = { x: 0, y: 0 };
  let yawGK = 0, volOn = !!O.volumen, giroBase = O.giro || 0, visorOjos = O.visor; const YAW = new Muelle(0, 55, 0.62);
  const celdas = new Float32Array(72);
  const burb = Array.from({ length: 8 }, () => ({ a: 0, x: 0, y: 0, r: 0, v: 0, e: 0, vida: 1, ph: 0 })); let bi = 0, proxBurb = 0;
  const ondasVoz = []; const gotas = []; const teclas = []; let proxTecla = 0, teclaN = 0;
  const ladr = Array.from({ length: 15 }, () => ({ s: 0, caida: 0 })); let glow = 0;
  const part = []; // gotas rojas del error
  let minis = []; // [{x,y,s}] bichitos extra (web / proyectos / partir)
  let act = 0.3, tapLeg = 0, hopY = 0, legsA = [0, 1, 2, 3].map(() => ({ dl: 0, dx: 0 })), flashT = -9, wordLeft = 0, snortT = -9, spinA = 0, snortPend = false;
  const zs = []; let proxZ = 0;
  // espontaneas y escuchando
  let esp = null, espOn = O.espontaneas !== false, proxEsp = rnd(25, 70), ultEsp = '', esAvatar = false, lastT = null;
  let rotX = 0, eyeK = 1, eyeKt = 1, shiver = 0, zapK = 0, vib = 0, pulso = 0, ultVoz = -9, vPrev = 0, proxAnillo = 0, proxBlink = 0; const anillos = [];
  let relojP = null, enfadoN = 0, enfK = 0, proxVapor = 0, arenaK = 0, arenaV = 1; const vapor = [];

  // ----- tamano -----
  let calidad = O.calidad, W = 300, H = 300, pxu = 100;
  function tamano() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    esAvatar = r.width > 0 && r.width <= 64;
    const k = Math.max(dpr, r.width < 120 ? 3 : 1) * calidad;
    const w = Math.max(16, Math.round(r.width * k)), h = Math.max(16, Math.round(r.height * k));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    W = canvas.width; H = canvas.height; pxu = H / (2 * O.vista);
  }
  const ro = new ResizeObserver(tamano); ro.observe(canvas); tamano();
  const px = x => W / 2 + x * pxu, py = y => H / 2 - y * pxu;

  function entrar(n) {
    if (est === 'dormir' && n !== 'dormir') { wob = 1; S.sy.v += 2.2; S.sx.v += 1.6; }
    est = n; t0 = tiempo; gesto = null; fasePrev = -1; minis = []; gotas.length = 0; part.length = 0; if (n !== 'dormir') zs.length = 0;
        if (n === 'comando') { teclas.length = 0; proxTecla = tiempo + 0.35; }
    wob = Math.max(wob, 0.4); S.sy.v -= 0.9; S.sx.v += 0.5; flashT = tiempo + 0.05; wordLeft = 0; if (n === 'reposo') { proxGesto = tiempo + rnd(3, 6); proxEsp = Math.max(proxEsp, tiempo + 8); }
    esp = null; if (n === 'escuchando') { vib = 0; ultVoz = -9; vPrev = 0; anillos.length = 0; }
  }

  // ----- objetivos por estado -----
  function objetivos(dt) {
    const t = tiempo - t0;
    const T = { f: 'bicho', x: HX, y: HY, s: 1, r: 0, sy: 0, sx: 0, ex: 'n', look: null, lid: 0, tilt: 0, vis: 1, alpha: 1, frozen: 0, brillo: 1 };
    colT = BASE; hopY = 0; rotX = 0; eyeKt = 1; shiver = 0; zapK = 0; tapLeg = 0; E.rojo = 0; legsA.forEach(l => { l.dl = 0; l.dx = 0; });
    switch (est) {
      case 'reposo': {
        T.s = 1 + 0.015 * Math.sin(tiempo * 1.6); T.sy = 0.012 * Math.sin(tiempo * 1.6);
        if (atentoOn) { T.x += 0.09; T.y -= 0.07; T.r = -0.2; T.look = [0.8, -0.9]; }
        if (formaSel) { T.f = formaSel; if (tiempo - formaT > O.volverForma) formaSel = null; }
        else if (relojP !== null) { T.f = 'reloj'; T.s = 1.3; T.arena = relojP; T.look = [0, 0.35]; }
        const finG = () => { gesto = null; proxGesto = tiempo + rnd(4, 10); };
        if (!formaSel && relojP === null && !gesto && !esp && tiempo > proxGesto && !arrastre) { const tp = ['mirar', 'mirar', 'estirar', 'patitas', 'salto', 'rascar', 'partir']; gesto = { tipo: tp[Math.floor(Math.random() * tp.length)], t0: tiempo, lado: Math.random() < 0.5 ? -1 : 1 }; if (gesto.tipo === 'salto') S.sy.v += 1.0; }
        if (gesto) {
          const g = gesto, u = tiempo - g.t0;
          if (g.tipo === 'mirar') { const d = 2.4; T.look = u < 0.8 ? [g.lado, 0.05] : u < 1.5 ? [-g.lado, 0.1] : [0.2, -0.85]; T.r = (u < 0.8 ? g.lado : u < 1.5 ? -g.lado : 0) * 0.035; if (u > d) finG(); }
          if (g.tipo === 'estirar') { const d = 1.8, k = Math.sin(Math.PI * clamp(u / d, 0, 1)); T.sx = 0.11 * k; T.x += g.lado * 0.07 * k; T.look = [g.lado, 0.1]; legsA[g.lado > 0 ? 3 : 0].dx = g.lado * 0.22 * k; legsA[g.lado > 0 ? 3 : 0].dl = 0.1 * k; if (u > d) finG(); }
          if (g.tipo === 'patitas') { const d = 1.7, e = Math.sin(Math.PI * clamp(u / d, 0, 1)); for (let i = 0; i < 4; i++) { legsA[i].dl = 0.09 * Math.sin(u * 11 + i * 1.6) * e; legsA[i].dx = 0.03 * Math.sin(u * 8 + i) * e; } T.look = [Math.sin(u * 3) * 0.5, 0.2]; if (u > d) finG(); }
          if (g.tipo === 'salto') { const d = 0.72, q = clamp(u / d, 0, 1); hopY = 0.17 * 4 * q * (1 - q); T.sy = 0.08 * Math.sin(Math.PI * q); legsA[1].dl = legsA[2].dl = -0.08 * Math.sin(Math.PI * q); if (u > d) { S.sy.v -= 1.2; wob = Math.max(wob, 0.3); finG(); } }
          if (g.tipo === 'rascar') { const d = 2.1, e = Math.sin(Math.PI * clamp(u / d, 0, 1)), i = g.lado > 0 ? 3 : 0; legsA[i].dl = -0.36 * e; legsA[i].dx = -g.lado * 0.30 * e + 0.05 * Math.sin(u * 22) * e; T.r = -g.lado * 0.07 * e; T.look = [g.lado * 0.6, -0.1]; if (u > d) finG(); }
          if (g.tipo === 'partir') { const d = 2.6, k = Math.sin(Math.PI * clamp(u / d, 0, 1)); T.s = 1 - 0.3 * k; minis = [-1, 1].map(sg => ({ x: T.x + sg * (0.55 * ease(k)), y: T.y - 0.02, s: 0.32 * ease(Math.min(1, k * 3)) })); if (u > d) finG(); }
        }
        if (esp && (atentoOn || arrastre || formaSel || (relojP !== null && esp.n !== 'reloj'))) esp = null;
        if (!esp && espOn && !gesto && !formaSel && relojP === null && !arrastre && !atentoOn && tiempo > proxEsp) iniciarEsp(elegirEsp());
        if (esp) aplicarEsp(T);
        break; }
      case 'escuchando': {
        const sil = tiempo - ultVoz, hab = vozN > 0.06, nod = Math.sin(t * (2.2 + 4 * vozN));
        T.s = 1.06 + 0.03 * vozN; T.y = HY - 0.05 - 0.02 * vozN; T.r = -0.07 + 0.025 * nod * (0.4 + vozN); T.sy = -0.035 + 0.02 * vozN * nod; T.sx = 0.03; T.look = [0.12 * Math.sin(t * 0.7), 0.05]; eyeKt = 1.24; T.lid = 0;
        for (let i = 0; i < 4; i++) { legsA[i].dl = 0.035 * Math.sin(tiempo * 5.5 + i * 1.3) * (0.35 + vozN); legsA[i].dx = 0.015 * Math.sin(tiempo * 4 + i); }
        if (!hab && ultVoz > 0 && sil < 2.2) { const k = ease(clamp((sil - 0.25) / 0.5, 0, 1)); T.r += 0.12 * k; T.look = [0.1, -0.35 * k]; T.sy = -0.01; T.s = 1.03; }
        break; }
      case 'pensar': {
        const PER = 10.4, tm = t % PER; T.s = 1 + 0.02 * Math.sin(tiempo * 2); T.x = HX + 0.012 * Math.sin(t * 1.3);
        if (tiempo > proxBurb) { proxBurb = tiempo + rnd(0.28, 0.6); const b = burb[bi++ % 8]; b.a = 1; b.x = S.x.x + rnd(-0.2, 0.2); b.y = S.y.x + 0.32; b.r = rnd(0.022, 0.05); b.v = rnd(0.2, 0.34); b.e = 0; b.vida = rnd(1.1, 1.9); b.ph = rnd(0, 6); b.vx = 0; }
        if (tm < 3.6) { const per = 1.8, n = Math.floor(tm / per), q = (tm % per) / per; T.spin = (n + ease(clamp(q / 0.38, 0, 1))) * Math.PI; T.look = [0.3 * Math.sin(t * 0.8), -1]; }
        else if (tm < 7.0) {
          T.f = 'carga'; const a0 = (tm - 3.8) * 5.2, R = 0.30 * ease(clamp((tm - 3.8) / 0.6, 0, 1)) * (1 - ease(clamp((tm - 6.4) / 0.6, 0, 1)));
          minis = []; for (let i = 0; i < 8; i++) { const a = a0 - i * TAU / 8; minis.push({ x: T.x + Math.cos(a) * R, y: T.y + 0.04 + Math.sin(a) * R, s: 1, drop: 0.028 + 0.05 * (1 - i / 8) }); }
        }
        else if (tm < 10.0) { T.look = tm < 8.6 ? [-0.8, -0.9] : [0.7, -0.6]; T.lid = 0.12; T.tilt = 0.3; T.r = 0.05 * Math.sin(tm * 1.1); }
        else T.spin = 2 * Math.PI;
        break; }
      case 'leer': {
        T.f = 'hoja'; T.y = HY - 0.02; const per = 1.8, q = (t % per) / per; T.look = [-1 + 2 * ease(clamp(q * 1.15, 0, 1)), 0.2]; T.scan = HY + 0.40 - 0.8 * ((t % 2.4) / 2.4);
        break; }
      case 'escribir': {
        T.s = 0.5; T.x = 0; T.y = 0.44; T.look = [0, 1]; T.comp = 'escribir';
        const P = 8.6, tm = t % P;
        for (let k = 0; k < 15; k++) { const tl = 0.3 + 0.17 * k, q = tm - (tl + 0.30); ladr[k].s = q >= 0 ? (1 - (1 + 13 * q) * Math.exp(-13 * q)) * (1 - ease(clamp((tm - 7.9) / 0.6, 0, 1))) : 0; ladr[k].q = q; ladr[k].caida = (tm > tl && tm < tl + 0.30) ? (tm - tl) / 0.30 : -1; }
        glow = clamp((tm - 3.6) / 0.6, 0, 1) * (1 - clamp((tm - 7.9) / 0.6, 0, 1));
        T.sy = 0.04 * Math.sin(t * 5);
        break; }
      case 'comando': {
        T.s = 1; T.look = [0, 1]; T.f = 'teclado';
        if (tiempo > proxTecla && t > 0.7) {
          if (wordLeft <= 0) { wordLeft = 3 + Math.floor(rnd(0, 4)); proxTecla = tiempo + rnd(0.3, 0.7); teclas.push({ r: 4, i: 0, t: tiempo }); }
          else { wordLeft--; proxTecla = tiempo + rnd(0.07, 0.16); const r = Math.floor(rnd(0, 4)); teclas.push({ r, i: Math.floor(rnd(0, FILAS[r][0])), t: tiempo }); }
          if (teclas.length > 14) teclas.shift();
        }
        break; }
      case 'web': {
        const per = 4.6, q = (t % per) / per; T.s = 0.55; T.web = 1;
        const R = 0.52 * ease(clamp(q / 0.24, 0, 1)) * (1 - ease(clamp((q - 0.74) / 0.24, 0, 1)));
        minis = [0, 1].map(i => { const a = i * Math.PI + t * 1.3 + 0.6, dotA = clamp((q - (0.36 + 0.07 * i)) / 0.05, 0, 1) * (1 - clamp((q - 0.97) / 0.03, 0, 1)); return { x: T.x + Math.cos(a) * R * 1.25, y: T.y + 0.02 + Math.sin(a) * R * 0.75, s: 0.55, dot: dotA }; });
        break; }
      case 'esperando': {
        T.ex = 'n'; let lid = 0.14, tilt = 0.45;
        if (t > 4.5) {
          const tc = (t - 4.5) % 6.2; lid = 0.30; tilt = 0.7;
          if (tc < 1.6) { tapLeg = Math.abs(Math.sin(tc / 1.6 * Math.PI * 5)); T.look = [0, 0.1]; if (tc % 0.32 < 0.04 && tapT < tiempo - 0.25) { tapT = tiempo; S.sy.v -= 0.35; } }
          else if (tc < 2.8) { const w = (tc - 1.6) / 1.2, sw = Math.sin(w * TAU); T.x = HX + 0.035 * sw; T.r = -0.05 * sw; (sw > 0 ? legsA[3] : legsA[0]).dl = -0.08 * Math.abs(sw); T.look = [0.6 * sw, 0.2]; }
          else if (tc < 3.9) { T.look = [0, 0]; lid = 0.36; if (tc > 3.2 && !snortPend) { snortPend = true; const b = burb[bi++ % 8]; b.a = 1; b.x = S.x.x + 0.30; b.y = S.y.x + 0.0; b.r = 0.034; b.v = 0.10; b.vx = 0.22; b.e = 0; b.vida = 1.0; b.ph = 0; S.sx.v += 0.9; wob = Math.max(wob, 0.25); } }
          else if (tc < 5.4) { snortPend = false; const w = (tc - 3.9) / 1.5, env = Math.sin(Math.PI * clamp(w * 1.25, 0, 1)); legsA[3].dl = -0.30 * env; legsA[3].dx = -0.24 * env; T.look = [0.8 * env, 0.9 * env]; lid = 0.22; }
          else { tapLeg = Math.abs(Math.sin((tc - 5.4) / 0.8 * Math.PI * 3)); T.look = [0, 0.1]; }
        }
        else if (t > 2.4 && t < 3.6) { lid = 0.1; tilt = 0.15; }
        T.lid = lid; T.tilt = tilt; if (t <= 4.5) T.look = null; break; }
      case 'enviar': {
        const TV = 2.4;
        if (t < 0.5) { T.f = 'avion'; T.s = 0.9; T.x = HX - 0.05 * ease(t / 0.5); T.r = 0.12; }
        else if (t < TV) {
          const q = (t - 0.5) / (TV - 0.5), A = [0.25, 0.28], C = [0.25, 0.48], Rr = 0.20; let X, Y, ang;
          if (q < 0.28) { const f = ease(q / 0.28); X = lerp(HX - 0.05, A[0], f); Y = lerp(HY, A[1], f); ang = Math.atan2(A[1] - HY, A[0] - HX + 0.05) * 0.9; }
          else if (q < 0.68) { const th = (q - 0.28) / 0.40 * TAU; X = C[0] + Rr * Math.sin(th); Y = C[1] - Rr * Math.cos(th); ang = th + Math.atan2(A[1] - HY, A[0] - HX + 0.05) * 0.9 * (1 - (q - 0.28) / 0.40); }
          else { const f = (q - 0.68) / 0.32; X = A[0] + (1.7 - A[0]) * f * f; Y = A[1] + (1.15 - A[1]) * f * f; ang = Math.atan2(1.15 - A[1], 1.7 - A[0]) * (0.4 + 0.6 * Math.min(1, f * 2)); }
          T.f = 'avion'; T.s = 0.85; T.x = X; T.y = Y; T.r = ang; S.x.x = X; S.y.x = Y; S.x.v = S.y.v = 0; S.r.x = ang; S.r.v = 0;
        }
        else if (t < TV + 1.0) { T.f = 'bicho'; if (fasePrev !== 2) { fasePrev = 2; S.s.x = 1; S.s.v = 0; S.x.x = HX; S.y.x = HY; S.x.v = S.y.v = 0; S.r.x = 0; S.r.v = 0; empezarMorph('bicho', 0.62, 'punto'); } }
        else entrar('reposo');
        break; }
      case 'hecho': {
        T.ex = 'happy';
        if (t < 0.4) { const q = t / 0.4; hopY = 0.24 * 4 * q * (1 - q); T.sy = 0.09 * Math.sin(Math.PI * q); }
        else if (t < 1.6) { if (fasePrev !== 1) { fasePrev = 1; S.sy.v -= 1.6; wob = Math.max(wob, 0.4); } T.check = clamp((t - 0.4) / 0.25, 0, 1); }
        else entrar('reposo');
        break; }
      case 'error': {
        colT = ROJO; E.rojo = 1; T.ex = 'x';
        if (t < 1.7) { T.f = 'charco'; T.x = HX + 0.008 * sin(t * 50) * Math.exp(-t); if (fasePrev !== 1) { fasePrev = 1; for (let i = 0; i < 11; i++) part.push({ x: HX + rnd(-0.3, 0.3), y: HY - 0.2 + rnd(-0.03, 0.03), vx: rnd(-0.3, 0.3), vy: rnd(0, 0.3), r: rnd(0.012, 0.04), age: -(0.35 + rnd(0, 0.5)) }); } }
        else if (t < 2.7) { T.f = 'bicho'; const rc = ease(clamp((t - 1.7) / 0.9, 0, 1)); colT = mezcla(ROJO, BASE, rc); E.rojo = 1 - rc; T.ex = rc > 0.5 ? 'n' : 'x'; }
        else entrar('reposo');
        break; }
      case 'parado': { T.frozen = 1; T.ex = 'sleep'; T.brillo = 1; wob = Math.min(wob, 0.02); break; }
      case 'dormir': { T.ex = 'sleep'; T.s = 0.94 + 0.03 * Math.sin(tiempo * 0.7); T.y = HY - 0.05; T.dim = 1; if (tiempo > proxZ) { proxZ = tiempo + 1.35; zs.push({ t: tiempo }); } break; }
      case 'proyectos': {
        const n = np, k = t < 0.7 ? ease(t / 0.7) : (t > durProy ? 1 - ease(clamp((t - durProy) / 0.7, 0, 1)) : 1);
        const s = n === 2 ? 0.62 : n === 3 ? 0.5 : 0.42, sx = i => (i - (n - 1) / 2) * 0.62;
        T.s = lerp(1, s, k); T.x = lerp(HX, sx(0), k); T.y = HY + 0.02 * Math.sin(t * 2) * k;
        minis = []; for (let i = 1; i < n; i++) minis.push({ x: lerp(HX, sx(i), k), y: HY + 0.02 * Math.sin(t * 2 + i * 1.7) * k, s: s * k, i });
        if (t > durProy + 0.7) entrar('reposo');
        break; }
    }
    enfK += (enfadoN - enfK) * Math.min(1, dt * 3);
    if (enfK > 0.004 && est !== 'dormir' && est !== 'parado') {
      const kk = clamp(enfK * 1.05, 0, 1); colT = mezcla(colT, mezcla(BASE, ROJO, kk), Math.min(1, enfK * 4)); E.rojo = Math.max(E.rojo, enfK);
      T.tilt = Math.max(T.tilt, 0.5 * enfK); if (T.ex === 'n' && enfK > 0.3) T.ex = 'strain';
      shiver = Math.max(shiver, 0.55 * enfK); wob = Math.max(wob, 0.12 * enfK); T.sy -= 0.03 * enfK;
    }
    return T;
  }

  // ----- animaciones espontaneas (solo en reposo, cada 25-70 s; una distinta a la anterior) -----
  const env = (u, a, b, c) => ease(clamp(u / a, 0, 1)) * (1 - ease(clamp((u - b) / (c - b), 0, 1)));
  function linea(P, a, w = 1, col = BASE) { // polilinea en coordenadas de mundo: halo + nucleo blanco, fina y nitida
    if (a <= 0.01 || P.length < 2) return; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = a;
    for (const [lw, al, cc] of [[5 * w, .30, col], [1.6 * w, 1, [255, 242, 222]]]) { ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1]))); ctx.strokeStyle = rgba(cc, al); ctx.lineWidth = Math.max(1, pxu * 0.0045 * lw); ctx.stroke(); }
    ctx.restore();
  }
  function rayoLin(x0, y0, x1, y1, seed, n = 8, amp = 0.05, w = 1.4) { const P = [[x0, y0]]; for (let q = 1; q < n; q++) { const f = q / n; P.push([lerp(x0, x1, f) + (hh(seed + q * 3.1) - .5) * amp, lerp(y0, y1, f) + (hh(seed + q * 5.3) - .5) * amp]); } P.push([x1, y1]); linea(P, 1, w); }
  function tentaculo(x0, y0, cx, cy, x1, y1, a, w = 2.2) { const P = []; for (let i = 0; i <= 12; i++) { const f = i / 12, g = 1 - f; P.push([g * g * x0 + 2 * g * f * cx + f * f * x1, g * g * y0 + 2 * g * f * cy + f * f * y1]); } linea(P, a, w); }
  function glifo(pat, x, y, cs, al) { if (al <= 0.01) return; const sz = cs * 2.7, nr = pat.length, nc = pat[0].length; ctx.save(); ctx.globalAlpha = al; for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) if (pat[r][c] === '1') ctx.drawImage(SPR.cian, x + (c - (nc - 1) / 2) * cs * 1.15 - sz / 2, y + (r - (nr - 1) / 2) * cs * 1.15 - sz / 2, sz, sz); ctx.restore(); }
  function burbuja(x, y, r, a) { const X = px(x), Y = py(y), R = r * pxu; if (R < 1) return; ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fillStyle = 'rgba(240,194,75,.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,238,215,.95)'; ctx.lineWidth = Math.max(1, pxu * 0.0045); ctx.stroke(); ctx.beginPath(); ctx.arc(X, Y, R * 0.8, PI * 1.15, PI * 1.55); ctx.lineWidth = Math.max(1, pxu * 0.007); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke(); ctx.beginPath(); ctx.arc(X + R * 0.45, Y + R * 0.4, R * 0.08, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); ctx.restore(); }
  const PLANO = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], [[0.42, 0], [0.42, 0.58], [0, 0.58]], [[0.42, 0.58], [1, 0.58]], [[0.72, 0.58], [0.72, 1]], [[0.1, 1], [0.1, 0.86], [0.26, 0.86]], [[0.8, 0], [0.8, 0.12], [0.96, 0.12]]];
  const PLANO_L = PLANO.map(P => P.reduce((s, p, i) => i ? s + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0, 0)), PLANO_T = PLANO_L.reduce((a, b) => a + b, 0);
  const KPESA = [[0, 0], [1.4, 0], [2.0, 2], [2.4, 2], [3.0, 1], [3.2, 1], [3.9, 2], [4.9, 2], [5.1, 0], [6.0, 0]];
  const nivelPesa = u => { for (let i = 0; i < KPESA.length - 1; i++) { const a = KPESA[i], b = KPESA[i + 1]; if (u >= a[0] && u <= b[0]) { const f = (u - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], i === 7 ? f * f : ease(f)); } } return 0; };
  const mov = () => clamp(Math.abs(S.x.v) / 0.8, 0, 1);

  // ----- utensilios de las espontaneas nuevas (coordenadas de mundo) -----
  function discoNeon(x, y, w, h, ang, a) {
    const W2 = w * pxu, H2 = h * pxu; ctx.save(); ctx.globalAlpha = a; ctx.translate(px(x), py(y)); ctx.rotate(-ang);
    ctx.fillStyle = rgba(BASE, .12); ctx.beginPath(); ctx.roundRect(-W2 / 2 - 3, -H2 / 2 - 3, W2 + 6, H2 + 6, H2 * 0.6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-W2 / 2, -H2 / 2, W2, H2, H2 * 0.4); const gg = ctx.createLinearGradient(0, -H2 / 2, 0, H2 / 2); gg.addColorStop(0, 'rgba(255, 242, 222,.95)'); gg.addColorStop(1, 'rgba(240,194,75,.7)'); ctx.fillStyle = gg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, W2 * 0.05, H2 * 0.2, 0, 0, TAU); ctx.fillStyle = 'rgba(62,33,3,.65)'; ctx.fill(); ctx.restore();
  }
  function toallaD(cx, cy, hw, hh2, ang, sag, a) { // tira de toalla de lado a lado, con rayas
    const W2 = hw * pxu, H2 = hh2 * pxu, sg = sag * pxu; ctx.save(); ctx.globalAlpha = a; ctx.translate(px(cx), py(cy)); ctx.rotate(-ang); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const tr = () => { ctx.beginPath(); ctx.moveTo(-W2, -H2); ctx.quadraticCurveTo(0, -H2 + sg, W2, -H2); ctx.lineTo(W2, H2); ctx.quadraticCurveTo(0, H2 + sg, -W2, H2); ctx.closePath(); };
    tr(); ctx.strokeStyle = rgba(BASE, .25); ctx.lineWidth = Math.max(4, pxu * 0.03); ctx.stroke();
    tr(); const gg = ctx.createLinearGradient(0, -H2, 0, H2); gg.addColorStop(0, 'rgba(255, 243, 222,.97)'); gg.addColorStop(1, 'rgba(248,213,150,.92)'); ctx.fillStyle = gg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke();
    ctx.save(); tr(); ctx.clip(); ctx.strokeStyle = 'rgba(205,144,40,.85)'; ctx.lineWidth = Math.max(1, pxu * 0.006);
    for (const yy of [-0.45, 0.45]) { ctx.beginPath(); ctx.moveTo(-W2, yy * H2); ctx.quadraticCurveTo(0, yy * H2 + sg, W2, yy * H2); ctx.stroke(); } ctx.restore(); ctx.restore();
  }
  function vasoShaker(x, y, ang, nivel, sc, tapa) { // vaso agitador: trapecio, liquido con superficie horizontal y tapa que sale volando
    const h = 0.28 * sc * pxu, wt = 0.22 * sc * pxu, wb = 0.15 * sc * pxu, X = px(x), Y = py(y); if (h < 2) return;
    const cup = () => { ctx.beginPath(); ctx.moveTo(-wt / 2, -h / 2); ctx.lineTo(wt / 2, -h / 2); ctx.lineTo(wb / 2, h / 2); ctx.quadraticCurveTo(0, h / 2 + h * 0.06, -wb / 2, h / 2); ctx.closePath(); };
    ctx.save(); ctx.translate(X, Y); ctx.rotate(-ang); cup(); ctx.fillStyle = 'rgba(240,194,75,.10)'; ctx.fill();
    if (nivel > 0.02) {
      ctx.save(); cup(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      const ys = Y - (-h / 2 + nivel * h) * Math.cos(ang), lg = ctx.createLinearGradient(0, ys, 0, ys + h * 1.5); lg.addColorStop(0, 'rgba(255,236,210,.95)'); lg.addColorStop(1, 'rgba(235,178,70,.88)');
      ctx.fillStyle = lg; ctx.fillRect(X - h * 2, ys, h * 4, h * 3); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(X - h * 2, ys - 0.5, h * 4, Math.max(1.5, h * 0.05)); ctx.restore();
    }
    cup(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(240,194,75,.35)'; ctx.lineWidth = Math.max(4, pxu * 0.022); ctx.stroke(); ctx.strokeStyle = 'rgba(255, 243, 222,.98)'; ctx.lineWidth = Math.max(1.2, pxu * 0.006); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-wt * 0.30, -h * 0.30); ctx.lineTo(-wb * 0.30, h * 0.30); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, pxu * 0.005); ctx.stroke();
    ctx.restore();
    const tp = clamp(tapa, 0, 1); // tapa: puesta mientras se agita, sale volando al abrir
    if (tp < 0.98) { const cw = wt * 1.08, ch = h * 0.20, d = h / 2 + ch / 2; ctx.save(); ctx.globalAlpha = 1 - tp; ctx.translate(X - Math.sin(ang) * d + 0.22 * tp * pxu, Y - Math.cos(ang) * d - 0.28 * Math.sin(PI * tp * 0.8) * pxu + 0.2 * tp * tp * pxu); ctx.rotate(-ang - 2.2 * tp); ctx.beginPath(); ctx.roundRect(-cw / 2, -ch / 2, cw, ch, ch * 0.4); ctx.fillStyle = 'rgba(255, 241, 222,.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,194,75,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.005); ctx.stroke(); ctx.restore(); }
  }

  const ESP = {
    malabares: { dur: 6.6,
      a(g, u, T) { const e = env(u, .7, 5.8, 6.6), s = Math.sin(u * 5.6); T.look = [0.7 * Math.sin(u * 2.8) * e, -0.8 * e]; T.sy = 0.018 * s * e - (u < 0.5 ? 0.05 * Math.sin(Math.PI * u / 0.5) : 0); legsA[0].dl = -0.11 * e * Math.max(0, s); legsA[3].dl = -0.11 * e * Math.max(0, -s); legsA[0].dx = -0.08 * e; legsA[3].dx = 0.08 * e; },
      d(g, u, bx, by) { const e = env(u, .7, 5.8, 6.6); if (e < .02) return; const h = 0.22, hy = by + 0.14; for (let i = 0; i < 3; i++) { const ph = (u * 1.4 + i * 2 / 3) % 2, f = ph % 1, x = ph < 1 ? lerp(-h, h, f) : lerp(h, -h, f), y = hy + 0.44 * 4 * f * (1 - f); gotaPx(px(bx + x), py(y), 0.036 * pxu * e, false, e); } } },
    voltereta: { dur: 2.2,
      a(g, u, T) {
        if (u < 0.4) { const k = ease(u / 0.4); T.sy = -0.14 * k; T.sx = 0.08 * k; T.look = [0, -0.6]; }
        else if (u < 1.35) { const q = (u - 0.4) / 0.95; hopY = 0.27 * 4 * q * (1 - q); rotX = g.lado * TAU * ease(q); T.sy = 0.05 * Math.sin(PI * q); legsA.forEach(l => l.dl = -0.07 * Math.sin(PI * q)); if (!g.a) { g.a = 1; S.sy.v += 1.6; } }
        else { if (!g.b) { g.b = 1; S.sy.v -= 1.8; S.sx.v += 0.9; wob = Math.max(wob, .5); } if (u < 1.9) T.ex = 'happy'; } } },
    pompa: { dur: 3.8,
      a(g, u, T) { const L = g.lado;
        if (u < 2.3) { const k = ease(clamp((u - .4) / 1.9, 0, 1)); T.look = [L * 0.7, -0.2]; T.s = 1 - 0.05 * k; T.sx = -0.04 * k; T.lid = 0.08 * k; }
        else { if (!g.p) { g.p = 1; S.sx.v += L * 1.6; S.sy.v -= 1.2; wob = Math.max(wob, .8); flashT = tiempo; } T.look = [0, 0]; T.ex = u < 3.2 ? 'x' : 'happy'; } },
      d(g, u, bx, by) { const L = g.lado;
        if (u < 2.3) { if (u > 0.3) { const k = ease(clamp((u - .4) / 1.9, 0, 1)); burbuja(bx + L * (0.30 - 0.20 * k), by + 0.02 + 0.05 * k, 0.02 + 0.40 * k * (1 + 0.03 * Math.sin(u * 13)), 1); } }
        else { const v = u - 2.3; if (v < 0.5) { const f = v / 0.5; ctx.save(); ctx.globalAlpha = (1 - f) * 0.8; ctx.beginPath(); ctx.arc(px(bx + L * 0.1), py(by + 0.07), pxu * (0.42 + 0.35 * f), 0, TAU); ctx.strokeStyle = 'rgba(255,238,215,.95)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); }
          if (v < 0.8) for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3, d = 0.18 + 0.42 * ease(Math.min(1, v / 0.4)), x = bx + L * 0.1 + Math.cos(a) * d, y = by + 0.07 + Math.sin(a) * d - 0.5 * v * v; gotaPx(px(x), py(y), pxu * (0.012 + 0.01 * hh(i)) * (1 - v / 0.8), false, 1 - v / 0.8); } } } },
    arco: { dur: 3.9,
      a(g, u, T) { if (u < 0.4) { const k = ease(u / 0.4); T.sy = -0.12 * k; T.sx = 0.07 * k; } else if (u < 3.0) { T.f = 'arco'; T.s = 1.2; T.y = HY + 0.04; } },
      d(g, u, bx, by) { const e = env(u - 0.9, 0.4, 1.6, 2.1); if (e < .02) return; const s = S.s.x, hw = 0.82 * S0 * s, yd = by - 0.72 * S0 * s - 0.1, cy = by + 0.05 * s; ctx.save(); ctx.globalAlpha = e * 0.75; ctx.strokeStyle = 'rgba(255, 242, 222,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.003); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px(bx - hw), py(yd)); ctx.lineTo(px(bx + hw), py(yd)); for (const sg of [-1, 1]) { ctx.moveTo(px(bx + sg * hw) - 4, py(yd) + 4); ctx.lineTo(px(bx + sg * hw) + 4, py(yd) - 4); ctx.moveTo(px(bx + sg * hw), py(yd) - 7); ctx.lineTo(px(bx + sg * hw), py(yd) + 7); } ctx.stroke();
        ctx.setLineDash([3, 5]); ctx.globalAlpha = e * 0.45; ctx.beginPath(); ctx.moveTo(px(bx), py(yd) + 10); ctx.lineTo(px(bx), py(by + 0.92 * S0 * s + 0.08)); ctx.stroke();
        ctx.beginPath(); ctx.arc(px(bx), py(cy), hw * pxu, PI, TAU); ctx.stroke(); ctx.restore(); } },
    plano: { dur: 6.2,
      a(g, u, T) { const e = env(u, .5, 5.7, 6.2); legsA[3].dx = 0.30 * e; legsA[3].dl = -0.12 * e; T.look = [0.5 * e, 0.9 * e]; T.r = -0.03 * e; },
      d(g, u, bx, by) { const cx = bx - 0.05, cy = by + 0.60, w = 0.62, h = 0.30, al = 1 - ease(clamp((u - 5.0) / 0.8, 0, 1)); if (al < 0.02) return;
        const Lr = PLANO_T * ease(clamp((u - 0.9) / 3.4, 0, 1)); let acc = 0, pen = null; const W2 = p => [cx + (p[0] - 0.5) * w, cy + (0.5 - p[1]) * h];
        PLANO.forEach((P, k) => { if (Lr <= acc) return; const pts = [W2(P[0])]; let rest = Lr - acc; for (let i = 1; i < P.length; i++) { const sl = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (rest >= sl) { pts.push(W2(P[i])); rest -= sl; } else { const f = rest / sl; pts.push(W2([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)])); rest = 0; break; } } acc += PLANO_L[k]; if (pts.length > 1) { linea(pts, al, 1); pen = pts[pts.length - 1]; } });
        if (pen && Lr < PLANO_T) { tentaculo(bx + 0.24, by - 0.30, bx + 0.62, by - 0.02, pen[0], pen[1], al, 2); gotaPx(px(pen[0]), py(pen[1]), pxu * 0.012, false, al, [255, 242, 222]); } } },
    estornudo: { dur: 4.8,
      a(g, u, T) {
        if (u < 1.0) { const k = ease(u); T.s = 1 + 0.1 * k; T.sy = 0.06 * k; T.look = [0, -1]; T.lid = 0.1 * k; if (u > 0.5) T.ex = 'strain'; return; }
        if (!g.s) { g.s = 1; S.sx.v += 2; wob = 1; flashT = tiempo; }
        const k = ease(clamp((u - 1.0) / 0.4, 0, 1)) * (1 - ease(clamp((u - 3.1) / 0.9, 0, 1))), run = u > 1.4 && u < 3.3 ? 1 : 0, X = i => HX + [-0.38, 0.02, 0.38][i] * k + 0.09 * Math.sin(u * 2.7 + i * 2.1) * run * k, Y = i => HY + 0.14 * k + 0.03 * Math.abs(Math.sin(u * 13 + i * 1.9)) * k * run;
        T.s = 1 - 0.66 * k; T.x = X(0); T.y = Y(0); T.ex = u < 1.6 ? 'wow' : 'happy'; for (let i = 0; i < 4; i++) legsA[i].dl = 0.07 * Math.sin(u * 24 + i * 1.5) * run * k;
        minis = k > 0.02 ? [1, 2].map(i => ({ x: X(i), y: Y(i), s: 0.34 * k })) : []; },
      d(g, u, bx, by) { const v = u - 1.0; if (v < 0 || v > 0.7) return; for (let i = 0; i < 8; i++) { const x = bx + (hh(i) - .5) * 1.5 * v, y = by + 0.05 + (0.35 + 0.5 * hh(i + 3)) * v * (hh(i + 6) > .5 ? 1 : 0.4) - 1.3 * v * v; gotaPx(px(x), py(y), pxu * (0.011 + 0.01 * hh(i + 2)), false, 1 - v / 0.7); } if (v < 0.35) { ctx.save(); ctx.globalAlpha = (1 - v / 0.35) * 0.8; ctx.beginPath(); ctx.arc(px(bx), py(by + 0.05), pxu * (0.3 + 0.9 * v / 0.35), 0, TAU); ctx.strokeStyle = 'rgba(255,238,215,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); } } },
    rayo: { dur: 3.4,
      a(g, u, T) { T.look = [0, u < 1.5 ? -1 : 0.1]; zapK = u < 1.45 ? clamp((u - 0.5) / 0.9, 0, 1) * 0.7 : u < 2.6 ? 1 - (u - 1.45) / 1.15 : 0;
        if (u >= 1.45 && !g.z) { g.z = 1; flashT = tiempo; S.sy.v -= 1.8; S.sx.v += 1.0; wob = 1; }
        if (u >= 1.45 && u < 2.6) { T.ex = 'noise'; shiver = 1 - (u - 1.45) / 1.15; for (let i = 0; i < 4; i++) legsA[i].dl = 0.08 * Math.sin(u * 70 + i * 3) * shiver; } else if (u >= 2.6 && u < 3.0) T.ex = 'wow'; },
      d(g, u, bx, by) { const gx = bx, gy = by + 0.62;
        if (u < 1.65) { const k = ease(clamp(u / 0.7, 0, 1)); gotaPx(px(gx), py(gy), pxu * 0.034 * k, false, 1, [255, 242, 222]); if (u > 0.8) for (let q = 0; q < 2; q++) { const a = hh(Math.floor(u * 18) + q * 7) * TAU; rayoLin(gx, gy, gx + Math.cos(a) * 0.10, gy + Math.sin(a) * 0.10, Math.floor(u * 18) + q * 7, 3, 0.03, 1); } }
        const real = u > 1.45 && u < 1.65, tease = (u > 1.2 && u < 1.27) || (u > 1.0 && u < 1.06); if (real || tease) { const sd = Math.floor(u * 45); rayoLin(gx, gy, bx + 0.02, by + (real ? 0.34 : 0.50), sd, 9, 0.12, 1.6); if (real) rayoLin(gx - 0.02, gy - 0.12, bx + 0.2 * (hh(sd) - .5), by + 0.47, sd + 5, 5, 0.1, 1); }
        if (u > 1.45 && u < 1.8) chispas(px(bx), py(by + 0.34), pxu * 0.3, (u - 1.45) / 0.35, 7, 6); } },
    asomarse: { dur: 6.2,
      a(g, u, T) { const L = g.lado, hw = O.vista * W / H, hide = L * (hw + 0.5), pk = L * (hw - 0.06), pk2 = L * (hw - 0.26); let x = HX, look = null, ti = 0;
        if (u < 0.8) { x = lerp(HX, hide, ease(u / .8)); look = [L, 0]; } else if (u < 1.3) x = hide;
        else if (u < 2.1) { x = lerp(hide, pk, ease((u - 1.3) / .8)); look = [-L, .1]; ti = 1; } else if (u < 3.2) { x = pk; look = u < 2.6 ? [-L, 0.1] : [-L * 0.2, -0.2]; ti = 1; }
        else if (u < 3.6) x = lerp(pk, hide, ease((u - 3.2) / .4)); else if (u < 4.2) x = hide;
        else if (u < 4.7) { x = lerp(hide, pk2, ease((u - 4.2) / .5)); look = [-L, 0]; ti = 1; } else if (u < 5.0) { x = pk2; look = [-L, 0]; ti = 1; T.ex = 'happy'; } else x = lerp(pk2, HX, ease(clamp((u - 5.0) / .9, 0, 1)));
        T.x = x; T.r = 0.12 * L * ti; if (look) T.look = look; const m = mov(); for (let i = 0; i < 4; i++) legsA[i].dl = 0.07 * Math.sin(u * 20 + i * 1.6) * m; } },
    bostezo: { dur: 3.4,
      a(g, u, T) { const k = u < 2.0 ? ease(clamp(u / 0.9, 0, 1)) : 1 - ease(clamp((u - 2.0) / 0.8, 0, 1)); T.sy = 0.14 * k; T.s = 1 + 0.04 * k; T.lid = 0.25 * k; T.look = [0, -0.3 * k]; if (k > 0.25) T.ex = 'strain'; legsA[0].dx = -0.12 * k; legsA[3].dx = 0.12 * k; legsA[1].dx = -0.05 * k; legsA[2].dx = 0.05 * k; legsA.forEach(l => l.dl = 0.05 * k); if (u > 2.8) T.r = 0.03 * Math.sin((u - 2.8) * 26) * (1 - (u - 2.8) / 0.6); },
      d(g, u, bx, by) { const k = u < 2.0 ? ease(clamp((u - 0.25) / 0.8, 0, 1)) : 1 - ease(clamp((u - 2.0) / 0.6, 0, 1)); if (k < 0.03) return; const s = S.s.x, my = by - 0.26 * S0 * s - 0.04, rx = 0.085 * s * k, ry = 0.12 * s * k; ctx.save(); ctx.beginPath(); ctx.ellipse(px(bx), py(my), rx * pxu, ry * pxu, 0, 0, TAU); ctx.fillStyle = 'rgba(62,33,3,.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,238,215,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); } },
    baile: { dur: 4.6,
      a(g, u, T) { const e = env(u, .3, 4.2, 4.6), b = u / 0.5, f = b % 1, bi = Math.floor(b); hopY = 0.05 * e * Math.abs(Math.sin(PI * b)); T.x = HX + 0.08 * e * Math.sin(PI * b / 2); T.r = 0.07 * e * Math.sin(PI * b / 2 + 0.6); legsA[bi % 4].dl = -0.16 * e * Math.sin(PI * f); legsA[(bi + 2) % 4].dx = 0.08 * e * Math.sin(PI * f) * (bi % 2 ? 1 : -1); T.look = [0.5 * Math.sin(PI * b / 2), 0.1]; if (bi % 4 === 3) T.ex = 'happy'; T.sy = 0.02 * e * Math.sin(PI * 2 * b); },
      d(g, u, bx, by) { const e = env(u, .3, 4.2, 4.6), b = u / 0.5, f = b % 1, bi = Math.floor(b) % 4; if (e < .02) return; ctx.save(); ctx.globalAlpha = (1 - f) * 0.5 * e; ctx.beginPath(); ctx.ellipse(px(bx), py(GROUND + 0.02), pxu * (0.12 + 0.4 * f), pxu * (0.03 + 0.1 * f), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore();
        for (let i = 0; i < 4; i++) { const on = i === bi; ctx.save(); ctx.globalAlpha = e * (on ? 1 : 0.3); const sz = pxu * 0.05; ctx.drawImage(SPR.cian, px(bx + (i - 1.5) * 0.1) - sz / 2, py(GROUND - 0.1) - sz / 2, sz, sz); ctx.restore(); } } },
    espejo: { dur: 5.6,
      a(g, u, T) { const k = env(u, 0.8, 4.4, 5.2); T.s = lerp(1, 0.82, k); T.y = lerp(HY, 0.22, k); T.look = u < 2.2 ? [0, -1] : u < 3.4 ? [0.3, -0.5] : [0, -0.2]; if (u > 0.8 && u < 2.2) T.r = 0.07 * Math.sin(u * 2.2); if (u > 2.2 && u < 3.4) { T.ex = 'wink'; if (!g.w) { g.w = 1; S.sy.v += 0.9; } } else if (u >= 3.4 && u < 4.2) { T.sx = 0.08 * Math.sin((u - 3.4) * 7); T.ex = 'happy'; } },
      p(g, u, bx, by, T) { const k = env(u, 0.8, 4.4, 5.2); if (k < 0.03) return; const axis = by - 1.05 * S0 * S.s.x - 0.02, ry = 0.30 * k, rx = 0.62 * k, cyy = axis - ry; const ell = new Path2D(); ell.ellipse(px(bx), py(cyy), rx * pxu, ry * pxu, 0, 0, TAU);
        ctx.save(); const gr = ctx.createLinearGradient(0, py(axis), 0, py(axis - 2 * ry)); gr.addColorStop(0, 'rgba(240,194,75,.30)'); gr.addColorStop(1, 'rgba(100,67,20,.35)'); ctx.fillStyle = gr; ctx.fill(ell); ctx.clip(ell);
        ctx.save(); ctx.translate(0, 2 * py(axis)); ctx.scale(1, -1); dibujarCuerpoMorph(T, bx + 0.012 * Math.sin(tiempo * 4), by); ctx.restore();
        ctx.globalAlpha = 0.6; if (O.transparente) ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#131416'; ctx.fill(ell); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        for (let i = 0; i < 3; i++) { const f = ((tiempo * 0.5 + i / 3) % 1); ctx.beginPath(); ctx.ellipse(px(bx), py(axis - 0.04), pxu * rx * (0.25 + 0.8 * f), pxu * ry * (0.1 + 0.3 * f), 0, 0, TAU); ctx.strokeStyle = 'rgba(255,238,215,' + (0.5 * (1 - f)) + ')'; ctx.lineWidth = Math.max(1, pxu * 0.003); ctx.stroke(); }
        ctx.restore(); ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = 'rgba(255,238,215,.85)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(ell); ctx.restore(); } },
    pesa: { dur: 6.0,
      a(g, u, T) { const pr = env(u, 0.6, 5.3, 5.9), lv = nivelPesa(u), subiendo = (u > 1.4 && u < 2.4) || (u > 3.0 && u < 4.9); T.sy = -0.1 * (1 - lv / 2) * pr; legsA[0].dx = -0.1 * pr; legsA[3].dx = 0.1 * pr; legsA[1].dx = -0.04 * pr; legsA[2].dx = 0.04 * pr;
        if (subiendo) { T.ex = 'strain'; T.look = [0, -0.5]; } if (u > 3.9 && u < 4.9) { T.x = HX + 0.006 * Math.sin(u * 60); T.r = 0.015 * Math.sin(u * 47); legsA.forEach((l, i) => l.dl = 0.04 * Math.sin(u * 55 + i)); }
        if (u >= 5.1 && !g.t) { g.t = 1; S.sy.v -= 1.4; S.sx.v += 0.8; wob = Math.max(wob, .5); } if (u > 5.2 && u < 5.8) T.ex = 'happy'; },
      d(g, u, bx, by) { const pr = env(u, 0.6, 5.3, 5.9); if (pr < 0.02) return; const lv = nivelPesa(u), y = lv <= 1 ? lerp(GROUND + 0.08, by + 0.02, lv) : lerp(by + 0.02, by + 0.62, lv - 1);
        for (const sg of [-1, 1]) tentaculo(bx + sg * 0.30, by - 0.10, bx + sg * 0.50, (by + y) / 2, bx + sg * 0.24, y, pr, 2.2);
        const L = 0.36 * pr; linea([[bx - L, y], [bx + L, y]], pr, 3);
        for (const [dx, w, h] of [[0.31, 0.04, 0.17], [0.38, 0.03, 0.12]]) for (const sg of [-1, 1]) { const x = px(bx + sg * dx * pr), yy = py(y), W2 = w * pxu, H2 = h * pxu * pr; ctx.save(); ctx.globalAlpha = pr; ctx.beginPath(); ctx.roundRect(x - W2 / 2, yy - H2 / 2, W2, H2, W2 * 0.3); const gg = ctx.createLinearGradient(x - W2 / 2, 0, x + W2 / 2, 0); gg.addColorStop(0, 'rgba(255, 242, 222,.9)'); gg.addColorStop(1, 'rgba(240,194,75,.65)'); ctx.fillStyle = gg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = Math.max(1, pxu * 0.003); ctx.stroke(); ctx.restore(); }
        if (u > 4.0 && u < 5.0) { const f = ((u - 4.0) * 1.2) % 1; gotaPx(px(bx + 0.27), py(by + 0.24 - 0.5 * f * f), pxu * 0.014, true, 1 - f * 0.6); }
        if (u > 5.1 && u < 5.5) { const f = (u - 5.1) / 0.4; ctx.save(); ctx.globalAlpha = (1 - f) * 0.7; ctx.beginPath(); ctx.ellipse(px(bx), py(GROUND + 0.02), pxu * (0.2 + 0.5 * f), pxu * (0.04 + 0.1 * f), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); } } },
    casita: { dur: 5.2,
      a(g, u, T) { if (u < 0.4) { const k = ease(u / 0.4); T.sy = -0.12 * k; T.sx = 0.07 * k; } else if (u < 4.2) { T.f = 'casita'; T.s = 1.1; T.y = HY + 0.02; if (u > 1.0 && tiempo > g.humo) { g.humo = tiempo + 0.32; const b = burb[bi++ % 8], s = S.s.x; b.a = 1; b.x = S.x.x + 0.5 * S0 * s; b.y = S.y.x + 0.40 * s; b.r = rnd(0.02, 0.04); b.v = rnd(0.14, 0.2); b.vx = rnd(0.01, 0.05); b.e = 0; b.vida = rnd(1.2, 1.8); b.ph = rnd(0, 6); } } },
      init(g) { g.humo = 0; } },
    corazon: { dur: 4.2,
      a(g, u, T) { T.look = [0, 0]; if (u < 0.4) return; if (u > 3.5) { T.ex = 'happy'; return; } const b = (u - 0.4) / 0.62, f = b % 1, bi = Math.floor(b); T.ex = (f < 0.2 || (f > 0.3 && f < 0.5)) ? 'heart' : 'heartS'; if (bi !== g.bi) { g.bi = bi; S.sy.v += 0.55; } },
      d(g, u, bx, by) { for (let i = 0; i < 3; i++) { const q = (u - 0.9 - i * 0.7) / 1.8; if (q < 0 || q > 1) continue; glifo(PAT.heart[0], px(bx + 0.12 * (i - 1) + 0.03 * Math.sin(q * 7 + i)), py(by + 0.42 + 0.4 * q), pxu * 0.011, Math.sin(PI * q) * 0.9); } } },
    estrella: { dur: 3.8,
      a(g, u, T) { T.look = [0, 0]; if (u < 0.4) return; if (u > 3.3) { T.ex = 'happy'; return; } T.ex = Math.floor((u - 0.4) * 3) % 2 ? 'starS' : 'star'; if (!g.k) { g.k = 1; S.sy.v += 0.6; } },
      d(g, u, bx, by) { if (u < 0.5 || u > 3.4) return; for (let i = 0; i < 5; i++) { const q = ((u * 1.3 + i * 0.37) % 1), a = hh(i * 3.7 + Math.floor(u * 1.3 + i * 0.37)) * TAU, d = 0.36 + 0.14 * hh(i + 2), x = bx + Math.cos(a) * d, y = by + 0.05 + Math.sin(a) * d * 0.9, z = 0.045 * Math.sin(PI * q); if (z < 0.004) continue; linea([[x - z, y], [x + z, y]], Math.sin(PI * q), 0.8); linea([[x, y - z], [x, y + z]], Math.sin(PI * q), 0.8); } } },
    sonrisa: { dur: 3.6,
      a(g, u, T) { T.look = [0, 0]; if (u < 0.5) return; T.ex = u < 1.7 ? 'smile' : u < 2.1 ? 'wink' : u < 3.0 ? 'smile' : 'happy'; if (!g.a) { g.a = 1; S.sy.v += 0.5; } if (u > 1.7 && !g.b) { g.b = 1; S.sy.v += 0.7; S.sx.v += 0.3; } } },
    reloj: { dur: 5.2,
      a(g, u, T) {
        if (u < 0.3) { const k = ease(u / 0.3); T.sy = -0.1 * k; T.sx = 0.06 * k; }
        else if (u < 4.6) { T.f = 'reloj'; T.s = 1.35; T.arena = clamp(1 - (u - 1.0) / 3.0, 0, 1); T.look = [0.25 * Math.sin(u * 1.3), 0.5]; if (!g.a) { g.a = 1; S.sy.v += 1.2; } }
        else { if (!g.b) { g.b = 1; S.sy.v -= 1.5; S.sx.v += 0.9; wob = Math.max(wob, .6); } if (u < 5.1) T.ex = 'happy'; } } },
    batido: { dur: 5.4,
      a(g, u, T) {
        if (u < 0.6) T.look = [0.8, 0.0];
        else if (u < 2.5) { const sh = Math.sin(u * 38); T.look = [0.8, 0.0]; T.sx = 0.03 * sh; T.sy = -0.02 * sh; shiver = 0.6; T.ex = 'strain'; T.x = HX + 0.008 * Math.sin(u * 30); legsA.forEach((l, i) => l.dl = 0.035 * Math.sin(u * 45 + i * 1.7)); }
        else if (u < 3.8) { const k = ease(clamp((u - 2.5) / 0.4, 0, 1)); T.r = -0.13 * k; T.sy = 0.05 * k; T.look = [0.3, -1]; }
        else if (u < 4.9) { T.ex = 'happy'; if (!g.t) { g.t = 1; S.sy.v -= 1.3; S.sx.v += 0.8; wob = Math.max(wob, .5); } } },
      d(g, u, bx, by) {
        const sc = ease(clamp(u / 0.5, 0, 1)) * (1 - ease(clamp((u - 4.3) / 0.5, 0, 1))); if (sc < 0.02) return;
        const rest = [bx + 0.55, by + 0.18], org = [bx + 0.30, by - 0.10], drink = [bx + 0.27, by + 0.46];
        let X = lerp(org[0], rest[0], sc), Y = lerp(org[1], rest[1], sc), ang = 0, niv = 1;
        if (u >= 0.6 && u < 2.5) { X += 0.025 * Math.sin(u * 42); Y += 0.05 * Math.sin(u * 37); ang = 0.14 * Math.sin(u * 21); }
        else if (u >= 2.5 && u < 3.9) { const k = ease(clamp((u - 2.5) / 0.45, 0, 1)), k2 = ease(clamp((u - 3.5) / 0.4, 0, 1)); X = lerp(rest[0], drink[0], k * (1 - k2)); Y = lerp(rest[1], drink[1], k * (1 - k2)); ang = (lerp(0, 1.7, k) + 0.4 * ease(clamp((u - 3.0) / 0.5, 0, 1))) * (1 - k2); niv = 1 - ease(clamp((u - 2.95) / 0.6, 0, 1)); }
        else if (u >= 3.9) niv = 0;
        const h = 0.28 * sc, ux = Math.sin(ang), uy = -Math.cos(ang), bxx = X + ux * h / 2, byy = Y + uy * h / 2;
        tentaculo(bx + 0.28, by - 0.08, (bx + 0.28 + bxx) / 2 + 0.10, (by - 0.08 + byy) / 2 - 0.14, bxx + ux * 0.01, byy + uy * 0.01, sc, 2.2);
        if (u >= 0.6 && u < 2.5) for (const sg of [-1, 1]) { const f = (Math.sin(u * 42 + sg) + 1) / 2; linea([[X + sg * 0.14, Y + 0.02 + 0.05 * sg], [X + sg * (0.19 + 0.02 * f), Y + 0.06 + 0.05 * sg]], 0.8 * f, 1); }
        vasoShaker(X, Y, ang, niv, sc, u < 2.5 ? 0 : clamp((u - 2.5) / 0.6, 0, 1)); } },
    flexiones: { dur: 5.6,
      a(g, u, T) {
        const e = env(u, 0.5, 5.0, 5.6); let p = 0;
        for (const s of [0.7, 1.55, 2.4]) if (u >= s && u < s + 0.85) p = 0.5 - 0.5 * Math.cos(TAU * (u - s) / 0.85);
        const q = (u - 3.25) / 1.35, last = q >= 0 && q < 1; if (last) p = q < 0.3 ? ease(q / 0.3) : q < 0.75 ? 1 : 1 - ease((q - 0.75) / 0.25);
        T.y = HY - 0.06 * e - 0.14 * p * e; T.sy = -0.05 * e - 0.05 * p * e; T.sx = 0.05 * e + 0.04 * p * e; T.look = [0, 0.15 * e];
        legsA.forEach(l => l.dl = -0.35 * p * e); legsA[0].dx = -0.12 * e; legsA[3].dx = 0.12 * e; legsA[1].dx = -0.04 * e; legsA[2].dx = 0.04 * e;
        if (last && q > 0.3 && q < 0.75) { T.ex = 'strain'; T.x = HX + 0.008 * Math.sin(u * 55); shiver = 1; legsA.forEach((l, i) => l.dl += 0.035 * Math.sin(u * 60 + i)); }
        if (u >= 4.6 && u < 5.3) { T.ex = 'happy'; if (!g.t) { g.t = 1; S.sy.v -= 1.2; S.sx.v += 0.7; wob = Math.max(wob, .5); } } },
      d(g, u, bx, by) {
        const e = env(u, 0.5, 5.0, 5.6); if (e < 0.02) return; const fy = HY - 0.06 * e - 0.42;
        linea([[bx - 0.5, fy], [bx + 0.5, fy]], e * 0.85, 1.4);
        const fin = [1.55, 2.4, 3.25, 4.6]; for (let i = 0; i < 4; i++) { const on = u >= fin[i], sz = pxu * (on ? 0.15 : 0.10), x = px(bx + 0.18 + i * 0.15), y = py(by + 0.52); ctx.save(); ctx.globalAlpha = e * (on ? 1 : 0.28); ctx.drawImage(SPR.cian, x - sz / 2, y - sz / 2, sz, sz); ctx.restore(); }
        for (const t of fin) { const v = u - t; if (v > 0 && v < 0.35) { const f = v / 0.35; ctx.save(); ctx.globalAlpha = (1 - f) * 0.6; ctx.beginPath(); ctx.ellipse(px(bx), py(fy), pxu * (0.18 + 0.35 * f), pxu * (0.03 + 0.06 * f), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); } } } },
    toalla: { dur: 5.4,
      a(g, u, T) {
        if (u < 1.9) { const k = ease(clamp(u / 0.5, 0, 1)); T.sy = -0.04 * k; T.lid = 0.12 * k; T.look = [0.15 * Math.sin(u * 2), 0.45]; }
        else if (u < 4.0) { const w = Math.sin((u - 2.0) * 10) * ease(clamp((u - 1.9) / 0.2, 0, 1)); T.r = 0.05 * w; T.x = HX + 0.02 * w; T.look = [0, 0.15]; T.lid = 0.06; }
        else if (u < 4.6) { T.ex = 'happy'; T.sy = -0.09 * Math.sin(PI * (u - 4.0) / 0.6); if (!g.s) { g.s = 1; const b = burb[bi++ % 8]; b.a = 1; b.x = S.x.x + 0.30; b.y = S.y.x + 0.04; b.r = 0.04; b.v = 0.10; b.vx = 0.22; b.e = 0; b.vida = 1.0; b.ph = 0; S.sx.v += 0.9; S.sy.v -= 0.8; wob = Math.max(wob, 0.3); } }
        else if (u < 5.2) T.ex = 'happy'; },
      d(g, u, bx, by) {
        for (let i = 0; i < 3; i++) { const q = (u - 0.25 - 0.5 * i) / 1.0; if (q < 0 || q > 1) continue; const sd = i % 2 ? 1 : -1; gotaPx(px(bx + sd * (0.385 + 0.03 * i)), py(by + 0.24 - 0.55 * q * q), pxu * 0.05, true, Math.min(1, q * 6) * (1 - 0.4 * q), [255, 238, 222]); }
        const ent = ease(clamp((u - 1.6) / 0.45, 0, 1)), sal = ease(clamp((u - 3.9) / 0.5, 0, 1)), k = ent * (1 - sal); if (k < 0.02) return;
        const w = (u > 2.0 && u < 3.9) ? Math.sin((u - 2.0) * 10) : 0, cx = bx + 0.10 * w + (1 - ent) * 0.9 + sal * 0.9, cy = by + 0.23 + 0.01 * Math.abs(w), ang = 0.10 * w, hw = 0.42;
        for (const sg of [-1, 1]) { const ex = cx + sg * hw * Math.cos(ang), ey = cy + sg * hw * Math.sin(ang); tentaculo(bx + sg * 0.30, by - 0.10, bx + sg * 0.58, by + 0.04, ex, ey, k, 2.2); }
        toallaD(cx, cy, hw, 0.072, ang, 0.035 * w, k); } },
    discos: { dur: 5.8,
      a(g, u, T) {
        T.look = u < 2.4 ? [0.8, 0.15] : u < 3.5 ? [0.8, -0.3] : [0.4, 0.4];
        for (const t of [0.7, 1.15, 1.6, 2.05]) if (u >= t && u < t + 0.25) T.sy = 0.05 * Math.sin(PI * (u - t) / 0.25);
        if (u >= 2.6 && u < 3.55) T.ex = 'wow'; else if (u >= 3.55 && u < 4.5) T.ex = 'x'; else if (u >= 4.5 && u < 5.4) T.ex = 'happy';
        if (u >= 3.55 && !g.f) { g.f = 1; S.sx.v -= 1.5; S.sy.v -= 1.0; wob = 1; }
        if (u >= 4.5 && !g.h) { g.h = 1; S.sy.v += 1.0; S.sx.v += 0.5; } },
      d(g, u, bx, by) {
        const TX = bx + 0.50, FY = HY - 0.42, W3 = [0.40, 0.35, 0.30, 0.25], H3 = 0.105, al = 1 - ease(clamp((u - 5.1) / 0.6, 0, 1)); if (al < 0.02) return;
        const sw = clamp((u - 2.4) / 1.1, 0, 1), lean = 0.12 * ease(clamp((u - 2.9) / 0.6, 0, 1)), OFF = [0.03, 0.08, 0.14, 0.20], AE = [0.10, -0.28, 0.34, -0.45];
        linea([[TX - 0.24, FY], [TX + 0.36, FY]], al * 0.8, 1.4);
        for (let i = 0; i < 4; i++) {
          const ti = 0.7 + 0.45 * i, q = clamp((u - ti) / 0.28, 0, 1); if (u < ti) continue;
          const y0 = FY + H3 / 2 + i * (H3 + 0.006), yy = y0 + 0.5 * Math.pow(1 - q, 2), x0 = TX + Math.sin(u * 9 + i) * 0.018 * sw * i + lean * i * 0.05, rot0 = -lean * 0.45 * i + 0.05 * Math.sin(u * 9) * sw * i;
          const fd = (3 - i) * 0.07, f = clamp((u - 3.45 - fd) / 0.8, 0, 1);
          if (f <= 0) { discoNeon(x0, yy, W3[i], H3, rot0, al * Math.min(1, q * 4)); continue; }
          const yf = FY + H3 / 2 + 0.012 * i, bounce = 0.05 * Math.abs(Math.sin(f * PI * 2.5)) * (1 - f), x = lerp(x0, TX + OFF[i], ease(f)), y = lerp(y0, yf, f * f) + bounce, rot = lerp(rot0, AE[i] * 0.5, ease(f)) - 0.9 * Math.sin(PI * f) * (1 - f * 0.3);
          discoNeon(x, y, W3[i], H3, rot, al);
        }
        const v = u - 3.95; if (v > 0 && v < 0.4) { const f = v / 0.4; ctx.save(); ctx.globalAlpha = (1 - f) * 0.7; ctx.beginPath(); ctx.ellipse(px(TX + 0.15), py(FY), pxu * (0.15 + 0.4 * f), pxu * (0.03 + 0.07 * f), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); } } },
    calentar: { dur: 5.6,
      a(g, u, T) {
        [0, 3, 1, 2].forEach((li, k) => { const s = 0.4 + 0.6 * k, q = clamp((u - s) / 0.6, 0, 1); if (q <= 0 || q >= 1) return; const e = Math.sin(PI * q), sg = li < 2 ? -1 : 1; legsA[li].dl = 0.18 * e; legsA[li].dx = sg * 0.36 * e; T.look = [sg * 0.8, 0.1]; T.sx = 0.05 * e; T.r = -sg * 0.05 * e; T.x = HX + sg * 0.03 * e; });
        if (u >= 3.0 && u < 4.4) { const e = env(u - 3.0, 0.2, 1.2, 1.4), w = Math.sin(TAU * (u - 3.0) / 0.7); T.r = 0.30 * w * e; T.sx = 0.07 * Math.abs(w) * e; T.x = HX + 0.06 * w * e; T.look = [w, 0]; legsA.forEach((l, i) => l.dl = 0.03 * Math.sin(u * 14 + i) * e); }
        if (u >= 4.5 && u < 5.1) { const q = (u - 4.5) / 0.55; if (q < 1) { hopY = 0.2 * 4 * q * (1 - q); T.sy = 0.08 * Math.sin(PI * q); legsA[1].dl = legsA[2].dl = -0.08 * Math.sin(PI * q); } T.ex = 'happy'; if (q >= 1 && !g.t) { g.t = 1; S.sy.v -= 1.5; S.sx.v += 0.8; wob = Math.max(wob, .5); } }
        else if (u >= 5.1 && u < 5.5) T.ex = 'happy'; },
      d(g, u, bx, by) {
        if (u >= 3.0 && u < 4.4) { const e = env(u - 3.0, 0.2, 1.2, 1.4), w = Math.sin(TAU * (u - 3.0) / 0.7); for (const sg of [-1, 1]) { const a = Math.max(0, sg * -w) * e; if (a < 0.05) continue; linea([[bx + sg * 0.50, by + 0.10], [bx + sg * 0.58, by + 0.0], [bx + sg * 0.50, by - 0.12]], a, 1.1); linea([[bx + sg * 0.60, by + 0.12], [bx + sg * 0.68, by + 0.0], [bx + sg * 0.60, by - 0.14]], a * 0.6, 1.1); } }
        if (u > 5.0 && u < 5.4) { const f = (u - 5.0) / 0.4; ctx.save(); ctx.globalAlpha = (1 - f) * 0.7; ctx.beginPath(); ctx.ellipse(px(bx), py(GROUND + 0.02), pxu * (0.2 + 0.5 * f), pxu * (0.04 + 0.1 * f), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.restore(); }
        if (u > 4.6 && u < 5.0) chispas(px(bx), py(by + 0.2), pxu * 0.38, (u - 4.6) / 0.4, 5, 6); } },
    comba: { dur: 5.4,
      a(g, u, T) {
        if (u >= 0.7 && u < 3.7) { const b = (u - 0.7) / 0.5, p = b % 1, j = Math.sin(PI * clamp((p - 0.22) / 0.5, 0, 1)); hopY = 0.11 * j; T.sy = -0.03 * j; T.look = [0, -0.2]; legsA.forEach(l => l.dl = -0.12 * j); T.ex = 'happy'; const k = 'l' + Math.floor(b); if (p > 0.72 && !g[k]) { g[k] = 1; S.sy.v += 0.5; } }
        else if (u >= 3.7 && u < 4.1) { const q = (u - 3.7) / 0.4; hopY = 0.06 * Math.sin(PI * q); T.ex = 'x'; T.r = 0.12 * Math.sin(PI * q); if (!g.tr) { g.tr = 1; S.sx.v += 1.3; S.sy.v -= 1.2; wob = Math.max(wob, 0.8); } }
        else if (u >= 4.1 && u < 4.7) { T.ex = 'x'; T.sy = -0.05; T.look = [0, 0.4]; }
        else if (u >= 4.7) { T.ex = 'happy'; if (!g.rr) { g.rr = 1; S.sy.v -= 1.2; S.sx.v += 0.7; wob = Math.max(wob, 0.5); } T.sy = 0.03 * Math.sin((u - 4.7) * 22); } },
      d(g, u, bx, by) {
        const e = env(u, 0.4, 5.0, 5.4); if (e < 0.02) return; const hy = HY - 0.12, hxs = 0.40, Lx = HX - hxs, Rx = HX + hxs;
        for (const sg of [-1, 1]) tentaculo(bx + sg * 0.30, by - 0.06, bx + sg * 0.42, by - 0.14, HX + sg * hxs, hy, e, 2.2);
        let ap;
        if (u < 0.7) ap = hy - 0.30 * ease(clamp(u / 0.6, 0, 1));
        else if (u < 3.7) { const th = ((u - 0.7) / 0.5) * TAU, c = Math.cos(th); ap = hy + (c > 0 ? 0.62 : 0.46) * c; }
        else ap = hy - 0.20;
        if (u < 3.7) tentaculo(Lx, hy, HX, 2 * ap - hy, Rx, hy, e, 1.3);
        else { // cuerda enredada alrededor de las patas
          const tw = ease(clamp((u - 3.7) / 0.5, 0, 1)), P = []; for (let i = 0; i <= 20; i++) { const f = i / 20; P.push([lerp(Lx, Rx, f) + 0.05 * Math.sin(f * 21) * tw, lerp(hy, GROUND + 0.05, tw) - 0.07 * Math.sin(f * 17) * tw + 0.14 * Math.sin(PI * f) * (1 - tw)]); }
          linea(P, u < 4.9 ? e : e * (1 - ease(clamp((u - 4.9) / 0.4, 0, 1))), 1.2); }
        if (u > 4.7 && u < 5.1) chispas(px(bx), py(by + 0.2), pxu * 0.38, (u - 4.7) / 0.4, 11, 5); } },
    dominadas: { dur: 5.8,
      a(g, u, T) {
        let p = 0; const hang = ease(clamp((u - 0.6) / 0.35, 0, 1)) * (1 - ease(clamp((u - 4.9) / 0.35, 0, 1)));
        for (const s of [1.2, 2.2]) if (u >= s && u < s + 0.9) p = 0.5 - 0.5 * Math.cos(TAU * (u - s) / 0.9);
        const q = (u - 3.2) / 1.7, last = q >= 0 && q < 1; if (last) p = q < 0.35 ? ease(q / 0.35) : q < 0.75 ? 1 : 1 - ease((q - 0.75) / 0.25);
        T.y = HY + 0.16 * hang + 0.22 * p * hang; T.sy = 0.07 * hang; T.look = [0, 0.5 * hang]; legsA.forEach((l, i) => l.dl = 0.10 * hang + 0.05 * Math.sin(u * 3 + i) * hang);
        if (last && q > 0.35 && q < 0.75) { T.ex = 'strain'; T.x = HX + 0.01 * Math.sin(u * 55); shiver = 1; }
        if (u >= 5.0 && u < 5.6) { T.ex = 'happy'; if (!g.t) { g.t = 1; S.sy.v -= 1.3; S.sx.v += 0.8; wob = Math.max(wob, .6); } } },
      d(g, u, bx, by) {
        const e = env(u, 0.5, 5.2, 5.7); if (e < 0.02) return; const yb = HY + 0.80 + 0.5 * (1 - ease(clamp(u / 0.5, 0, 1))), hang = ease(clamp((u - 0.6) / 0.35, 0, 1)) * (1 - ease(clamp((u - 4.9) / 0.35, 0, 1)));
        linea([[bx - 0.55, yb], [bx + 0.55, yb]], e * 0.9, 1.5);
        if (hang > 0.02) for (const sg of [-1, 1]) { const sx = bx + sg * 0.20, sy = by + 0.30; tentaculo(sx, sy, sx + sg * 0.06, (sy + yb) / 2, sx, yb, hang, 2.2); }
        const fin = [2.1, 3.1, 4.9]; for (let i = 0; i < 3; i++) { const sz = pxu * 0.08, x = px(bx - 0.20 + i * 0.20), y = py(HY - 0.50); ctx.save(); ctx.globalAlpha = e * (u >= fin[i] ? 1 : 0.3); ctx.drawImage(SPR.cian, x - sz / 2, y - sz / 2, sz, sz); ctx.restore(); } } },
    selfie: { dur: 5.2,
      a(g, u, T) {
        const e = env(u, 0.5, 4.6, 5.0);
        T.look = [0.9 * e, 0.45 * e]; T.r = -0.05 * e - 0.03 * e * Math.sin(u * 3);
        if (u >= 1.0 && u < 2.6) { T.sx = 0.03 * Math.abs(Math.sin((u - 1.0) * 8)); T.ex = 'strain'; shiver = 0.5; }
        if (u >= 2.7 && u < 4.7) T.ex = 'wink';
        if (u >= 2.9 && !g.f1) { g.f1 = 1; flashT = tiempo; S.sy.v -= 0.8; S.sx.v += 0.5; wob = Math.max(wob, 0.4); }
        if (u >= 3.9 && !g.f2) { g.f2 = 1; flashT = tiempo; S.sy.v -= 0.8; S.sx.v += 0.5; wob = Math.max(wob, 0.4); }
        if (u >= 4.7 && u < 5.1) T.ex = 'happy'; },
      d(g, u, bx, by) {
        const e = env(u, 0.5, 4.6, 5.0); if (e < 0.02) return;
        const ph = bx + 0.62 * e, pyy = by + 0.28 * e + 0.04 * Math.sin(u * 2.5); tentaculo(bx + 0.30, by - 0.06, bx + 0.48, by + 0.02, ph - 0.02, pyy - 0.10, e, 2.2);
        ctx.save(); ctx.translate(px(ph), py(pyy)); ctx.rotate(-0.15); const w = pxu * 0.15, h = pxu * 0.26; ctx.globalAlpha = e;
        ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.22); ctx.fillStyle = 'rgba(36,15,2,.92)'; ctx.fill(); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1.2, pxu * 0.009); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(-w * 0.36, -h * 0.40, w * 0.72, h * 0.72, w * 0.1); ctx.fillStyle = rgba(BASE, 0.22 + 0.15 * Math.sin(u * 6)); ctx.fill();
        ctx.beginPath(); ctx.arc(0, h * 0.40, w * 0.08, 0, TAU); ctx.fillStyle = rgba(BASE, 1); ctx.fill(); ctx.restore();
        const flex = u >= 0.9 ? 0.5 + 0.5 * Math.sin((u - 0.9) * 5) : 0, ex2 = bx - 0.54 * e, ey2 = by + 0.02 * flex;
        tentaculo(bx - 0.30, by - 0.06, bx - 0.52 * e, by - 0.14, ex2, ey2, e, 2.2); tentaculo(ex2, ey2, ex2 - 0.02, ey2 + 0.18 * e, bx - 0.36 * e, by + 0.22 * e + 0.05 * flex, e, 2.2);
        gotaPx(px(ex2 + 0.04), py(ey2 + 0.13), pxu * (0.032 + 0.016 * flex) * e, false, e);
        for (const t of [2.9, 3.9]) { const v = u - t; if (v > 0 && v < 0.35) { const f = v / 0.35, X = px(ph), Y = py(pyy), R = pxu * (0.15 + 0.5 * f); ctx.save(); const gr = ctx.createRadialGradient(X, Y, 0, X, Y, R); gr.addColorStop(0, 'rgba(255,248,225,' + (0.95 * (1 - f)) + ')'); gr.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill(); ctx.restore(); chispas(X, Y, pxu * 0.28, f, 5 + t, 5); } } } },
  };
  const NOMBRES = Object.keys(ESP), SIMPLES = ['corazon', 'estrella', 'sonrisa', 'bostezo'];
  function elegirEsp() { const L = (esAvatar ? SIMPLES : NOMBRES).filter(n => n !== ultEsp); return L[Math.floor(Math.random() * L.length)]; }
  function iniciarEsp(n) { esp = { n, t0: tiempo, lado: Math.random() < 0.5 ? -1 : 1 }; if (ESP[n].init) ESP[n].init(esp); ultEsp = n; }
  function aplicarEsp(T) { const u = tiempo - esp.t0, D = ESP[esp.n]; if (u > D.dur) { esp = null; proxEsp = tiempo + rnd(25, 70); return; } D.a(esp, u, T); }
  // contorno que vibra con la voz (ondas que recorren el cuerpo) + pulso en cada pico
  function vibracion() {
    if (vib < 0.01 && pulso < 0.02) return; const amp = 0.006 + 0.05 * vib + 0.045 * pulso;
    ptsActual = ptsActual.map((p, i) => { const dx = p[0], dy = p[1] + 0.05, l = Math.hypot(dx, dy) || 1, d = amp * (0.6 * sin(i / NP * TAU * 3 - tiempo * 13) + 0.4 * sin(i / NP * TAU * 5 + tiempo * 9)); return [p[0] + dx / l * d, p[1] + dy / l * d]; });
  }

  // ----- VOLUMEN (opcion volumen:true): cuerpo translucido con nucleo luminoso y borde denso, luz clave arriba-izquierda,
  //       oclusion abajo, luz de borde fria, brillo que se desplaza con la inclinacion y patas con sombreado cilindrico -----
  function volBase(P, c, o) {
    const sy = Math.sin(o.vol.yaw), W = [255, 255, 255], dens = mezcla(c, [98, 54, 6], 0.38), prof = mezcla(c, [60, 29, 3], 0.5);
    const g = ctx.createRadialGradient(0.04 + 0.26 * sy, 0.02, 0.04, 0.1 * sy, 0.1, 1.55);
    g.addColorStop(0, rgba(mezcla(c, W, 0.5))); g.addColorStop(0.3, rgba(mezcla(c, W, 0.14))); g.addColorStop(0.5, rgba(c)); g.addColorStop(0.78, rgba(dens)); g.addColorStop(1, rgba(prof));
    ctx.fillStyle = g; ctx.fill(P);
  }
  function volLuz(P, c, o) {
    const V = o.vol, sy = Math.sin(V.yaw), U = o.U, ac = o.act ?? 0.3, resp = 0.5 + 0.5 * sin(tiempo * 1.9), frio = [255, 217, 150], sombra = 'rgba(50,23,2,';
    const R = (x0, y0, x1, y1) => ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // nucleo subsuperficial: mas luminoso por dentro, se desplaza con el giro (profundidad)
    ctx.save();
    let g = ctx.createRadialGradient(0.1 + 0.2 * sy, 0.1, 0, 0.1 + 0.2 * sy, 0.1, 0.7); const nuc = mezcla(c, [255, 238, 215], 0.55); g.addColorStop(0, rgba(nuc, 0.34 + 0.10 * resp + 0.10 * ac)); g.addColorStop(0.55, rgba(nuc, 0.10)); g.addColorStop(1, rgba(nuc, 0)); ctx.fillStyle = g; R(-1.5, -1.3, 1.5, 1.6);
    ctx.restore();
    if (!o.pequeno) { // corrientes internas muy suaves (con paralaje)
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const y0 = -0.62 + i * 0.27; ctx.beginPath(); ctx.moveTo(-1.2, y0); for (let q = 0; q <= 11; q++) ctx.lineTo(-1.2 + q * 0.22 + 0.14 * sy, y0 + Math.sin(q * 0.9 + i * 1.7 + tiempo * 0.8) * 0.055); ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(110,67,5,.11)'; ctx.lineWidth = (2.6 + (i % 3)) / U; ctx.stroke(); }
    }
    // oclusion abajo y lado de sombra a la derecha
    g = ctx.createLinearGradient(0, -0.1, 0, 0.84); g.addColorStop(0, sombra + '0)'); g.addColorStop(0.5, sombra + '.10)'); g.addColorStop(1, sombra + '.34)'); ctx.fillStyle = g; R(-1.5, -1.3, 1.5, 1.7);
    g = ctx.createLinearGradient(-0.45, -0.5, 1.05, 0.55); g.addColorStop(0, sombra + '0)'); g.addColorStop(0.55, sombra + '0)'); g.addColorStop(1, sombra + '.34)'); ctx.fillStyle = g; R(-1.5, -1.3, 1.5, 1.7);
    // luz clave arriba-izquierda
    g = ctx.createRadialGradient(-0.40 + 0.06 * sy, -0.44, 0, -0.40 + 0.06 * sy, -0.44, 0.98); g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(0.35, 'rgba(255,237,215,.17)'); g.addColorStop(1, 'rgba(255,237,215,0)'); ctx.fillStyle = g; R(-1.5, -1.3, 1.5, 1.2);
    // patas: sombreado cilindrico, sombra del cuerpo encima, la mas alejada mas oscura
    if (o.legs && U >= 60) {
      for (let i = 0; i < 4; i++) {
        const L = o.legs[i], x0 = LEGX[i] + LEGB[i] + L.dx * 0.6, hw = 0.17, dark = clamp(0.1 + (i === 1 || i === 2 ? 0.07 : 0) - 0.34 * sy * LEGX[i], 0, 0.42);
        const cg = ctx.createLinearGradient(x0 - hw, 0, x0 + hw, 0); cg.addColorStop(0, sombra + (0.14 + dark * 0.5) + ')'); cg.addColorStop(0.16, 'rgba(255,255,255,.05)'); cg.addColorStop(0.34, 'rgba(255, 242, 222,' + (0.34 - dark * 0.4) + ')'); cg.addColorStop(0.58, sombra + (0.03 + dark * 0.5) + ')'); cg.addColorStop(0.86, sombra + (0.2 + dark * 0.5) + ')'); cg.addColorStop(1, 'rgba(255,217,150,.34)');
        ctx.fillStyle = cg; const ga = ctx.globalAlpha; for (let q = 0; q < 8; q++) { ctx.globalAlpha = ga * Math.min(1, (q + 1) / 6); R(x0 - hw - 0.02, 0.54 + q * 0.06, x0 + hw + 0.02, 0.54 + (q + 1) * 0.06 + 0.002); } ctx.globalAlpha = ga; R(x0 - hw - 0.02, 1.02, x0 + hw + 0.02, 1.5);
        const sg = ctx.createLinearGradient(0, 0.68, 0, 1.02); sg.addColorStop(0, sombra + '.2)'); sg.addColorStop(1, sombra + '0)'); ctx.fillStyle = sg; R(x0 - hw - 0.02, 0.68, x0 + hw + 0.02, 1.02);
        const tipY = 0.45 + 0.42 + L.dl; ctx.beginPath(); ctx.ellipse(x0 - 0.06 + LEGB[i] * 0.4, tipY + 0.02, 0.05, 0.075, 0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.fill();
      }
    }
    // luz de borde: blanca fina arriba-izquierda, fria y mas ancha abajo-derecha (solo la mitad de dentro por el recorte)
    ctx.lineJoin = 'round';
    g = ctx.createLinearGradient(-0.9, -0.7, 0.9, 0.8); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(0.28, 'rgba(255,237,220,.10)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(0.8, rgba(frio, 0.36)); g.addColorStop(1, rgba(frio, 0.9));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(0.13, 4.4 / U); ctx.stroke(P); ctx.lineWidth = Math.max(0.05, 1.8 / U); ctx.globalAlpha *= 0.9; ctx.stroke(P); ctx.globalAlpha /= 0.9;
    // brillo especular: se desliza un poco con la inclinacion
    ctx.save(); ctx.translate(0.11 * sy - 0.5 * V.rot, 0.04 * V.rot + 0.012 * Math.sin(tiempo * 1.3));
    const sg2 = ctx.createLinearGradient(-0.78, -0.1, -0.2, -0.76); sg2.addColorStop(0, 'rgba(255,255,255,.35)'); sg2.addColorStop(0.5, 'rgba(255,255,255,.92)'); sg2.addColorStop(1, 'rgba(255,255,255,.55)');
    ctx.beginPath(); ctx.moveTo(-0.76, -0.14); ctx.bezierCurveTo(-0.83, -0.5, -0.52, -0.7, -0.17, -0.74); ctx.bezierCurveTo(-0.46, -0.62, -0.62, -0.42, -0.62, -0.14); ctx.closePath(); ctx.fillStyle = sg2; ctx.fill();
    ctx.beginPath(); ctx.arc(-0.89, 0.06, 0.036, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0.42 - 0.1 * sy, 0.5, 0.24, 0.07, -0.5, 0, TAU); ctx.fillStyle = rgba(frio, 0.2); ctx.fill(); // luz que rebota/atraviesa abajo-derecha
  }

  // ----- dibujo del cuerpo (neón líquido) -----
  function material(P, a, k, o) {
    const c = o.col, luz = mezcla(c, [255, 255, 255], 0.62), osc = mezcla(c, [70, 38, 10], 0.42), U = o.U;
    const pequeno = o.pequeno, fl = 1 + 0.07 * sin(tiempo * 2.1) + (sin(tiempo * 0.9) > 0.93 ? 0.10 * sin(tiempo * 47) : 0.03 * sin(tiempo * 31)), resp = 0.5 + 0.5 * sin(tiempo * 1.9);
    ctx.save(); ctx.globalAlpha = a * (o.dim ? 0.8 : 1);
    ctx.lineJoin = 'round';
    const ac = o.act ?? 0.3, hv = (0.8 + 0.55 * ac) * (1 + 0.13 * ac * sin(tiempo * 26) + 0.06 * ac * sin(tiempo * 61));
    for (const [w, al] of (pequeno ? [[16, .16]] : [[52, .035], [36, .06], [22, .11], [12, .20]])) { ctx.lineWidth = w / U; ctx.strokeStyle = rgba(c, Math.min(1, al * fl * hv * (o.vol ? 0.62 : 1)) * (o.dim ? .6 : 1)); ctx.stroke(P); }
    if (o.vol) { ctx.lineWidth = (1.7 + 0.5 * resp + 0.5 * ac) / U; ctx.strokeStyle = rgba(mezcla(c, [255, 255, 255], .62), 0.55 + 0.1 * resp); ctx.stroke(P); } else {
    ctx.lineWidth = (3.8 + 1.4 * resp + 0.8 * ac) / U; ctx.strokeStyle = rgba(mezcla(c, [255, 255, 255], .88), 0.92 + 0.08 * resp); ctx.stroke(P); }
    const V = o.vol;
    if (V) volBase(P, c, o); else { const g = ctx.createRadialGradient(-0.3, -0.5, 0.05, 0, 0, o.rad || 1.45); g.addColorStop(0, rgba(luz)); g.addColorStop(.38, rgba(c)); g.addColorStop(1, rgba(osc));
    ctx.fillStyle = g; ctx.fill(P); }
    ctx.save(); ctx.clip(P);
    if (V) volLuz(P, c, o);
    if (!pequeno && !V) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const y0 = -0.8 + i * 0.28; ctx.beginPath(); ctx.moveTo(-1.2, y0); for (let q = 0; q <= 11; q++) ctx.lineTo(-1.2 + q * 0.22, y0 + Math.sin(q * 0.9 + i * 1.7 + tiempo * 0.8) * 0.06); ctx.strokeStyle = i % 3 ? 'rgba(255,255,255,.11)' : 'rgba(110,67,5,.16)'; ctx.lineWidth = (3 + (i % 3)) / U; ctx.stroke(); }
      const sg = ctx.createLinearGradient(0, 0, 0, 1.2); sg.addColorStop(0, 'rgba(90,48,0,0)'); sg.addColorStop(1, 'rgba(90,48,0,.28)'); ctx.fillStyle = sg; ctx.fillRect(-1.5, 0, 3, 1.5);
    }
    if (!V) {
    ctx.beginPath(); ctx.moveTo(-0.78, -0.12); ctx.bezierCurveTo(-0.84, -0.52, -0.5, -0.72, -0.15, -0.76); ctx.bezierCurveTo(-0.45, -0.64, -0.62, -0.42, -0.62, -0.12); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.80)'; ctx.fill();
    ctx.beginPath(); ctx.arc(-0.9, 0.08, 0.035, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.52, -0.62); ctx.lineTo(0.72, -0.4); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3.5 / U; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth = 6 / U; ctx.strokeStyle = 'rgba(255,255,255,' + (0.16 + 0.14 * resp + 0.1 * ac) + ')'; ctx.stroke(P);
    }
    if (o.frozen > 0.01) {
      ctx.globalAlpha = a * o.frozen; ctx.strokeStyle = 'rgba(255, 242, 222,.75)'; ctx.lineWidth = 1.6 / U;
      for (const l of [[-.7, -.1, -.1, -.45], [-.1, -.45, .5, -.2], [.5, -.2, .8, .15], [-.4, .2, .1, .0], [.1, .0, .55, .35], [-.1, -.45, .1, 0], [-.9, .3, -.4, .2]]) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(-.1, -.45); ctx.lineTo(.5, -.2); ctx.lineTo(.1, 0); ctx.closePath(); ctx.fill();
      const br = ctx.createLinearGradient(-1, -1, 1, 1), ph = (tiempo * 0.35) % 2 - 0.5; br.addColorStop(clamp(ph - .08, 0, 1), 'rgba(255,255,255,0)'); br.addColorStop(clamp(ph, 0, 1), 'rgba(255,255,255,.45)'); br.addColorStop(clamp(ph + .08, 0, 1), 'rgba(255,255,255,0)'); ctx.globalAlpha = a * o.frozen; ctx.fillStyle = br; ctx.fillRect(-1.5, -1.5, 3, 3);
    }
    ctx.restore();
    if (o.pts && !pequeno) {
      const pts = o.pts, n = pts.length; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const PU = [[2.4, 0, 12, 1], [3.1, 1.1, 9, -1], [1.7, 0.5, 7, 1], [4.3, 2.2, 16, -1], [2.0, 1.4, 8, 1]], nAct = 3 + Math.round(2 * ac);
      for (let k = 0; k < nAct; k++) {
        const [per, off, len, dir] = PU[k], ph = ((tiempo + off) % per) / per; if (ph > 0.36) continue; const head = ph / 0.36 * n, fa = Math.sin(Math.PI * ph / 0.36);
        for (const [w, al, cc] of [[11, .38, c], [3, 1, [255, 255, 255]]]) { ctx.beginPath(); for (let j = 0; j <= len; j++) { const idx = dir > 0 ? Math.floor(head) - j : n - 1 - Math.floor(head) + j; const p = pts[((idx % n) + n) % n]; j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.strokeStyle = rgba(cc, al * fa); ctx.lineWidth = w / U; ctx.stroke(); }
      }
      if (o.arco) {
        if (ac > 0.5) for (let m = 0; m < 3; m++) {
          const slot = Math.floor(tiempo * 14 + m * 3.7); if (hh(slot * 1.7 + m) > 0.5 * ac) continue; const i = Math.floor(hh(slot + m * 5) * n), p = pts[i], dx = -p[0], dy = 0.1 - p[1], L = Math.hypot(dx, dy) || 1; let x = p[0], y = p[1];
          const seg = [[x, y]]; for (let q = 0; q < 3; q++) { x += dx / L * 0.075 + (hh(slot + q * 3 + m) - 0.5) * 0.09; y += dy / L * 0.075 + (hh(slot + q * 5 + m) - 0.5) * 0.09; seg.push([x, y]); }
          for (const [w, al, cc] of [[4, .35, c], [1.5, .95, [255, 255, 255]]]) { ctx.beginPath(); seg.forEach(([a2, b2], q) => q ? ctx.lineTo(a2, b2) : ctx.moveTo(a2, b2)); ctx.strokeStyle = rgba(cc, al); ctx.lineWidth = w / U; ctx.stroke(); }
        }
        const sl = Math.floor(tiempo * 4), ph2 = (tiempo * 4) % 1;
        if (ph2 < 0.38 && hh(sl * 3.3) < 0.24 + 0.3 * ac) {
          const tips = []; for (let i2 = 0; i2 < 4; i2++) { let bi = -1, by = 0.5; for (let j = 0; j < n; j++) { const p = pts[j]; if (Math.abs(p[0] - LEGX[i2]) < 0.3 && p[1] > by) { by = p[1]; bi = j; } } if (bi >= 0) tips.push(pts[bi]); }
          if (tips.length > 1) {
            const A = tips[Math.floor(hh(sl) * tips.length)]; let B;
            if (hh(sl + 1) < 0.5) { const tx = hh(sl + 2) < 0.5 ? 0.72 : -0.72; let bj = 0, bd = 9; for (let j = 0; j < n; j++) { const d = Math.hypot(pts[j][0] - tx, pts[j][1] - 0.1); if (d < bd) { bd = d; bj = j; } } B = pts[bj]; }
            else { B = tips[(tips.indexOf(A) + 1 + Math.floor(hh(sl + 3) * (tips.length - 1))) % tips.length]; }
            const seg = [A]; const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, N = 8;
            for (let q = 1; q < N; q++) { const f = q / N, off2 = (hh(sl * 9 + q) - 0.5) * 0.16 * Math.sin(Math.PI * f); seg.push([A[0] + dx * f + nx * off2, A[1] + dy * f + ny * off2]); } seg.push(B);
            for (const [w, al, cc] of [[5, .45, c], [1.8, 1, [255, 255, 255]]]) { ctx.beginPath(); seg.forEach(([a2, b2], q) => q ? ctx.lineTo(a2, b2) : ctx.moveTo(a2, b2)); ctx.strokeStyle = rgba(cc, al); ctx.lineWidth = w / U; ctx.stroke(); }
          }
        }
      }
    }
    ctx.restore();
  }

  // ---------- ojos con personalidad: 5 estilos (1 pixeles con parpados, 2 liquidos, 3 almendras rasgadas con cejas, 4 asimetricos con lente, 5 medias lunas) ----------
  const ID_OJOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26'];
  const NOMBRE_OJOS = { 24: 'Linea de neon y medias lunas con trama', 25: 'Linea de neon y medias lunas de cristal', 26: 'Almendra rasgada con parpado de neon y trama', 1: 'Pixeles con parpados', 2: 'Ojos liquidos', 3: 'Almendras con cejas de luz', 4: 'Asimetricos y curiosos', 5: 'Medias lunas de luz', 6: 'Parpado caido (chill)', 7: 'Ceja rota', 8: 'Asimetrico con actitud', 9: 'Lineas de luz minimalistas', 10: 'Almendra solida afilada', 11: 'Ceja y ojo en un trazo', 12: 'Parpado de luz y hueco', 13: 'Facetado', 14: 'Doble linea', 15: 'Hoja rasgada minimal', 16: 'Visor de luz', 17: 'Puntos LED', 18: 'Pincel', 19: 'Esquirlas', 20: 'Neon parpado pesado', 21: 'Antifaz', 22: 'Cristal liquido', 23: 'Anime doble arco' };
  let ojosId = ID_OJOS.includes(String(O.ojos)) ? String(O.ojos) : '25', ojosPrev = null, ojosSw = 1, exprF = null, ringA = 0, proxSac = 1, proxBlink2 = 0; const sac = [0, 0], sacT = [0, 0], tgtPrev = [0, 0];
  // pose suavizada de los ojos: todas las expresiones (T.ex, T.lid, T.tilt, mirada, voz) se convierten en estos numeros
  const PZ = { happy: 0, wink: 0, sleep: 0, xx: 0, wow: 0, strain: 0, noise: 0, heart: 0, heartK: 1, star: 0, starK: 1, smile: 0, lid: 0, tilt: 0, close: 0, dil: 0, foc: 0.3, alert: 0 };
  const brY = [new Muelle(0, 260, 0.5), new Muelle(0, 260, 0.5)], brT = [new Muelle(0, 260, 0.5), new Muelle(0, 260, 0.5)];
  function posar(expr, dt) {
    if (expr === 'smile' && (ojosId === '24' || ojosId === '25' || ojosId === '26')) expr = 'happy'; // la sonrisa de lado no pega con la linea de neon: se hace con arcos invertidos
    const kg = 1 - Math.exp(-dt * 22), kp = 1 - Math.exp(-dt * 14), ex = n => expr === n ? 1 : 0, sm = (k, v, r) => { PZ[k] += (v - PZ[k]) * r; };
    sm('happy', ex('happy'), kp); sm('wink', ex('wink'), kp); sm('sleep', ex('sleep'), 1 - Math.exp(-dt * 9)); sm('xx', ex('x'), kg); sm('wow', ex('wow'), kp); sm('strain', ex('strain'), kp); sm('noise', ex('noise'), kg);
    sm('heart', expr === 'heart' || expr === 'heartS' ? 1 : 0, kg); sm('heartK', expr === 'heartS' ? 0.8 : 1, 1 - Math.exp(-dt * 30));
    sm('star', expr === 'star' || expr === 'starS' ? 1 : 0, kg); sm('starK', expr === 'starS' ? 0.78 : 1, 1 - Math.exp(-dt * 30)); sm('smile', ex('smile'), kg);
    const esc = est === 'escuchando', bl = 1 - E.open;
    PZ.lid = AB.lid + 0.30 * PZ.strain; PZ.tilt = AB.tilt + 0.85 * PZ.strain; PZ.close = Math.max(ease(bl), PZ.sleep);
    const hap = Math.max(PZ.happy, PZ.wink * 0.5);
    sm('dil', clamp(0.35 * hap + (esc ? 0.25 : 0) + 0.5 * vozN - 0.5 * PZ.wow - 0.4 * clamp(PZ.tilt * 1.4, 0, 1) - 0.1 * PZ.xx, -0.6, 0.6), 1 - Math.exp(-dt * 8));
    sm('alert', clamp(PZ.wow + (esc ? 1 : 0) + 0.5 * PZ.heart + 0.5 * PZ.star, 0, 1), 1 - Math.exp(-dt * 10));
    const f = est === 'esperando' ? 1 : esc ? 0.7 + 0.3 * vozN : atentoOn ? 0.85 : est === 'pensar' ? 0.5 : (est === 'leer' || est === 'escribir' || est === 'comando') ? 0.6 : 0.25 + 0.12 * Math.sin(tiempo * 0.7);
    sm('foc', f, 1 - Math.exp(-dt * 5)); ringA += dt * (0.5 + 3.2 * PZ.foc + 5 * vozN);
    const bY = 0.9 * PZ.wow + 0.35 * hap + 0.5 * vozN * (esc ? 1 : 0.5) + (esc ? 0.2 : 0) + 0.3 * PZ.heart + 0.3 * PZ.star + 0.35 * PZ.xx - 3 * PZ.lid - 0.7 * PZ.sleep, bT = 1.1 * PZ.tilt - 1.0 * PZ.xx - 0.3 * PZ.wow, asim = est === 'pensar' ? 1.1 : 0;
    for (let s = 0; s < 2; s++) { brY[s].t = bY + (s === 0 ? asim : -asim * 0.15); brT[s].t = bT - (s === 0 ? asim * 0.25 : 0); brY[s].paso(dt); brT[s].paso(dt); }
  }
  const ojosPal = () => { const r = E.rojo, c = mezcla(BASE, ROJO, r); return { c, luz: mezcla(c, [255, 255, 255], 0.84), blanco: mezcla([255, 243, 222], [255, 228, 224], r), osc: mezcla([62, 33, 3], [62, 10, 10], r), lid: mezcla(c, [70, 38, 10], 0.28) }; };
  // linea del parpado de arriba y de abajo en coordenadas del ojo (u: -1..1 horizontal, v: -1..1 vertical). El parpado se cierra con parpadeo/dormir, se inclina con el ceño.
  function lidFns(side, la = 0, ta = 0, usarHappy = true) {
    const hp = (usarHappy ? Math.max(PZ.happy, side > 0 ? PZ.wink : 0) : 0) * (usarHappy === true ? 1 : usarHappy || 0), c = PZ.close, lid = PZ.lid + la, tilt = PZ.tilt + ta, bk = clamp(hp * 0.82 + lid * 0.5, 0, 0.95), ui = u => side < 0 ? u : -u;
    const top = u => lerp(-1 + 2 * clamp(lid * 1.1 + tilt * 0.28 * ui(u), -0.3, 0.97), 0.12, c);
    const bot = u => Math.max(top(u), lerp(1 - 2 * bk * (1 - 0.35 * u * u), 0.12, c));
    return { top, bot };
  }
  function regiones(L, cx, cy, rx, ry) {
    const N = 14, T = [], B = []; for (let i = 0; i <= N; i++) { const u = -1.6 + 3.2 * i / N; T.push([cx + u * rx, cy + L.top(u) * ry]); B.push([cx + u * rx, cy + L.bot(u) * ry]); }
    const open = new Path2D(), lt = new Path2D(), lb = new Path2D();
    T.forEach((p, i) => { i ? open.lineTo(p[0], p[1]) : open.moveTo(p[0], p[1]); i ? lt.lineTo(p[0], p[1]) : lt.moveTo(p[0], p[1]); }); for (let i = N; i >= 0; i--) open.lineTo(B[i][0], B[i][1]); open.closePath();
    lt.lineTo(T[N][0], cy - 3 * ry); lt.lineTo(T[0][0], cy - 3 * ry); lt.closePath();
    B.forEach((p, i) => i ? lb.lineTo(p[0], p[1]) : lb.moveTo(p[0], p[1])); lb.lineTo(B[N][0], cy + 3 * ry); lb.lineTo(B[0][0], cy + 3 * ry); lb.closePath();
    return { open, lt, lb, T, B };
  }
  function trazo(P, lw, col, al) { ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = rgba(col, al); ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  const jit = side => PZ.noise > 0.05 ? [(hh(E.seed * 1.3 + side * 5) - 0.5) * 0.14 * PZ.noise, (hh(E.seed * 2.1 + side * 3) - 0.5) * 0.05 * PZ.noise, 0.45 + 0.55 * hh(E.seed * 0.7 + side * 9)] : [0, 0, 1];
  const gsum = () => clamp(PZ.xx + PZ.heart + PZ.star + PZ.smile, 0, 1);
  const baseK = o => ((o.eyePitch || 0.082) / 0.082) * (esAvatar ? 1.15 : 1);
  // simbolos que sustituyen al ojo (x del error, corazon, estrella, :) ) en los estilos 2-5
  function glifos(al, side, cx, cy, rx, ry, P) {
    if (PZ.xx + PZ.heart + PZ.star + PZ.smile < 0.02) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (PZ.xx > 0.02) { const s = Math.min(rx, ry) * 0.72; ctx.globalAlpha = al * PZ.xx; for (const [lw, cc, a2] of [[0.1, P.osc, 0.35], [0.075, P.c, 0.45], [0.034, P.blanco, 1]]) { ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.strokeStyle = rgba(cc, a2); ctx.lineWidth = lw; ctx.stroke(); } }
    if (PZ.heart > 0.02) { const s = Math.max(rx, ry * 0.8) * 0.95 * PZ.heartK; ctx.globalAlpha = al * PZ.heart; ctx.beginPath(); ctx.moveTo(cx, cy + 0.58 * s); ctx.bezierCurveTo(cx - 1.15 * s, cy - 0.05 * s, cx - 0.72 * s, cy - 0.9 * s, cx, cy - 0.36 * s); ctx.bezierCurveTo(cx + 0.72 * s, cy - 0.9 * s, cx + 1.15 * s, cy - 0.05 * s, cx, cy + 0.58 * s); ctx.closePath(); ctx.strokeStyle = rgba(P.osc, 0.4); ctx.lineWidth = 0.075; ctx.stroke(); ctx.fillStyle = rgba(P.blanco, 1); ctx.fill(); }
    if (PZ.star > 0.02) { const R = Math.max(rx, ry * 0.8) * 1.1 * PZ.starK * (1 + 0.05 * Math.sin(tiempo * 9)), r = R * 0.44, a0 = -PI / 2 + 0.25 * Math.sin(tiempo * 2); ctx.globalAlpha = al * PZ.star; ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r : R, a = a0 + i * PI / 5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + 0.02); } ctx.closePath(); ctx.strokeStyle = rgba(P.osc, 0.4); ctx.lineWidth = 0.075; ctx.stroke(); ctx.fillStyle = rgba(P.blanco, 1); ctx.fill(); }
    if (PZ.smile > 0.02) { ctx.globalAlpha = al * PZ.smile; ctx.fillStyle = rgba(P.blanco, 1);
      if (side < 0) for (const dy of [-0.36, 0.36]) { ctx.beginPath(); ctx.arc(cx, cy + dy * ry, Math.max(0.05, rx * 0.27), 0, TAU); ctx.strokeStyle = rgba(P.osc, 0.4); ctx.lineWidth = 0.07; ctx.stroke(); ctx.fill(); }
      else for (const [lw, cc, a2] of [[0.1, P.osc, 0.35], [0.075, P.c, 0.45], [0.04, P.blanco, 1]]) { ctx.beginPath(); ctx.arc(cx - rx * 0.62, cy, ry * 1.0, -0.95, 0.95); ctx.strokeStyle = rgba(cc, a2); ctx.lineWidth = lw; ctx.stroke(); } }
    ctx.restore();
  }
  function barrasRuido(cy, al) { if (PZ.noise < 0.1) return; const fr = Math.floor(tiempo * 60); if (((fr * 7) % 5) > 1) return; ctx.save(); ctx.globalAlpha = al * 0.7 * PZ.noise; ctx.fillStyle = '#fff'; const g = Math.floor(hh(fr) * 5); for (const side of [-1, 1]) ctx.fillRect(side * 0.4 - 0.26, cy + (g - 2.5) * 0.1, 0.52, 0.03); ctx.restore(); }

  // ---- estilo 1: matriz de pixeles 6x6 mas grande, con parpados solidos y un pixel blanco de reflejo ----
  function ojos1(al, o) {
    const pitch = (o.eyePitch || 0.082) * 1.28 * (esAvatar ? 1.1 : 1), cy = o.eyeY ?? -0.12, sep = 0.40, Rv = pitch * 3.1, P = ojosPal();
    ctx.save(); const sp = E.rojo > 0.5 ? SPR.rojo : SPR.cian, sz = pitch * (esAvatar ? 3.5 : 2.8), fr = Math.floor(tiempo * 60), gl = ((Math.imul(fr, 2654435761) >>> 0) % 420) < 3, gxf = r => gl ? (((r * 5 + fr) % 3) - 1) * pitch * 0.9 : 0;
    const patW = clamp(Math.max(PZ.xx, PZ.heart, PZ.star, PZ.smile, PZ.happy, PZ.noise) * 1.6, 0, 1);
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, cx = side * sep;
      ctx.globalAlpha = al * 0.5; ctx.fillStyle = rgba(P.osc, 1); ctx.beginPath(); ctx.arc(cx, cy, Rv * 1.03, 0, TAU); ctx.fill();
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const v = celdas[s * 36 + r * 6 + c]; if (v < 0.03) continue; const ex = cx + (c - 2.5) * pitch + gxf(r), ey2 = cy + (r - 2.5) * pitch, bs = pitch * (esAvatar ? 1.12 : 0.9); ctx.globalAlpha = al * Math.min(1, v * 3); ctx.fillStyle = 'rgba(62,33,3,.82)'; ctx.beginPath(); ctx.roundRect(ex - bs / 2, ey2 - bs / 2, bs, bs, bs * 0.22); ctx.fill(); ctx.globalAlpha = al * Math.min(1, v); ctx.drawImage(sp, ex - sz / 2, ey2 - sz / 2, sz, sz); }
      const rf = (1 - patW) * (1 - PZ.close * 0.6); if (rf > 0.02) { const rx0 = cx - 1.5 * pitch, ry0 = cy - 1.5 * pitch, bs = pitch * 0.58; ctx.globalAlpha = al * rf * 0.55; ctx.drawImage(sp, rx0 - sz * 0.42, ry0 - sz * 0.42, sz * 0.84, sz * 0.84); ctx.globalAlpha = al * rf; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(rx0 - bs / 2, ry0 - bs / 2, bs, bs, bs * 0.2); ctx.fill(); }
      const L = lidFns(side, 0, 0, false), R = regiones(L, cx, cy, Rv, Rv);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Rv * 1.03, 0, TAU); ctx.clip(); ctx.globalAlpha = al; ctx.fillStyle = rgba(P.lid, 1); ctx.fill(R.lt); ctx.fill(R.lb);
      ctx.globalAlpha = al * 0.95; trazo(R.T, Math.max(0.012, pitch * 0.17), P.luz, 0.95); trazo(R.B, Math.max(0.012, pitch * 0.17), P.luz, 0.95); ctx.restore();
    }
    if (gl) { ctx.globalAlpha = al * 0.8; ctx.fillStyle = '#fff'; const gr = Math.floor(hh(fr) * 6); for (const side of [-1, 1]) ctx.fillRect(side * sep - 3.4 * pitch, cy + (gr - 3) * pitch, 6.8 * pitch, pitch * 0.35); }
    ctx.globalAlpha = al * 0.1; ctx.fillStyle = '#fff'; const yy = cy + (((tiempo * 0.5) % 1) - 0.5) * 6.6 * pitch; for (const side of [-1, 1]) ctx.fillRect(side * sep - 3.2 * pitch, yy - 0.05 * pitch, 6.4 * pitch, 0.1 * pitch);
    ctx.restore();
  }

  // ---- estilo 2: ojos liquidos (blanco cian claro, pupila oscura grande que sigue y se dilata, dos reflejos, parpados suaves) ----
  function ojos2(al, o) {
    const k = baseK(o), cy = (o.eyeY ?? -0.12) + 0.035, sep = 0.40, P = ojosPal(), sz = 1 + 0.16 * PZ.wow + 0.05 * pulso + 0.03 * vozN, gs = gsum();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, rx = 0.27 * k * sz, ry = 0.31 * k * sz, cx = side * sep + E.px * 0.014 + jx, cy2 = cy + E.py * 0.012 + jy, ab = A * (1 - gs);
      if (ab > 0.02) {
        ctx.save(); ctx.globalAlpha = ab; const eye = new Path2D(); eye.ellipse(cx, cy2, rx, ry, 0, 0, TAU);
        ctx.lineWidth = 0.055; ctx.strokeStyle = rgba(P.c, 0.28); ctx.stroke(eye);
        const gr = ctx.createRadialGradient(cx - rx * 0.25, cy2 - ry * 0.3, rx * 0.1, cx, cy2, ry * 1.05); gr.addColorStop(0, rgba(P.blanco)); gr.addColorStop(0.7, rgba(mezcla(P.blanco, P.c, 0.18))); gr.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.55))); ctx.fillStyle = gr; ctx.fill(eye);
        ctx.save(); ctx.clip(eye);
        const pr = clamp(rx * 0.56 * (1 + 0.45 * PZ.dil), rx * 0.3, rx * 0.8), mX = rx - pr * 0.5, mY = ry - pr * 0.5, pdx = clamp(E.px * rx * 0.5, -mX, mX), pdy = clamp(E.py * ry * 0.5 - 0.3 * ry * PZ.happy, -mY, mY), pxx = cx + pdx, pyy = cy2 + pdy;
        const ig = ctx.createRadialGradient(pxx, pyy, pr * 0.2, pxx, pyy, pr * 1.2); ig.addColorStop(0, rgba(P.osc)); ig.addColorStop(0.72, rgba(mezcla(P.osc, P.c, 0.18))); ig.addColorStop(1, rgba(mezcla(P.osc, P.c, 0.7)));
        ctx.fillStyle = ig; ctx.beginPath(); ctx.ellipse(pxx, pyy, pr * 1.02, pr * 1.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(pxx - pr * 0.36, pyy - pr * 0.40, pr * 0.30, pr * 0.37, -0.5, 0, TAU); ctx.fill(); ctx.globalAlpha = ab * 0.85; ctx.beginPath(); ctx.arc(pxx + pr * 0.42, pyy + pr * 0.44, pr * 0.13, 0, TAU); ctx.fill(); ctx.globalAlpha = ab;
        const L = lidFns(side, 0, 0, 0.55), R = regiones(L, cx, cy2, rx, ry); ctx.fillStyle = rgba(P.lid, 1); ctx.fill(R.lt); ctx.fill(R.lb);
        trazo(R.T, 0.034, P.c, 0.35); trazo(R.T, 0.014, P.luz, 0.95); trazo(R.B, 0.034, P.c, 0.35); trazo(R.B, 0.014, P.luz, 0.95);
        ctx.restore(); ctx.lineWidth = 0.014; ctx.strokeStyle = rgba(P.osc, 0.75); ctx.stroke(eye); ctx.restore();
      }
      glifos(A, side, cx, cy2, rx, ry, P);
    }
    barrasRuido(cy, al);
  }

  // ---- estilo 3 (v2): ojos almendrados, rasgados, con inclinacion cantal positiva y cejas de luz finas ----
  const ANG3 = 0.185; // ~10.6 grados: la esquina exterior queda mas alta que la interior (espejo en el otro ojo)
  function ceja(side, cx, topY, rx, P, al) {
    const s = side < 0 ? 0 : 1, Y = clamp(brY[s].x, -1.2, 1.6), Tt = clamp(brT[s].x, -1.1, 1.1), bw = rx * 0.72, pts = [], dir = -side; // dir: hacia el lagrimal
    for (let i = 0; i <= 10; i++) { const u = -1 + 2 * i / 10; pts.push([cx + dir * (u * bw - 0.012), topY - 0.045 - 0.17 * Y + 0.048 * u + 0.1 * Tt * u - 0.02 * (1 - u * u) * (1 + 0.8 * PZ.happy) + 0.06 * PZ.close]); }
    ctx.save(); ctx.globalAlpha = al; trazo(pts, 0.05, P.osc, 0.26); trazo(pts, 0.04, P.c, 0.3); trazo(pts, 0.021, P.blanco, 1); ctx.restore();
  }
  function almendra(rx, ry, tA, bA, tilt) { // contorno en coordenadas del ojo: u=-1 esquina exterior, u=+1 lagrimal (interior)
    const N = 22, U = [], B = [];
    for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N, q = (u + 1) / 2, g = Math.max(0, 1 - u * u);
      const f = clamp(1 - 0.30 * q - 0.55 * tilt * q, 0.05, 1);
      U.push([u * rx, -ry * tA * Math.pow(g, 0.95) * f]);
      B.push([u * rx, Math.max(U[i][1] + 0.004, ry * bA * Math.pow(g, 0.72) * (1 + 0.05 * u))]); }
    const o = new Path2D(); U.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); for (let i = N; i >= 0; i--) o.lineTo(B[i][0], B[i][1]); o.closePath();
    return { o, U, B };
  }
  function ojos3(al, o) {
    const k = baseK(o), cy = (o.eyeY ?? -0.12) + 0.035, P = ojosPal(), sz = 1 + 0.05 * pulso + 0.03 * vozN, gs = gsum(), sep = Math.max(0.44, 0.30 * k * sz * 1.12 * 1.12 + 0.10); // separacion minima: los ojos nunca se pisan aunque la forma o el zoom los agrande
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, ab = A * (1 - gs), m = -side,
        rx = 0.30 * k * sz * (1 + 0.12 * PZ.wow), ry = 0.26 * k * sz, cx = side * sep + E.px * 0.05 + jx, cy2 = cy + E.py * 0.05 + jy,
        hp = Math.max(PZ.happy, side > 0 ? PZ.wink : 0), ap = 0.70 + 0.30 * PZ.wow + 0.10 * PZ.alert * (1 - PZ.wow) + 0.06 * vozN;
      let tA = ap * clamp(1 - 1.5 * PZ.lid, 0.22, 1.2), bA = ap * (1 - 1.9 * hp);
      tA = lerp(tA, 0.05, PZ.close); bA = lerp(bA, 0.05, PZ.close);
      if (ab > 0.02) {
        const S3 = almendra(rx, ry, tA, bA, PZ.tilt);
        ctx.save(); ctx.translate(cx, cy2); ctx.scale(m, 1); ctx.rotate(ANG3);
        ctx.globalAlpha = ab * 0.55 * (1 - 0.7 * hp); ctx.lineWidth = 0.05; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.osc, 1); ctx.fillStyle = rgba(P.osc, 1); ctx.stroke(S3.o); ctx.fill(S3.o);
        ctx.globalAlpha = ab; ctx.save(); ctx.clip(S3.o); ctx.lineWidth = 0.07; ctx.strokeStyle = rgba(P.c, 0.3); ctx.stroke(S3.o);
        const g = ctx.createLinearGradient(0, -ry * tA, 0, ry * Math.max(bA, 0.2)); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(0.55, rgba(mezcla(P.blanco, P.c, 0.2))); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.55))); ctx.fillStyle = g; ctx.fill(S3.o);
        ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); ctx.ellipse(-rx * 0.28, -ry * tA * 0.42, rx * 0.2, ry * 0.1 * Math.max(0.3, tA), -0.12, 0, TAU); ctx.fill(); ctx.restore();
        trazo(S3.U, 0.017, P.luz, 0.9); trazo(S3.B, 0.012, P.luz, 0.55); ctx.restore();
      }
      glifos(A, side, cx, cy2, rx * 0.62, ry * 1.2, P);
      ceja(side, cx, cy2 - ry * Math.max(tA, 0.45) * 0.9, rx, P, A * (1 - PZ.heart * 0.5 - PZ.star * 0.5));
    }
    barrasRuido(cy, al);
  }

  // ---- estilo 4: asimetricos y curiosos (uno mas grande, iris de lente con anillo que gira y enfoca) ----
  function ojos4(al, o) {
    const k = baseK(o), cy = (o.eyeY ?? -0.12) + 0.035, P = ojosPal(), sz = 1 + 0.14 * PZ.wow + 0.05 * pulso + 0.03 * vozN, gs = gsum(), lx = clamp(E.px, -1, 1), peq = esAvatar;
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, r = k * (side < 0 ? 0.31 : 0.225) * sz * (1 + 0.06 * lx * side), cx = side * 0.40 + (side < 0 ? -0.015 : 0.02) + E.px * 0.02 + jx, cy2 = cy + (side < 0 ? 0.01 : -0.035) + E.py * 0.015 + jy, ab = A * (1 - gs);
      if (ab > 0.02) {
        ctx.save(); ctx.globalAlpha = ab; const eye = new Path2D(); eye.arc(cx, cy2, r, 0, TAU);
        ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(P.c, 0.3); ctx.stroke(eye); ctx.fillStyle = rgba(mezcla(P.osc, P.blanco, 0.9 * PZ.wow), 0.94); ctx.fill(eye);
        ctx.save(); ctx.clip(eye);
        const gx = cx + E.px * r * 0.15, gy = cy2 + E.py * r * 0.15, ir = r * (0.82 - 0.17 * PZ.wow), fo = PZ.foc, ig = ctx.createRadialGradient(gx, gy, ir * 0.1, gx, gy, ir); ig.addColorStop(0, rgba(P.osc)); ig.addColorStop(0.42, rgba(mezcla(P.c, P.osc, 0.5))); ig.addColorStop(0.8, rgba(P.c)); ig.addColorStop(1, rgba(P.luz));
        ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(gx, gy, ir, 0, TAU); ctx.fill(); ctx.lineWidth = 0.016; ctx.strokeStyle = rgba(P.blanco, 0.95); ctx.stroke();
        const fr = ir * (0.7 - 0.17 * fo + 0.1 * PZ.wow);
        if (!peq) { ctx.save(); ctx.translate(gx, gy); ctx.rotate(ringA * (side < 0 ? 1 : -1)); ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.setLineDash([fr * 0.3, fr * 0.2]); ctx.lineWidth = 0.014; ctx.strokeStyle = rgba(P.blanco, 0.85); ctx.stroke(); ctx.setLineDash([]); ctx.rotate(-ringA * (side < 0 ? 1 : -1) * 1.6);
          ctx.globalAlpha = ab * (0.25 + 0.7 * fo * fo); ctx.lineWidth = 0.014; ctx.beginPath(); for (let q = 0; q < 4; q++) { const a = q * PI / 2 + PI / 4; ctx.moveTo(Math.cos(a) * fr * 1.12, Math.sin(a) * fr * 1.12); ctx.lineTo(Math.cos(a) * ir * 0.92, Math.sin(a) * ir * 0.92); } ctx.stroke(); ctx.restore(); }
        else { ctx.lineWidth = 0.02; ctx.strokeStyle = rgba(P.blanco, 0.8); ctx.beginPath(); ctx.arc(gx, gy, fr, 0, TAU); ctx.stroke(); }
        const pr = r * (esAvatar ? 0.4 : 0.27 - 0.08 * fo + 0.06 * PZ.dil + 0.04 * vozN - 0.1 * PZ.wow); ctx.fillStyle = 'rgba(24,12,2,1)'; ctx.beginPath(); ctx.arc(gx, gy, pr, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx - pr * 0.38, gy - pr * 0.4, Math.max(pr * 0.3, 0.012), 0, TAU); ctx.fill();
        ctx.globalAlpha = ab; const L = lidFns(side, 0, 0, 0.55), R = regiones(L, cx, cy2, r, r); ctx.fillStyle = rgba(P.osc, 0.98); ctx.fill(R.lt); ctx.fillStyle = rgba(P.lid, 1); ctx.fill(R.lb); trazo(R.T, 0.034, P.c, 0.3); trazo(R.T, 0.014, P.luz, 0.95); trazo(R.B, 0.034, P.c, 0.3); trazo(R.B, 0.014, P.luz, 0.95);
        ctx.restore(); ctx.lineWidth = 0.014; ctx.strokeStyle = rgba(P.luz, 0.85); ctx.stroke(eye); ctx.restore();
      }
      glifos(A, side, cx, cy2, r, r, P);
    }
    barrasRuido(cy, al);
  }

  // ---- estilo 5: medias lunas de luz (la geometria cambia con el animo: normal, ^ ^, - -, \ /, o o) ----
  function ojos5(al, o) {
    const k = baseK(o), cy = (o.eyeY ?? -0.12) + 0.035, sep = 0.40, P = ojosPal(), sz = 1 + 0.12 * PZ.wow + 0.05 * pulso + 0.03 * vozN, gs = gsum();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, r = 0.28 * k * sz, cx = side * sep + E.px * 0.05 + jx, cy2 = cy + E.py * 0.06 + jy, ab = A * (1 - gs);
      if (ab > 0.02) {
        ctx.save(); const disc = new Path2D(); disc.arc(cx, cy2, r, 0, TAU); ctx.globalAlpha = ab * 0.62 * (1 - 0.8 * Math.max(PZ.happy, side > 0 ? PZ.wink : 0) - 0.5 * PZ.close); ctx.fillStyle = rgba(P.osc, 1); ctx.beginPath(); ctx.arc(cx, cy2, r * 1.08, 0, TAU); ctx.fill();
        ctx.globalAlpha = ab * 0.35; ctx.lineWidth = 0.012; ctx.strokeStyle = rgba(P.c, 1); ctx.stroke(disc);
        const L = lidFns(side, 0.15 * (1 - PZ.alert), 0.2 * (1 - PZ.alert), 0.78), R = regiones(L, cx, cy2, r, r); ctx.globalAlpha = ab; ctx.save(); ctx.clip(R.open);
        ctx.lineWidth = 0.075; ctx.strokeStyle = rgba(P.c, 0.32); ctx.stroke(disc);
        const g = ctx.createRadialGradient(cx - r * 0.2, cy2 - r * 0.25, r * 0.05, cx, cy2, r * 1.05); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(0.6, rgba(mezcla(P.blanco, P.c, 0.2))); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.6))); ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.5), 1); ctx.fill(disc); ctx.save(); ctx.clip(disc); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx - r * 0.1, cy2 - r * 0.13, r * 0.93, 0, TAU); ctx.fill(); ctx.restore();
        if (PZ.wow > 0.02) { ctx.globalAlpha = ab * clamp(PZ.wow * 1.2, 0, 1); ctx.fillStyle = rgba(P.osc, 0.96); ctx.beginPath(); ctx.arc(cx, cy2, r * 0.5 * PZ.wow, 0, TAU); ctx.fill(); ctx.globalAlpha = ab; }
        ctx.restore(); ctx.save(); ctx.clip(disc); ctx.lineWidth = 0.02; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.osc, 0.4); ctx.stroke(R.open); trazo(R.T, 0.016, P.blanco, 0.9); trazo(R.B, 0.016, P.blanco, 0.9); ctx.restore(); ctx.restore();
      }
      glifos(A, side, cx, cy2, r, r, P);
    }
    barrasRuido(cy, al);
  }
  // ---- estilos 6-9 (chill): almendras pequenas (~65 %), cejas de luz con forma propia; cada uno con su rasgo ----
  // 6 parpado caido · 7 ceja rota + pupila de gato + rayo · 8 asimetrico (un ojo mas cerrado, una ceja mas alta, punto con aro) · 9 lineas de luz minimalistas
  const CEJA_CHILL = {
    6: { th: 0.05, gap: 0.03, slope: 0.05, arch: 0.0, archH: 0.012, tiltK: 1, bw: 1.0 },
    7: { th: 0.032, gap: 0.05, slope: 0.035, arch: 0.014, archH: 0.016, tiltK: 1, bw: 0.98 },
    8: { th: 0.034, gap: 0.045, slope: 0.04, arch: 0.016, archH: 0.016, tiltK: 1, bw: 0.98 },
    9: { th: 0.017, gap: 0.075, slope: 0.03, arch: 0.016, archH: 0.03, tiltK: 1.6, bw: 1.04 },
  };
  function cejaPol(side, cx, cy2, ry, rx, P, al, c) {
    const s = side < 0 ? 0 : 1, Y = clamp(brY[s].x + (c.dY || 0), -1.2, 1.9), Tt = clamp(brT[s].x, -1.1, 1.1), hp = PZ.happy, bw = rx * c.bw, hw = c.th / 2,
      base = cy2 - ry - c.gap - 0.15 * Y + 0.05 * PZ.close - (c.dG || 0),
      yf = u => base + c.slope * u + 0.1 * c.tiltK * Tt * u - (c.arch + c.archH * hp) * (1 - u * u),
      segs = c.cut ? [[-1, c.cut[0], 0, c.slant], [c.cut[1], 1, c.slant, 0]] : [[-1, 1, 0, 0]];
    const poly = (lo, hi, sLo, sHi) => { const Q = new Path2D(), N = 8, cl = u => clamp(u, -1, 1);
      for (let i = 0; i <= N; i++) { const u = cl(lerp(lo + sLo, hi + sHi, i / N)); i ? Q.lineTo(u * bw, yf(u) - hw) : Q.moveTo(u * bw, yf(u) - hw); }
      for (let i = N; i >= 0; i--) { const u = cl(lerp(lo - sLo, hi - sHi, i / N)); Q.lineTo(u * bw, yf(u) + hw); } Q.closePath(); return Q; };
    ctx.save(); ctx.translate(cx, 0); ctx.scale(-side, 1); ctx.lineJoin = 'round';
    for (const g of segs) { const Q = poly(g[0], g[1], g[2], g[3]);
      ctx.globalAlpha = al; ctx.lineWidth = 0.055; ctx.strokeStyle = rgba(P.osc, 0.24); ctx.stroke(Q); ctx.lineWidth = 0.032; ctx.strokeStyle = rgba(P.c, 0.34); ctx.stroke(Q);
      ctx.fillStyle = rgba(P.blanco, 1); ctx.fill(Q); ctx.lineWidth = 0.007; ctx.strokeStyle = rgba(P.blanco, 1); ctx.stroke(Q); }
    ctx.restore();
  }
  function ojosChill(v, al, o) {
    const k = baseK(o), cy = (o.eyeY ?? -0.12) + 0.035, sep = 0.42, P = ojosPal(), sz = 1 + 0.04 * pulso + 0.03 * vozN, gs = gsum(), cj = CEJA_CHILL[v];
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, ab = A * (1 - gs), m = -side,
        rx = (v === 9 ? 0.215 : 0.205) * k * sz * (1 + 0.1 * PZ.wow), ry = (v === 9 ? 0.098 : 0.168) * k * sz * (1 + 0.22 * PZ.wow),
        cx = side * sep + E.px * 0.035 + jx, cy2 = cy + E.py * 0.035 + jy, hp = Math.max(PZ.happy, side > 0 ? PZ.wink : 0),
        ap = 0.72 + 0.28 * PZ.wow + 0.08 * PZ.alert * (1 - PZ.wow) + 0.05 * vozN;
      let tA = ap * clamp(1 - 1.5 * PZ.lid, 0.25, 1.2), bA = ap * (1 - 1.9 * hp), dY = 0, dG = 0;
      if (v === 8) { const cie = (side < 0 ? 0.36 : 0.04) * (1 - 0.8 * PZ.wow); tA *= 1 - cie; dY = side < 0 ? -0.2 : 0.6; dG = side < 0 ? -0.012 : 0.0; }
      tA = lerp(tA, 0.05, PZ.close); bA = lerp(bA, 0.05, PZ.close);
      if (ab > 0.02) {
        const S3 = almendra(rx, ry, tA, bA, PZ.tilt + (v === 8 && side < 0 ? 0.12 : 0)), yT = -ry * ap, yB = ry * ap;
        ctx.save(); ctx.translate(cx, cy2); ctx.scale(m, 1); ctx.rotate(v === 9 ? 0.15 : ANG3 * (v === 8 && side > 0 ? 0.6 : 1));
        ctx.globalAlpha = ab * (v === 9 ? 0.4 : 0.55) * (1 - 0.7 * hp); ctx.lineWidth = v === 9 ? 0.06 : 0.042; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.osc, 1); ctx.fillStyle = rgba(P.osc, 1); ctx.stroke(S3.o); ctx.fill(S3.o);
        ctx.globalAlpha = ab; ctx.save(); ctx.clip(S3.o); ctx.lineWidth = v === 9 ? 0.1 : 0.06; ctx.strokeStyle = rgba(P.c, v === 9 ? 0.45 : 0.3); ctx.stroke(S3.o);
        if (v === 9) { ctx.fillStyle = rgba(mezcla(P.blanco, [255, 255, 255], 0.5), 1); ctx.fill(S3.o); }
        else { const g = ctx.createLinearGradient(0, -ry * tA, 0, ry * Math.max(bA, 0.2)); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(0.55, rgba(mezcla(P.blanco, P.c, 0.2))); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.55))); ctx.fillStyle = g; ctx.fill(S3.o); }
        const gx = E.px * rx * 0.34, gy = E.py * ry * 0.22, pv = 1 - PZ.close;
        if (v === 6) { // iris tranquilo medio tapado + parpado pesado + reflejo diagonal
          const cov = lerp(clamp(0.45 + 0.55 * PZ.lid - 0.3 * PZ.wow - 0.1 * PZ.alert - 0.35 * hp, 0.1, 0.85), 1, PZ.close), ly = yT + cov * (yB - yT), pr = ry * (0.56 + 0.12 * PZ.dil + 0.06 * PZ.wow);
          const ig = ctx.createRadialGradient(gx, gy + ry * 0.2, pr * 0.15, gx, gy + ry * 0.2, pr); ig.addColorStop(0, rgba(P.osc)); ig.addColorStop(0.75, rgba(mezcla(P.osc, P.c, 0.25))); ig.addColorStop(1, rgba(mezcla(P.osc, P.c, 0.7)));
          ctx.globalAlpha = ab * pv; ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(gx, gy + ry * 0.2, pr, 0, TAU); ctx.fill();
          ctx.globalAlpha = ab * 0.9 * pv * clamp(1 - cov * 0.6, 0, 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.022; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx + pr * 0.52, gy + ry * 0.2 - pr * 0.1); ctx.lineTo(gx + pr * 0.2, gy + ry * 0.2 + pr * 0.42); ctx.stroke();
          ctx.globalAlpha = ab; ctx.fillStyle = rgba(mezcla(P.c, P.osc, 0.55), 0.97); ctx.beginPath(); ctx.moveTo(-rx * 1.4, ly - 4 * ry); ctx.lineTo(-rx * 1.4, ly); ctx.lineTo(rx * 1.4, ly); ctx.lineTo(rx * 1.4, ly - 4 * ry); ctx.fill();
          ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.luz, 0.95); ctx.beginPath(); ctx.moveTo(-rx * 1.2, ly); ctx.lineTo(rx * 1.2, ly); ctx.stroke(); }
        if (v === 7) { // pupila vertical de gato (sutil) + reflejo en rayo
          const pw = rx * (0.085 + 0.05 * PZ.dil) * (1 - 0.3 * PZ.wow), ph = ry * 0.78 * Math.min(1, tA / ap + 0.3) * pv;
          ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.5), 0.55); ctx.beginPath(); ctx.ellipse(gx, gy, rx * 0.3, ry * 0.62 * pv, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = rgba(P.osc, 1); ctx.beginPath(); ctx.ellipse(gx, gy, pw, Math.max(0.001, ph), 0, 0, TAU); ctx.fill();
          const bx = gx - rx * 0.46, by = gy - ry * 0.34, bs = rx * 0.26; ctx.globalAlpha = ab * 0.95 * pv; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(bx + 0.5 * bs, by - 1.0 * bs); ctx.lineTo(bx - 0.5 * bs, by + 0.12 * bs); ctx.lineTo(bx - 0.02 * bs, by + 0.12 * bs); ctx.lineTo(bx - 0.4 * bs, by + 1.0 * bs); ctx.lineTo(bx + 0.55 * bs, by - 0.22 * bs); ctx.lineTo(bx + 0.06 * bs, by - 0.22 * bs); ctx.closePath(); ctx.fill(); }
        if (v === 8) { // punto solido con aro fino
          const pr = ry * (0.27 - 0.07 * PZ.wow + 0.05 * PZ.dil), gx2 = gx * 1.15, gy2 = gy + ry * 0.04;
          ctx.globalAlpha = ab * pv; ctx.lineWidth = 0.013; ctx.strokeStyle = rgba(P.osc, 0.85); ctx.beginPath(); ctx.arc(gx2, gy2, pr * 1.75, 0, TAU); ctx.stroke();
          ctx.fillStyle = rgba(P.osc, 1); ctx.beginPath(); ctx.arc(gx2, gy2, pr, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx2 - pr * 0.35, gy2 - pr * 0.38, Math.max(pr * 0.26, 0.008), 0, TAU); ctx.fill(); }
        ctx.restore();
        trazo(S3.U, v === 9 ? 0.012 : (v === 8 ? 0.022 : 0.017), P.luz, 0.92); if (v !== 9) trazo(S3.B, 0.012, P.luz, 0.55); if (hp > 0.05) { trazo(S3.U, 0.07, P.c, 0.35 * hp); trazo(S3.U, 0.04, P.blanco, hp); }
        ctx.restore();
      }
      glifos(A, side, cx, cy2, rx * 0.85, ry * (v === 9 ? 2.6 : 1.7), P);
      cejaPol(side, cx, cy2, ry, rx, P, A * (1 - PZ.heart * 0.5 - PZ.star * 0.5), Object.assign({ dY, dG }, cj, v === 7 && side < 0 ? { cut: [-0.06, 0.36], slant: 0.2 } : {}));
    }
    barrasRuido(cy, al);
  }
  // ---- estilos 10-15 (elegantes): sin pupila, simetricos en espejo, bordes nitidos, cian de marca con brillo contenido ----
  // 10 almendra solida afilada + ceja · 11 ceja y ojo en un trazo · 12 parpado de luz + hueco · 13 facetado · 14 doble linea · 15 hoja minimal
  const ELEG = {
    10: { rx: 0.225, ry: 0.150, ang: 0.17, wy: 0.3 }, 11: { rx: 0.215, ry: 0.140, ang: 0.16, wy: 0.3 }, 12: { rx: 0.225, ry: 0.150, ang: 0.15, wy: 0.3 },
    13: { rx: 0.225, ry: 0.150, ang: 0.14, wy: 0.3 }, 14: { rx: 0.235, ry: 0.160, ang: 0.15, wy: 0.3 }, 15: { rx: 0.265, ry: 0.064, ang: 0.25, wy: 0.75 },
  };
  function perfil(u, p, a, b) { const q = u < p ? 0.5 * (u + 1) / (p + 1) : 0.5 + 0.5 * (u - p) / (1 - p); return Math.pow(Math.max(0, Math.sin(PI * clamp(q, 0, 1))), u < p ? a : b); } // cupula suave con puntas: a = afilado exterior, b = redondez del lagrimal
  function formaOjo(rx, ry, tA, bA, tilt, c) { // contorno de ojo: u=-1 esquina exterior (afilada), u=+1 lagrimal
    const N = 28, U = [], B = []; const o = new Path2D();
    for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N, q = (u + 1) / 2, f = clamp(1 - 0.10 * q - 0.6 * tilt * q, 0.06, 1), lf = -ry * (c.lift || 0) * Math.pow(1 - q, 2.2);
      U.push([u * rx, -ry * tA * perfil(u, c.p, c.aU, c.bU) * f + lf]);
      B.push([u * rx, Math.max(U[i][1] + 0.003, ry * bA * perfil(u, c.pL ?? c.p, c.aL, c.bL) + lf)]); }
    U.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); for (let i = N; i >= 0; i--) o.lineTo(B[i][0], B[i][1]); o.closePath();
    return { o, U, B };
  }
  function cinta(P, hw) { // polilinea con grosor variable -> poligono
    const n = P.length, L = [], R = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const w = hw(i / (n - 1)); L.push([P[i][0] - dy * w, P[i][1] + dx * w]); R.push([P[i][0] + dy * w, P[i][1] - dx * w]); }
    const Q = new Path2D(); L.forEach((p, i) => i ? Q.lineTo(p[0], p[1]) : Q.moveTo(p[0], p[1])); for (let i = n - 1; i >= 0; i--) Q.lineTo(R[i][0], R[i][1]); Q.closePath(); return Q;
  }
  function luzForma(Q, P, a, y0, y1, aF = 1) { // relleno cian con degradado suave + borde nitido y halo corto
    ctx.save(); ctx.lineJoin = 'round'; ctx.globalAlpha = a * 0.5; ctx.lineWidth = 0.046; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(Q);
    ctx.globalAlpha = a; ctx.lineWidth = 0.028; ctx.strokeStyle = rgba(P.c, 0.24); ctx.stroke(Q);
    if (y1 - y0 < 0.002) y1 = y0 + 0.002; const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.42)));
    ctx.globalAlpha = a * aF; ctx.fillStyle = g; ctx.fill(Q); ctx.globalAlpha = a; ctx.lineWidth = 0.007; ctx.strokeStyle = rgba(P.osc, 0.75); ctx.stroke(Q); ctx.restore();
  }
  function cejaFina(side, cx, yb, bw, x0, hwMax, P, al, modo) { // ceja fina separada del ojo (en el sistema espejado, u=-1 exterior)
    const s = side < 0 ? 0 : 1, Y = clamp(brY[s].x, -1.2, 1.9), Tt = clamp(brT[s].x, -1.1, 1.1), pts = [], N = 12, ar = 0.012 + 0.018 * PZ.happy;
    for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; pts.push([x0 + u * bw, yb - 0.15 * Y + 0.05 * PZ.close + 0.05 * u + 0.1 * Tt * u - ar * (1 - u * u)]); }
    ctx.save(); ctx.translate(cx, 0); ctx.scale(-side, 1);
    if (modo === 'neon') { ctx.globalAlpha = al; trazo(pts, 0.05, P.osc, 0.28); trazo(pts, 0.03, P.c, 0.3); trazo(pts, 0.013, P.blanco, 1); }
    else luzForma(cinta(pts, t => hwMax * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.55) + 0.0022), P, al, yb, yb);
    ctx.restore();
  }
  function ojosEleg(v, al, o) {
    const C = ELEG[v], k = baseK(o) * (v === 15 ? 1.2 : 1.25), cy = (o.eyeY ?? -0.12) + 0.035, sep = 0.42, P = ojosPal(), sz = 1 + 0.04 * pulso + 0.03 * vozN, gs = gsum(), w = PZ.wow;
    for (let s = 0; s < 2; s++) {
      const side = s ? 1 : -1, [jx, jy, ja] = jit(side), A = al * ja, ab = A * (1 - gs), m = -side, hp = Math.max(PZ.happy, side > 0 ? PZ.wink : 0), tilt = PZ.tilt,
        rx = C.rx * k * sz * (1 + 0.05 * w - (v === 15 ? 0.12 * w : 0)), ry = C.ry * k * sz * (1 + C.wy * w + 0.14 * vozN), cx = side * sep + E.px * 0.045 + jx, cy2 = cy + E.py * 0.05 + jy,
        ap = 0.76 + 0.26 * w + 0.12 * PZ.alert * (1 - w);
      let tA = ap * clamp(1 - 1.5 * PZ.lid, 0.25, 1.2), bA = ap * (1 - 1.9 * hp); tA = lerp(tA, 0.05, PZ.close); bA = lerp(bA, 0.05, PZ.close);
      const rd = 1 - 0.3 * w; // sorpresa: la forma se redondea un poco (puntas menos largas)
      const ang = C.ang + (v === 15 ? 0.3 * tilt : 0.08 * tilt);
      if (ab > 0.02) {
        ctx.save(); ctx.translate(cx, cy2); ctx.scale(m, 1); ctx.rotate(ang);
        if (v === 10) {
          const S = formaOjo(rx, ry, tA, bA, tilt, { p: 0.12, aU: 1.2 * rd, bU: 0.7, pL: -0.05, aL: 1.15 * rd, bL: 0.75, lift: 0.3 * (1 - w) });
          luzForma(S.o, P, ab, -ry * tA, ry * bA);
          ctx.save(); ctx.clip(S.o); ctx.globalAlpha = ab * 0.55 * (1 - PZ.close); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(P.c, 1); ctx.lineWidth = 0.014; ctx.beginPath(); for (let i = 7; i <= 17; i++) { const p = S.U[i]; i === 7 ? ctx.moveTo(p[0], p[1] + ry * 0.16 * tA) : ctx.lineTo(p[0], p[1] + ry * 0.16 * tA); } ctx.stroke(); ctx.restore();
          if (hp > 0.05) { trazo(S.U, 0.07, P.c, 0.35 * hp * ab); trazo(S.U, 0.036, P.blanco, hp * ab); }
        } else if (v === 11) {
          const S = formaOjo(rx, ry, tA, bA, tilt, { p: 0.1, aU: 1.12, bU: 0.7, pL: 0.0, aL: 1.0, bL: 0.75, lift: 0.1 });
          const s0 = clamp(brY[s].x, -1.2, 1.9), g = clamp(0.092 + 0.06 * s0 - 0.05 * PZ.close, 0.05, 0.14), Tt = clamp(brT[s].x, -1.1, 1.1);
          luzForma(S.o, P, ab, -ry * tA, ry * bA, 0.88);
          const br = []; for (let i = S.U.length - 1; i >= 0; i--) { const p = S.U[i], u = p[0] / rx; br.push([u * rx * 0.98, -g + 0.4 * p[1] + 0.1 * Tt * u]); }
          const A0 = br[br.length - 1], B0 = S.U[0], mx = (A0[0] + B0[0]) / 2, my = (A0[1] + B0[1]) / 2, hr = Math.hypot(A0[0] - B0[0], A0[1] - B0[1]) / 2 + 1e-6, dx = (A0[0] - B0[0]) / (2 * hr), dy = (A0[1] - B0[1]) / (2 * hr), hook = [];
          for (let i = 1; i < 9; i++) { const th = Math.PI * i / 9; hook.push([mx + hr * Math.cos(th) * dx - hr * 1.5 * Math.sin(th), my + hr * Math.cos(th) * dy]); }
          const pts = br.concat(hook, S.U);
          const Q = cinta(pts, t => 0.0032 + 0.0105 * Math.exp(-Math.pow((t - 0.36) / 0.2, 2)) + (t > 0.4 ? 0.0075 * Math.pow(1 - t, 0.7) : 0));
          luzForma(Q, P, ab, -ry * 1.4, 0.0);
          if (hp > 0.05) trazo(S.U, 0.034, P.blanco, hp * ab);
        } else if (v === 12) {
          const S = formaOjo(rx, ry, tA, bA, tilt, { p: 0.05, aU: 1.15 * rd, bU: 0.65, pL: 0.0, aL: 0.95, bL: 0.7, lift: 0.15 * (1 - w) });
          const fr = clamp(0.40 + 0.3 * PZ.lid - 0.22 * w - 0.08 * PZ.alert, 0.18, 0.75), Lb = S.U.map((p, i) => [p[0], p[1] + (S.B[i][1] - p[1]) * clamp(fr + 0.12 * i / 28, 0, 1)]);
          ctx.globalAlpha = ab * 0.5; ctx.lineWidth = 0.046; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(S.o);
          ctx.fillStyle = rgba(mezcla(P.c, P.osc, 0.5), 1); ctx.globalAlpha = ab * 0.62; ctx.fill(S.o);
          ctx.save(); ctx.clip(S.o); const band = new Path2D(); S.U.forEach((p, i) => i ? band.lineTo(p[0], p[1] - 0.04) : band.moveTo(p[0], p[1] - 0.04)); for (let i = Lb.length - 1; i >= 0; i--) band.lineTo(Lb[i][0], Lb[i][1]); band.closePath();
          const g = ctx.createLinearGradient(0, -ry * tA, 0, ry * 0.3); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.42))); ctx.globalAlpha = ab; ctx.fillStyle = g; ctx.fill(band);
          trazo(Lb, 0.011, P.luz, 0.95 * (1 - PZ.close)); ctx.restore();
          ctx.globalAlpha = ab; ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.c, 0.22); ctx.stroke(S.o); ctx.lineWidth = 0.007; ctx.strokeStyle = rgba(P.luz, 0.9); ctx.stroke(S.o);
          trazo(S.U, 0.014, P.luz, ab);
          if (hp > 0.05) { trazo(S.U, 0.07, P.c, 0.35 * hp * ab); trazo(S.U, 0.036, P.blanco, hp * ab); }
        } else if (v === 13) {
          const ti = clamp(1 - 0.7 * tilt, 0.3, 1), V = [[-1.08, 0], [-0.48, -0.86 * tA], [0.30, -1.0 * tA * lerp(1, ti, 0.8)], [1.0, -0.28 * tA * ti]].map(p => [p[0] * rx, p[1] * ry]);
          const yUp = x => { for (let i = 0; i < 3; i++) if (x <= V[i + 1][0]) return lerp(V[i][1], V[i + 1][1], (x - V[i][0]) / (V[i + 1][0] - V[i][0])); return V[3][1]; };
          const low = [[0.86, 0.45], [-0.05, 1.0], [-0.62, 0.52]].map(p => { const x = p[0] * rx; return [x, Math.max(yUp(x) + 0.004, p[1] * ry * bA)]; });
          const poly = V.concat(low), nn = poly.length, Cc = [0.0, -0.1 * ry];
          const Q = new Path2D(); poly.forEach((p, i) => i ? Q.lineTo(p[0], p[1]) : Q.moveTo(p[0], p[1])); Q.closePath();
          ctx.lineJoin = 'miter'; ctx.globalAlpha = ab * 0.5; ctx.lineWidth = 0.046; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(Q); ctx.globalAlpha = ab; ctx.lineWidth = 0.028; ctx.strokeStyle = rgba(P.c, 0.24); ctx.stroke(Q);
          const tonos = [0.0, 0.18, 0.05, 0.3, 0.75, 1.3, 0.5, 0.12]; // facetas: 0 blanco -> 1 cian -> 2 oscuro
          for (let i = 0; i < nn; i++) { const a = poly[i], b = poly[(i + 1) % nn], t = tonos[i % tonos.length]; const F = new Path2D(); F.moveTo(Cc[0], Cc[1]); F.lineTo(a[0], a[1]); F.lineTo(b[0], b[1]); F.closePath();
            ctx.globalAlpha = ab; ctx.fillStyle = rgba(t <= 1 ? mezcla(P.blanco, P.c, t) : mezcla(P.c, P.osc, (t - 1) * 1.2)); ctx.fill(F); ctx.lineWidth = 0.004; ctx.strokeStyle = rgba(P.c, 0.45); ctx.stroke(F); }
          ctx.globalAlpha = ab; ctx.lineWidth = 0.008; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(Q);
          if (hp > 0.05) { trazo(V, 0.07, P.c, 0.35 * hp * ab); trazo(V, 0.036, P.blanco, hp * ab); }
        } else if (v === 14) {
          const cc = { p: 0.1, aU: 1.2 * rd, bU: 0.7, pL: 0.0, aL: 1.05 * rd, bL: 0.75 };
          const S1 = formaOjo(rx, ry, tA, bA, tilt, Object.assign({ lift: 0.3 * (1 - w) }, cc)), S2 = formaOjo(rx * 0.8, ry * 0.68, tA, bA, tilt, Object.assign({ lift: 0.2 * (1 - w) }, cc));
          ctx.globalAlpha = ab * 0.5; ctx.lineWidth = 0.044; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.osc, 0.5); ctx.stroke(S1.o);
          ctx.globalAlpha = ab; ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.c, 0.26); ctx.stroke(S1.o); ctx.lineWidth = 0.012; ctx.strokeStyle = rgba(P.luz, 1); ctx.stroke(S1.o);
          ctx.save(); ctx.translate(rx * 0.05, 0); const g = ctx.createLinearGradient(0, -ry * 0.68 * tA, 0, ry * 0.68 * bA + 0.002); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.42))); ctx.fillStyle = g; ctx.globalAlpha = ab * (1 - PZ.close); ctx.fill(S2.o); ctx.restore();
          if (hp > 0.05) { ctx.globalAlpha = ab; trazo(S1.U, 0.05, P.c, 0.3 * hp); trazo(S1.U, 0.012, P.blanco, hp); trazo(S1.U.slice(4, 25).map(p => [p[0] * 0.8, p[1] * 0.68 + 0.05]), 0.012, P.blanco, 0.9 * hp); }
        } else { // 15: hoja estrecha, sin ceja
          const S = formaOjo(rx, ry, tA, bA, tilt, { p: 0.22, aU: 1.05 * rd, bU: 1.0, pL: 0.22, aL: 1.05 * rd, bL: 1.0, lift: 0.0 });
          luzForma(S.o, P, ab, -ry * tA, ry * bA);
          if (hp > 0.05) { trazo(S.U, 0.07, P.c, 0.35 * hp * ab); trazo(S.U, 0.034, P.blanco, hp * ab); }
        }
        ctx.restore();
        const aBr = ab * (1 - PZ.heart * 0.5 - PZ.star * 0.5);
        if (v === 10) cejaFina(side, cx, cy2 - ry * Math.max(tA, 0.5) - 0.085 - 0.035 * PZ.lid, rx * 0.86, -rx * 0.05, 0.0105, P, aBr, 'cinta');
        if (v === 14) cejaFina(side, cx, cy2 - ry * Math.max(tA, 0.5) - 0.09, rx * 0.5, rx * 0.12, 0.0, P, aBr, 'neon');
        if (v === 13) { // ceja facetada: barra recta con cortes en angulo y dos tonos
          const sI = side < 0 ? 0 : 1, Y = clamp(brY[sI].x, -1.2, 1.9), Tt = clamp(brT[sI].x, -1.1, 1.1), yb = cy2 - ry * Math.max(tA, 0.5) - 0.085 - 0.15 * Y + 0.05 * PZ.close, bw = rx * 0.82, th = 0.026, sl = 0.05 + 0.1 * Tt;
          ctx.save(); ctx.translate(cx, 0); ctx.scale(-side, 1); ctx.lineJoin = 'miter';
          const F1 = [[-bw, yb - sl - th / 2], [bw, yb + sl - th / 2], [bw - 0.02, yb + sl], [-bw - 0.012, yb - sl]], F2 = [[-bw - 0.012, yb - sl], [bw - 0.02, yb + sl], [bw - 0.032, yb + sl + th / 2], [-bw - 0.024, yb - sl + th / 2]];
          const mk = F => { const Q = new Path2D(); F.forEach((p, i) => i ? Q.lineTo(p[0], p[1]) : Q.moveTo(p[0], p[1])); Q.closePath(); return Q; }, Qa = mk(F1), Qb = mk(F2);
          ctx.globalAlpha = aBr * 0.5; ctx.lineWidth = 0.04; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(Qa); ctx.stroke(Qb);
          ctx.globalAlpha = aBr; ctx.lineWidth = 0.022; ctx.strokeStyle = rgba(P.c, 0.24); ctx.stroke(Qa); ctx.stroke(Qb); ctx.fillStyle = rgba(P.blanco); ctx.fill(Qa); ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.55)); ctx.fill(Qb); ctx.lineWidth = 0.006; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(Qa); ctx.stroke(Qb);
          ctx.restore();
        }
      }
      glifos(A, side, cx, cy2, rx * 0.85, ry * (v === 15 ? 3.4 : 1.7), P);
    }
    barrasRuido(cy, al);
  }
  // ---- estilos 16-23: direcciones muy distintas entre si (sin pupila, simetricos en espejo) ----
  // 16 visor de luz · 17 puntos LED · 18 pincel · 19 esquirlas duras · 20 neon de parpado pesado · 21 antifaz · 22 cristal liquido · 23 anime doble arco
  function pose2(side, al, rxB, ryB, ang0, o) {
    const k = baseK(o) * 1.25, sz = 1 + 0.04 * pulso + 0.03 * vozN, w = PZ.wow, hp = Math.max(PZ.happy, side > 0 ? PZ.wink : 0), [jx, jy, ja] = jit(side), cy = (o.eyeY ?? -0.12) + 0.035, ap = 0.76 + 0.26 * w + 0.12 * PZ.alert * (1 - w);
    let tA = ap * clamp(1 - 1.5 * PZ.lid, 0.25, 1.2), bA = ap * (1 - 1.9 * hp); tA = lerp(tA, 0.05, PZ.close); bA = lerp(bA, 0.05, PZ.close);
    let pxs = side * 0.42, kxs = 1; if (volOn && proyOjos && YAW.x) { const a0 = Math.asin(0.42 / 0.95), ph = side * a0 + YAW.x; pxs = 0.95 * Math.sin(ph); kxs = Math.max(0.12, Math.cos(ph) / Math.cos(a0)); }
    return { side, m: -side, k, hp, w, tilt: PZ.tilt, tA, bA, ap, rx: rxB * k * sz * (1 + 0.05 * w) * kxs, ry: ryB * k * sz * (1 + 0.3 * w + 0.12 * vozN), cx: pxs + E.px * 0.045 + jx, cy2: cy + E.py * 0.05 + jy, ab: al * ja * (1 - gsum()), A: al * ja, ang: ang0 + 0.08 * PZ.tilt };
  }
  function entra(q) { ctx.save(); ctx.translate(q.cx, q.cy2); ctx.scale(q.m, 1); ctx.rotate(q.ang); }
  const gradLuz = (P, y0, y1) => { if (y1 - y0 < 0.002) y1 = y0 + 0.002; const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(P.blanco)); g.addColorStop(1, rgba(mezcla(P.blanco, P.c, 0.42))); return g; };
  const poli = pts => { const Q = new Path2D(); pts.forEach((p, i) => i ? Q.lineTo(p[0], p[1]) : Q.moveTo(p[0], p[1])); Q.closePath(); return Q; };

  function ojosVisor(al, o) { // una sola banda oscura que cruza la cara; dos zonas de luz rasgadas dentro
    const P = ojosPal(), k = baseK(o) * 1.25, cy = (o.eyeY ?? -0.12) + 0.035, hB = 0.165 * k * (1 + 0.25 * PZ.wow) * lerp(1, 0.4, PZ.close), L = 0.8 * (1 + 0.012 * pulso);
    ctx.save(); ctx.translate(E.px * 0.025, cy + E.py * 0.035 + 0.01);
    const band = new Path2D(); band.roundRect(-L, -hB, 2 * L, 2 * hB, hB * 0.8);
    ctx.globalAlpha = al * 0.55; ctx.lineWidth = 0.075; ctx.strokeStyle = rgba(P.c, 0.3); ctx.stroke(band);
    ctx.globalAlpha = al; const g = ctx.createLinearGradient(0, -hB, 0, hB); g.addColorStop(0, rgba(mezcla(P.osc, [0, 0, 0], 0.2))); g.addColorStop(1, rgba(mezcla(P.osc, P.c, 0.16))); ctx.fillStyle = g; ctx.fill(band);
    ctx.lineWidth = 0.012; ctx.strokeStyle = rgba(P.c, 0.85); ctx.stroke(band);
    ctx.globalAlpha = al * 0.4; ctx.lineWidth = 0.008; ctx.strokeStyle = rgba(P.luz, 1); ctx.beginPath(); ctx.moveTo(-0.17, 0.002); ctx.lineTo(0.17, 0.002); ctx.stroke(); ctx.restore();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.255, 0.112, 0.17, o);
      if (q.ab > 0.02) { entra(q);
        const S = formaOjo(q.rx, q.ry, q.tA, q.bA, q.tilt, { p: 0.1, aU: 1.05, bU: 0.65, pL: 0.0, aL: 0.9, bL: 0.7, lift: 0.1 });
        ctx.globalAlpha = q.ab * 0.5; ctx.lineWidth = 0.09; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.c, 0.35); ctx.stroke(S.o);
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.032; ctx.strokeStyle = rgba(P.c, 0.55); ctx.stroke(S.o); ctx.fillStyle = gradLuz(P, -q.ry * q.tA, q.ry * q.bA); ctx.fill(S.o);
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido(cy, al);
  }

  function ojosLed(al, o) { // matriz de puntos redondos: el tamano de cada punto dice cuanto cae dentro de la forma
    const P = ojosPal();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.275, 0.165, 0.15, o);
      if (q.ab > 0.02) { const pt = 0.048 * q.k, nx = Math.ceil(q.rx * 1.25 / pt), ny = Math.ceil(q.ry * 1.9 / pt), ca = Math.cos(q.ang), sa = Math.sin(q.ang), f = u => clamp(1 - 0.10 * (u + 1) / 2 - 0.6 * q.tilt * (u + 1) / 2, 0.06, 1);
        ctx.save(); ctx.translate(q.cx, q.cy2); ctx.scale(q.m, 1);
        for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) { const x = i * pt, y = j * pt, xr = x * ca + y * sa, yr = -x * sa + y * ca, u = xr / q.rx; let mem = 0;
          if (Math.abs(u) <= 1.04) { const yT = -q.ry * q.tA * perfil(u, 0.12, 1.1, 0.7) * f(clamp(u, -1, 1)) - q.ry * 0.2 * Math.pow(1 - (u + 1) / 2, 2.2), yB = q.ry * q.bA * perfil(u, 0.0, 1.0, 0.75) - q.ry * 0.2 * Math.pow(1 - (u + 1) / 2, 2.2); if (yB > yT) mem = clamp(Math.min(yr - yT, yB - yr) / (pt * 1.15) + 0.3, 0, 1); }
          if (mem > 0.04) { const t = clamp((yr / q.ry + 1) / 2, 0, 1), c = mezcla(P.blanco, P.c, t * 0.7), r = pt * 0.56 * Math.pow(mem, 0.6);
            if (mem > 0.5) { ctx.globalAlpha = q.ab * 0.22; ctx.fillStyle = rgba(P.c); ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill(); }
            ctx.globalAlpha = q.ab; ctx.fillStyle = rgba(c); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
          else if (Math.hypot(u, yr / (q.ry * 1.5)) < 1.25) { ctx.globalAlpha = q.ab * 0.3; ctx.fillStyle = rgba(P.osc); ctx.beginPath(); ctx.arc(x, y, pt * 0.11, 0, TAU); ctx.fill(); } }
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  function ojosPincel(al, o) { // trazo de pincel grueso-fino con la cola hacia arriba por fuera
    const P = ojosPal();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.27, 0.15, 0.2, o);
      if (q.ab > 0.02) { entra(q);
        const H = q.ry * q.tA * 0.95 + q.ry * 0.8 * q.hp, pts = [], N = 26, op = clamp((q.tA + q.bA) / (2 * q.ap), 0.05, 1.2), hw = q.ry * 0.5 * lerp(0.35, 1, clamp(op, 0, 1)) * (1 + 0.25 * q.w);
        for (let i = 0; i <= N; i++) { const u = -1.38 + 2.38 * i / N, uc = clamp(u, -1, 1); let y = -H * Math.pow(1 - uc * uc, 0.9) + q.ry * 0.28 + 0.45 * q.ry * q.tilt * u; if (u < -1) y -= q.ry * 0.85 * Math.pow((-1 - u) / 0.38, 1.5) * (1 - 0.45 * q.w) * (1 - 0.6 * PZ.close); pts.push([u * q.rx, y]); }
        const Q = cinta(pts, t => hw * Math.pow(Math.sin(PI * clamp(Math.pow(t, 0.8), 0, 1)), 1.25) + 0.0025 + (t > 0.9 ? hw * 0.1 : 0));
        ctx.globalAlpha = q.ab * 0.5; ctx.lineJoin = 'round'; ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(Q);
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.c, 0.25); ctx.stroke(Q); ctx.fillStyle = gradLuz(P, -H - hw, q.ry * 0.5); ctx.fill(Q);
        ctx.save(); ctx.clip(Q); ctx.lineWidth = 0.0045; ctx.strokeStyle = rgba(P.c, 0.8); ctx.lineCap = 'butt';
        for (const d of [-0.35, 0.1, 0.42]) { ctx.beginPath(); pts.forEach((p, i) => { if (i < N * 0.2 || i > N * 0.5) return; if (i === Math.ceil(N * 0.2)) return ctx.moveTo(p[0], p[1] + d * hw); i ? ctx.lineTo(p[0], p[1] + d * hw) : ctx.moveTo(p[0], p[1] + d * hw); }); ctx.stroke(); } ctx.restore();
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.007; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(Q);
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  function ojosEsquirla(al, o) { // geometrico duro: dos esquirlas planas, sin degradado, con sombra seca
    const P = ojosPal();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.285, 0.155, 0.1, o);
      if (q.ab > 0.02) { entra(q); const rx = q.rx, ry = q.ry, T = q.tA, B = q.bA, ti = clamp(1 - 0.75 * q.tilt, 0.25, 1), gap = 0.03 * (1 - 0.6 * PZ.close);
        const up = [[-rx * 1.04, -ry * 0.08], [rx * 0.55, -ry * 1.12 * T * ti], [rx * 1.0, -ry * 0.42 * T * ti], [rx * 0.8, -ry * 0.04]];
        const lo = [[-rx * 0.58, ry * 0.1 + gap], [rx * 0.9, ry * 0.06 + gap], [rx * 0.5, Math.max(ry * 0.06 + gap + 0.004, ry * 0.95 * B)]];
        ctx.lineJoin = 'miter'; ctx.miterLimit = 8;
        const Qa = poli(up), Qb = poli(lo);
        ctx.save(); ctx.translate(0.014, 0.02); ctx.globalAlpha = q.ab * 0.65; ctx.fillStyle = rgba(P.osc); ctx.fill(Qa); ctx.fill(Qb); ctx.restore();
        ctx.globalAlpha = q.ab; ctx.fillStyle = rgba(P.blanco); ctx.fill(Qa); ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.62)); ctx.fill(Qb);
        ctx.lineWidth = 0.008; ctx.strokeStyle = rgba(P.osc, 0.85); ctx.stroke(Qa); ctx.stroke(Qb);
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  function ojosNeon(al, o) { // parpado pesado: tubo de neon recto con halo fuerte y solo una rendija de ojo debajo
    const P = ojosPal();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.285, 0.15, 0.1, o);
      if (q.ab > 0.02) { entra(q);
        const op = clamp((q.tA + q.bA) / 2, 0.05, 1.3), dp = q.ry * 0.95 * Math.max(0.0, op - 0.04) * (1 + 0.5 * q.w) * (1 - 0.35 * q.tilt), ar = q.ry * (0.15 + 0.75 * q.hp), yl = -q.ry * 0.06 - dp * 0.35, rx = q.rx, lid = [], N = 20;
        for (let i = 0; i <= N; i++) { const u = -1.12 + 2.24 * i / N; lid.push([u * rx, yl + 0.5 * q.ry * q.tilt * u - ar * (1 - u * u) + 0.08 * q.ry * u]); }
        if (dp > 0.004 && q.hp < 0.6) { const ap2 = new Path2D(); lid.forEach((p, i) => { const u = -1.12 + 2.24 * i / N; if (Math.abs(u) <= 0.98) ap2.lineTo(p[0], p[1]); }); for (let i = N; i >= 0; i--) { const u = -1.12 + 2.24 * i / N, p = lid[i]; if (Math.abs(u) <= 0.98) ap2.lineTo(p[0], p[1] + dp * perfil(u, 0.08, 1.15, 0.8)); } ap2.closePath();
          ctx.globalAlpha = q.ab; ctx.fillStyle = gradLuz(P, yl, yl + dp); ctx.fill(ap2); ctx.lineWidth = 0.008; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(ap2); }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        trazo(lid, 0.085, P.osc, 0.45 * q.ab); for (const [w2, c, a2] of [[0.17, P.c, 0.09], [0.115, P.c, 0.16], [0.08, P.c, 0.34], [0.056, mezcla(P.c, P.blanco, 0.35), 0.9]]) { trazo(lid, w2, c, a2 * q.ab); }
        trazo(lid, 0.022, [255, 255, 255], q.ab);
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  function ojosAntifaz(al, o) { // antifaz oscuro de una pieza, con un ojo de luz pequeno dentro de cada agujero
    const P = ojosPal(), k = baseK(o) * 1.25, cy = (o.eyeY ?? -0.12) + 0.035, ls = 1 - 0.28 * PZ.lid, kk = k / 1.25, hY = y => y * kk * (1 + 0.1 * PZ.wow);
    const sd = [30, 15, 2], md = mezcla(P.osc, sd, 0.55);
    ctx.save(); ctx.translate(E.px * 0.02, cy + E.py * 0.03);
    const mk = new Path2D();
    const half = sg => { const X = x => sg * x * kk; return [[X(0), hY(-0.06)], [X(0.2), hY(-0.19 * ls)], [X(0.42), hY(-0.27 * ls)], [X(0.62), hY(-0.28 * ls)], [X(0.9), hY(-0.43 * ls)], [X(0.84), hY(-0.12)], [X(0.7), hY(0.1)], [X(0.5), hY(0.17)], [X(0.3), hY(0.15)], [X(0.15), hY(0.09)], [X(0), hY(0.05)]]; };
    const R = half(1), Lh = half(-1);
    mk.moveTo(R[0][0], R[0][1]); mk.bezierCurveTo(R[1][0], R[1][1], R[2][0], R[2][1], R[3][0], R[3][1]); mk.lineTo(R[4][0], R[4][1]); mk.lineTo(R[5][0], R[5][1]); mk.bezierCurveTo(R[6][0], R[6][1], R[7][0], R[7][1], R[8][0], R[8][1]); mk.bezierCurveTo(R[9][0], R[9][1], R[10][0], R[10][1], R[10][0], R[10][1]);
    mk.bezierCurveTo(Lh[10][0], Lh[10][1], Lh[9][0], Lh[9][1], Lh[8][0], Lh[8][1]); mk.bezierCurveTo(Lh[7][0], Lh[7][1], Lh[6][0], Lh[6][1], Lh[5][0], Lh[5][1]); mk.lineTo(Lh[4][0], Lh[4][1]); mk.lineTo(Lh[3][0], Lh[3][1]); mk.bezierCurveTo(Lh[2][0], Lh[2][1], Lh[1][0], Lh[1][1], Lh[0][0], Lh[0][1]); mk.closePath();
    ctx.globalAlpha = al * 0.5; ctx.lineJoin = 'round'; ctx.lineWidth = 0.06; ctx.strokeStyle = rgba(P.c, 0.3); ctx.stroke(mk);
    ctx.globalAlpha = al; const g = ctx.createLinearGradient(0, -0.4 * kk, 0, 0.2 * kk); g.addColorStop(0, rgba(mezcla(md, [0, 0, 0], 0.15))); g.addColorStop(1, rgba(mezcla(P.osc, P.c, 0.1))); ctx.fillStyle = g; ctx.fill(mk);
    ctx.lineWidth = 0.011; ctx.strokeStyle = rgba(P.c, 0.75); ctx.stroke(mk); ctx.restore();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.185, 0.082, 0.2, o); q.cx -= side * 0.02; q.cy2 += 0.005;
      if (q.ab > 0.02) { entra(q);
        const S = formaOjo(q.rx, q.ry, q.tA, q.bA, q.tilt, { p: 0.1, aU: 1.0, bU: 0.7, pL: 0.0, aL: 0.9, bL: 0.75, lift: 0.1 });
        ctx.globalAlpha = q.ab * 0.5; ctx.lineWidth = 0.08; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(P.c, 0.3); ctx.stroke(S.o);
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.026; ctx.strokeStyle = rgba(P.c, 0.5); ctx.stroke(S.o); ctx.fillStyle = gradLuz(P, -q.ry * q.tA, q.ry * q.bA); ctx.fill(S.o);
        if (q.hp > 0.05) { trazo(S.U, 0.05, P.c, 0.35 * q.hp * q.ab); trazo(S.U, 0.026, P.blanco, q.hp * q.ab); }
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 2.2, P); }
    barrasRuido(cy, al);
  }

  function ojosCristal(al, o) { // gota de cristal liquido que se deforma y gotea al parpadear
    const P = ojosPal(), t = tiempo;
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.215, 0.118, 0.14, o);
      if (q.ab > 0.02) { entra(q);
        const cl = PZ.close, hv = 1 - 0.8 * q.hp, rx = q.rx * (1 + 0.32 * cl), ry = q.ry * lerp(Math.max(0.35, (q.tA + q.bA * 0.8) / (1.6 * q.ap) * 1.15), 0.3, cl), N = 40, pts = [], ph = side * 1.7;
        for (let i = 0; i < N; i++) { const th = i / N * TAU, c = Math.cos(th), sn = Math.sin(th); let x = rx * c, y = ry * sn * (sn > 0 ? 1.14 : 0.92);
          const tip = c < 0 ? Math.pow(-c, 2.6) : 0; y *= 1 - 0.62 * tip; y -= ry * 0.22 * tip; // punta exterior afilada y levantada
          const wob = 1 + (0.035 * Math.sin(3 * th + t * 1.9 + ph) + 0.025 * Math.sin(5 * th - t * 2.6 + ph)) * (1 + 1.5 * cl); x *= wob; y *= wob; y += sn > 0.2 ? ry * 0.1 * cl * (1 + Math.sin(t * 5 + ph)) * 0.5 : 0; pts.push([x, y * hv + (1 - hv) * 0.2 * ry]); }
        const cu = new Path2D(); pts.forEach((p, i) => { const n2 = pts[(i + 1) % N], mx = (p[0] + n2[0]) / 2, my = (p[1] + n2[1]) / 2; i ? cu.quadraticCurveTo(p[0], p[1], mx, my) : cu.moveTo(mx, my); }); cu.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2); cu.closePath();
        ctx.globalAlpha = q.ab * 0.5; ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.lineJoin = 'round'; ctx.stroke(cu);
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.c, 0.28); ctx.stroke(cu);
        const gr = ctx.createRadialGradient(-rx * 0.2, -ry * 0.4, ry * 0.05, 0, 0.05 * ry, ry * 1.3); gr.addColorStop(0, rgba(P.blanco)); gr.addColorStop(0.55, rgba(mezcla(P.blanco, P.c, 0.3))); gr.addColorStop(1, rgba(mezcla(P.c, P.osc, 0.18)));
        ctx.fillStyle = gr; ctx.fill(cu); ctx.lineWidth = 0.008; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(cu);
        ctx.save(); ctx.clip(cu); ctx.globalAlpha = q.ab * 0.55; ctx.lineWidth = 0.03; ctx.strokeStyle = rgba(P.c, 1); ctx.beginPath(); ctx.ellipse(rx * 0.05, ry * 0.05, rx * 0.96, ry * 0.9, 0, 0.15, 2.9); ctx.stroke(); ctx.restore(); // luz refractada abajo
        ctx.globalAlpha = q.ab * (1 - 0.4 * cl); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(rx * 0.2, -ry * 0.44, rx * 0.3, ry * 0.15, -0.22, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(rx * 0.55, -ry * 0.1, Math.max(0.006, ry * 0.07), 0, TAU); ctx.fill();
        if (cl > 0.12) { const dr = clamp((cl - 0.12) / 0.88, 0, 1), dy = ry * (0.55 + 1.5 * dr), rd = 0.05 * (1 - 0.35 * dr) + 0.01, gx = rx * 0.12;
          ctx.globalAlpha = q.ab * Math.min(1, dr * 2.2); ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.3)); ctx.beginPath(); ctx.moveTo(gx - 0.026 * (1 - dr * 0.6), ry * 0.5); ctx.quadraticCurveTo(gx - 0.012, dy - rd, gx - rd, dy); ctx.arc(gx, dy, rd, PI, 0, true); ctx.quadraticCurveTo(gx + 0.012, dy - rd, gx + 0.026 * (1 - dr * 0.6), ry * 0.5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 0.007; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(); }
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  function ojosAnime(al, o) { // arco doble: pestana gruesa con ala por fuera + linea inferior fina que no la toca
    const P = ojosPal();
    for (let s = 0; s < 2; s++) { const side = s ? 1 : -1, q = pose2(side, al, 0.27, 0.15, 0.15, o);
      if (q.ab > 0.02) { entra(q);
        const op = clamp((q.tA + q.bA) / (2 * q.ap), 0.05, 1.25), ti = 0.5 * q.ry * q.tilt, up = [], lo = [], N = 26, H = q.ry * q.tA * 1.0 + q.ry * 0.55 * q.hp, Hb = q.ry * q.bA * 0.8, gap = q.ry * 0.3 * (1 - q.hp) + q.ry * 0.12;
        for (let i = 0; i <= N; i++) { const u = -1.3 + 2.3 * i / N, uc = clamp(u, -1, 1); let y = -H * Math.pow(1 - uc * uc, 0.8) + ti * u; if (u < -1) y -= q.ry * 0.62 * Math.pow((-1 - u) / 0.3, 1.5) * (1 - 0.5 * PZ.close); up.push([u * q.rx, y]); }
        for (let i = 0; i <= 18; i++) { const u = -0.62 + 1.5 * i / 18; lo.push([u * q.rx, gap + Hb * Math.pow(Math.max(0, 1 - u * u), 0.75) * 0.9 + ti * u * 0.6]); }
        const hwm = q.ry * 0.3 * lerp(0.5, 1, clamp(op, 0, 1)), Q = cinta(up, t => hwm * Math.pow(Math.sin(PI * clamp(Math.pow(t, 0.62), 0, 1)), 0.6) + 0.0025);
        ctx.globalAlpha = q.ab * 0.5; ctx.lineJoin = 'round'; ctx.lineWidth = 0.042; ctx.strokeStyle = rgba(P.osc, 0.6); ctx.stroke(Q);
        ctx.globalAlpha = q.ab; ctx.lineWidth = 0.028; ctx.strokeStyle = rgba(P.c, 0.25); ctx.stroke(Q); ctx.fillStyle = gradLuz(P, -H - hwm, 0); ctx.fill(Q); ctx.lineWidth = 0.006; ctx.strokeStyle = rgba(P.osc, 0.7); ctx.stroke(Q);
        if (q.hp < 0.75 && PZ.close < 0.8) { const a2 = q.ab * (1 - q.hp) * (1 - PZ.close); trazo(lo, 0.034, P.osc, 0.4 * a2); trazo(lo, 0.026, P.c, 0.3 * a2); trazo(lo, 0.012, P.blanco, a2); }
        ctx.restore(); }
      glifos(q.A, side, q.cx, q.cy2, q.rx * 0.85, q.ry * 1.7, P); }
    barrasRuido((o.eyeY ?? -0.12) + 0.035, al);
  }

  // ---- estilos 24-26 (referencia): una linea de neon ondulada cruza toda la cara y en dos zonas baja formando dos medias lunas
  //      (parpado pesado, mirada serena), rellenas de trama; particulas glitch horizontales tenues alrededor. Sin pupilas, simetricos.
  //      24 trama de puntos · 25 relleno de cristal liquido · 26 almendra rasgada con tubo de neon y lineas de barrido.
  //      La cara se proyecta sobre la superficie curva: al girar (volumen) los ojos se comprimen hacia el borde. -----
  const RF = 0.95, XE = 0.43;
  const REFD = { 24: { D: 0.215, hw: 0.31, sl: 0.05, mod: 'puntos', pw: 0.85, ex: 2.0 }, 25: { D: 0.225, hw: 0.31, sl: 0.045, mod: 'cristal', pw: 0.85, ex: 2.0 }, 26: { D: 0.245, hw: 0.32, sl: 0.09, mod: 'lineas', pw: 0.9, ex: 1.8 } };
  const VISOR_DEF = { 24: 1, 25: 1, 26: 1 };
  let ojosU = 100;
  const pjx = (x, fy) => { const a0 = Math.asin(clamp(x / RF, -1, 1)), a = clamp(a0 + fy, -1.5, 1.5); return [RF * Math.sin(a), Math.max(0.08, Math.cos(a) / Math.max(0.25, Math.cos(a0)))]; };
  function ojosRef(id, al, o) {
    const C = REFD[id], P = ojosPal(), t = tiempo, fy = (volOn ? YAW.x : 0) + 0.10 * E.px, U = ojosU, k = baseK(o), ey = (o.eyeY ?? -0.12) - 0.012 + E.py * 0.07 * (1 - 0.6 * PZ.sleep);
    const cl = PZ.close, wow = PZ.wow, tilt = clamp(PZ.tilt, -0.4, 1.4), sl = PZ.sleep, g = gsum(), peq = U < 34, vz = clamp(vozN + 0.35 * pulso, 0, 1.2);
    const vis = visorOjos === undefined ? VISOR_DEF[id] : (visorOjos ? 1 : 0);
    const lineY = x => { const ax = Math.abs(x), env = Math.max(0, 1 - Math.pow(ax / 0.95, 2));
      return ey - C.sl * Math.pow(ax / 0.86, 1.6) + 0.17 * tilt * Math.max(0, 1 - ax / 0.8) + 0.05 * PZ.lid + (0.015 * Math.sin(x * 6.5 + t * 1.2) + 0.006 * Math.sin(x * 16 - t * 2.3)) * (1 - 0.7 * sl) + 0.011 * sl * Math.sin(t * 1.1)
        + vz * env * (0.02 * Math.sin(x * 11 - t * 18) + 0.008 * Math.sin(x * 27 + t * 29)) - 0.022 * wow * env; };
    const prof = u => { const v = (u - 0.1) / (u < 0.1 ? 1.1 : 0.9); return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v), C.ex)), C.pw * (1 + 1.6 * cl)); };
    const fade = (a, rgb) => { const gr = ctx.createLinearGradient(-0.9, 0, 0.9, 0), q = v => rgba(rgb, a * v); gr.addColorStop(0, q(0)); gr.addColorStop(0.1, q(1)); gr.addColorStop(0.9, q(1)); gr.addColorStop(1, q(0)); return gr; };
    const poly = (pts, lw, st) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.stroke(); };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // zona de cara mas oscura (visor translucido, bordes suaves) para que la luz se lea sobre el cuerpo cian
    if (vis > 0.01) { const [cxp, kx] = pjx(0, fy); ctx.save(); ctx.translate(cxp, ey + 0.07); ctx.scale(Math.max(0.3, kx), 0.40); const gv = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.98), a = al * vis * (1 - 0.25 * sl);
      gv.addColorStop(0, 'rgba(36,15,2,' + 0.74 * a + ')'); gv.addColorStop(0.6, 'rgba(36,15,2,' + 0.66 * a + ')'); gv.addColorStop(0.84, 'rgba(48,23,3,' + 0.28 * a + ')'); gv.addColorStop(1, 'rgba(50,25,3,0)'); ctx.fillStyle = gv; ctx.fillRect(-1.1, -1.1, 2.2, 2.2); ctx.restore(); }
    // particulas glitch: trazos horizontales tenues, sobre todo encima de la linea
    if (!peq) { const N = id === '25' ? 28 : 48, aG = al * (1 - sl) * (1 - 0.6 * g) * (0.8 + 0.5 * vz); ctx.lineWidth = Math.max(0.007, 1.4 / U);
      for (let n = 0; n < N; n++) { const ph = Math.sin(t * (1.1 + hh(n * 1.9) * 2.4) + n * 2.1); if (ph < 0.25) continue; const sl2 = Math.floor(t * 9 + n), jx = (hh(sl2 * 0.7 + n) - 0.5) * 0.05;
        const x = (hh(n * 3.7) - 0.5) * 1.62 + jx, y = ey + (hh(n * 5.3 + 1) - 0.74) * 0.52, len = 0.03 + 0.15 * hh(n * 2.9 + 4), [px0, kx] = pjx(x, fy), [px1] = pjx(x + len, fy); if (Math.abs(x) > 0.82) continue;
        ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.strokeStyle = rgba(hh(n * 7.1) > 0.7 ? P.luz : P.c, aG * (0.22 + 0.6 * (ph - 0.25)) * (0.5 + 0.5 * kx)); ctx.stroke(); } }
    // medias lunas
    for (let s = -1; s <= 1; s += 2) {
      const hs = Math.max(PZ.happy, s > 0 ? PZ.wink : 0), dep = C.D * k * (1 + 0.55 * wow + 0.1 * PZ.alert + 0.12 * vozN) * (1 - cl) * (1 - 0.42 * clamp(tilt, 0, 1.2)) * (1 - 0.8 * clamp(PZ.lid, 0, 0.5)) * (1 - 1.9 * hs), lift = wow * C.D * k * 0.65 * (1 - cl);
      const gl = 1 - g; if (Math.abs(dep) < 0.004 && lift < 0.004) continue;
      const N = 30, Bp = [], Tp = [], Bu = []; let xo = 9, xi = -9;
      for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N, x = s * (XE - u * C.hw), pf = prof(u), y0 = lineY(x), wb = 0.006 * Math.sin(x * 20 + t * 2.5) * (id === '25' ? 1 : 0.4), [qx] = pjx(x, fy);
        Bp.push([qx, y0 + dep * pf + wb * pf]); Tp.push([qx, y0 - lift * pf + 0.006]); Bu.push([x, y0 + dep * pf, pf]); }
      const reg = new Path2D(); Tp.forEach((p, i) => i ? reg.lineTo(p[0], p[1]) : reg.moveTo(p[0], p[1])); for (let i = N; i >= 0; i--) reg.lineTo(Bp[i][0], Bp[i][1]); reg.closePath();
      const yMin = ey - 0.1, yMax = ey + Math.max(0.05, dep) + 0.06, aR = al * gl;
      if (C.mod === 'cristal') { const gr = ctx.createLinearGradient(0, yMin, 0, yMax); gr.addColorStop(0, rgba(P.blanco, aR)); gr.addColorStop(0.5, rgba(mezcla(P.blanco, P.c, 0.38), aR)); gr.addColorStop(1, rgba(mezcla(P.c, P.osc, 0.22), aR)); ctx.fillStyle = gr; ctx.fill(reg); }
      else { const gr = ctx.createLinearGradient(0, yMin, 0, yMax); gr.addColorStop(0, rgba(mezcla(P.osc, [0, 0, 0], 0.2), 0.8 * aR)); gr.addColorStop(1, rgba(mezcla(P.c, P.osc, 0.55), 0.85 * aR)); ctx.fillStyle = gr; ctx.fill(reg); }
      ctx.save(); ctx.clip(reg);
      if (peq) { const gr = ctx.createLinearGradient(0, yMin, 0, yMax); gr.addColorStop(0.3, rgba(P.c, 0)); gr.addColorStop(1, rgba(P.luz, 0.8 * aR)); ctx.fillStyle = gr; ctx.fillRect(-1, yMin - 0.1, 2, yMax - yMin + 0.3); }
      else if (C.mod === 'puntos') { // trama fina de puntos luminosos, mas brillante hacia el borde de abajo
        const pt = 0.027, rp = pt * 0.92, roll = (t * 0.03) % rp, bins = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; const nx = Math.ceil(2 * C.hw / pt);
        for (let ix = 0; ix < nx; ix++) { const xa = XE - C.hw + pt * (ix + 0.5), u = (XE - xa) / C.hw, pf = prof(u); if (pf < 0.03) continue; const x = s * xa, y0 = lineY(x), yb = y0 + dep * pf, yt = Math.min(y0, y0 - lift * pf), yb2 = Math.max(yb, y0); const [qx, kx] = pjx(x, fy);
          for (let y = Math.ceil((yt - roll) / rp) * rp + roll; y < yb2; y += rp) { const fr = clamp((y - yt) / Math.max(0.01, yb2 - yt), 0, 1), m = Math.min(y - yt, yb2 - y) / rp, sz = clamp(m * 0.9, 0.15, 1), b = (0.3 + 0.7 * Math.pow(dep >= 0 ? fr : 1 - fr, 1.4)) * (0.86 + 0.14 * Math.sin(ix * 0.8 - t * 3 + y * 25));
            const r = pt * 0.31 * sz * (0.7 + 0.5 * b), bi = clamp(Math.floor(b * 4), 0, 3); bins[bi].moveTo(qx + r * kx, y); bins[bi].ellipse(qx, y, r * kx, r, 0, 0, TAU); } }
        bins.forEach((B, bi) => { const b = (bi + 0.5) / 4; ctx.fillStyle = rgba(mezcla(P.c, P.blanco, b * 0.75), aR * (0.35 + 0.6 * b)); ctx.fill(B); });
      } else if (C.mod === 'lineas') { // lineas de barrido finas que se desplazan
        const rp = 0.02, roll = (t * 0.05) % rp; ctx.lineWidth = Math.max(0.0045, 0.9 / U); ctx.setLineDash([0.07, 0.014]); ctx.lineDashOffset = -t * 0.12;
        for (let y = ey - 0.1 + roll; y < yMax; y += rp) { let xa = null, xb = null; for (let i = 0; i <= N; i++) { const [x, yb, pf] = Bu[i]; if (pf < 0.02) continue; const y0 = lineY(x), yt = Math.min(y0, y0 - lift * pf), yb2 = Math.max(yb, y0); if (y > yt && y < yb2) { if (xa === null) xa = i; xb = i; } }
          if (xa === null) continue; const fr = clamp((y - (ey - 0.02)) / Math.max(0.05, dep), 0, 1), b = 0.3 + 0.7 * Math.pow(fr, 1.3); ctx.beginPath(); ctx.moveTo(Bp[xa][0], y); ctx.lineTo(Bp[xb][0], y); ctx.strokeStyle = rgba(mezcla(P.c, P.blanco, b * 0.7), aR * (0.3 + 0.6 * b)); ctx.stroke(); }
        ctx.setLineDash([]);
      } else { // cristal: reflejo, luz refractada abajo, dos hebras y una burbuja
        const [qx, kx] = pjx(s * (XE - 0.1 * C.hw), fy), yc = ey + Math.max(0.03, dep * 0.45);
        ctx.fillStyle = rgba([255, 255, 255], 0.85 * aR); ctx.beginPath(); ctx.ellipse(qx + s * 0.03 * kx, yc - dep * 0.1, C.hw * 0.38 * kx, Math.max(0.01, dep * 0.14), -0.12 * s, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(qx + s * 0.09 * kx, yc + dep * 0.08, Math.max(0.006, dep * 0.055), 0, TAU); ctx.fill();
        poly(Bp.map(p => [p[0], p[1] - dep * 0.2]), 0.022, rgba(P.c, 0.5 * aR));
      }
      ctx.restore();
      // borde de abajo de la luna (tubo fino)
      poly(Bp, 0.075, rgba(P.c, 0.13 * aR)); poly(Bp, 0.04, rgba(P.c, 0.3 * aR)); poly(Bp, Math.max(0.02, 1.9 / U), rgba(mezcla(P.c, P.blanco, 0.45), 0.95 * aR)); if (!peq) poly(Bp, Math.max(0.008, 0.9 / U), rgba([255, 255, 255], 0.9 * aR));
      if (lift > 0.01) poly(Tp, Math.max(0.02, 1.8 / U), rgba(mezcla(P.c, P.blanco, 0.45), 0.9 * aR));
      // gota de cristal al parpadear (25)
      if (C.mod === 'cristal' && cl > 0.12) { const dr = clamp((cl - 0.12) / 0.88, 0, 1), [gx0] = pjx(s * (XE - 0.1 * C.hw), fy), gy = lineY(s * XE) + 0.03 + 0.14 * dr * dr, rd = (0.03 * (1 - 0.3 * dr) + 0.006) * (1 + 0.5 * Math.sin(Math.PI * dr)); ctx.fillStyle = rgba(mezcla(P.blanco, P.c, 0.3), al * Math.min(1, dr * 3) * (1 - 0.5 * dr * dr)); ctx.beginPath(); ctx.arc(gx0, gy, rd, 0, TAU); ctx.fill(); }
    }
    // la linea de neon que cruza toda la cara
    const LP = []; for (let i = 0; i <= 72; i++) { const x = -0.93 + 1.86 * i / 72, [qx] = pjx(x, fy); LP.push([qx, lineY(x)]); }
    const aL = al * (1 - 0.4 * sl) * (1 - 0.5 * g), tubo = id === '26';
    const cap = tubo ? [[0.26, 0.09], [0.17, 0.17], [0.105, 0.34]] : [[0.2, 0.08], [0.13, 0.15], [0.085, 0.30]];
    if (!peq) for (const [w, a] of cap) poly(LP, w, fade(a * aL, P.c));
    poly(LP, tubo ? 0.062 : 0.04, fade(0.55 * aL, P.osc)); poly(LP, Math.max(tubo ? 0.036 : 0.026, 2.2 / U), fade(0.95 * aL, mezcla(P.c, P.blanco, 0.4))); poly(LP, Math.max(0.011, 1.0 / U), fade(aL, [255, 255, 255]));
    for (let s = -1; s <= 1; s += 2) { const [qx, kx] = pjx(s * XE, fy); glifos(al, s, qx, ey + 0.1, C.hw * 0.62 * kx, C.D * 1.0, P); }
    barrasRuido(ey + 0.03, al);
    ctx.restore();
  }
  const DIB = { 24: (a, o) => ojosRef('24', a, o), 25: (a, o) => ojosRef('25', a, o), 26: (a, o) => ojosRef('26', a, o), 16: ojosVisor, 17: ojosLed, 18: ojosPincel, 19: ojosEsquirla, 20: ojosNeon, 21: ojosAntifaz, 22: ojosCristal, 23: ojosAnime, 10: (a, o) => ojosEleg(10, a, o), 11: (a, o) => ojosEleg(11, a, o), 12: (a, o) => ojosEleg(12, a, o), 13: (a, o) => ojosEleg(13, a, o), 14: (a, o) => ojosEleg(14, a, o), 15: (a, o) => ojosEleg(15, a, o), 1: ojos1, 2: ojos2, 3: ojos3, 4: ojos4, 5: ojos5, 6: (a, o) => ojosChill(6, a, o), 7: (a, o) => ojosChill(7, a, o), 8: (a, o) => ojosChill(8, a, o), 9: (a, o) => ojosChill(9, a, o) };
  let proyOjos = false; const PROY = new Set(['17', '18', '19', '20', '22', '23']), PROPIO = new Set(['24', '25', '26']);
  function ojos(a, U, o) {
    const vis = o.eyes; if (vis < 0.02) return; const al = a * vis * (o.dim ? 0.6 : 1);
    ojosU = U; const dib = id => { proyOjos = PROY.has(id); if (volOn && !PROY.has(id) && !PROPIO.has(id) && YAW.x) { ctx.save(); ctx.translate(Math.sin(YAW.x) * 0.50, 0); ctx.scale(Math.pow(Math.cos(YAW.x), 1.2), 1); DIB[id](al * (id === ojosId ? (ojosPrev && ojosSw < 1 ? ojosSw : 1) : 1 - ojosSw), o); ctx.restore(); } else DIB[id](al * (id === ojosId ? (ojosPrev && ojosSw < 1 ? ojosSw : 1) : 1 - ojosSw), o); };
    ctx.save(); if (o.clip && (PROPIO.has(ojosId) || (ojosPrev && PROPIO.has(ojosPrev)))) ctx.clip(o.clip); if (o.fw !== undefined && o.fw !== 1 && PROPIO.has(ojosId)) ctx.scale(o.fw, 1); if (ojosPrev && ojosSw < 1) { dib(ojosPrev); dib(ojosId); } else dib(ojosId); ctx.restore();
  }

  function dibujarContorno(pts, wx, wy, esc, alpha) {
    const U = S0 * pxu * esc; ctx.save(); ctx.translate(px(wx), py(wy)); ctx.scale(U, U);
    material(pathPts(pts), alpha, 1, { col, U, pequeno: U < 26 }); ctx.restore();
  }
  function dibujarArena(fr, P0, k) { // arena del reloj: se pinta dentro del cuerpo ya transformado (unidades de forma, y hacia abajo)
    ctx.save(); ctx.clip(P0); ctx.globalAlpha = k; ctx.lineCap = 'round';
    const ySt = lerp(0.0, -0.78, fr), hb = (1 - fr) * 0.78, yb = 0.80 - hb, arena = rgba(mezcla(col, [255, 240, 222], 0.55), 0.72), brillo = rgba(mezcla(col, [255, 255, 255], 0.9), 1);
    if (fr > 0.004) { ctx.beginPath(); ctx.moveTo(-1, ySt); ctx.quadraticCurveTo(0, ySt + 0.14 * Math.min(1, fr * 5), 1, ySt); ctx.lineTo(1, 0.04); ctx.lineTo(-1, 0.04); ctx.closePath(); ctx.fillStyle = arena; ctx.fill(); ctx.beginPath(); ctx.moveTo(-1, ySt); ctx.quadraticCurveTo(0, ySt + 0.14 * Math.min(1, fr * 5), 1, ySt); ctx.strokeStyle = brillo; ctx.lineWidth = 0.035; ctx.stroke(); }
    if (hb > 0.01) { ctx.beginPath(); ctx.moveTo(-1, yb + 0.12 * Math.min(1, hb * 4)); ctx.quadraticCurveTo(0, yb - 0.12 * Math.min(1, hb * 4), 1, yb + 0.12 * Math.min(1, hb * 4)); ctx.lineTo(1, 1); ctx.lineTo(-1, 1); ctx.closePath(); ctx.fillStyle = arena; ctx.fill(); ctx.beginPath(); ctx.moveTo(-1, yb + 0.12 * Math.min(1, hb * 4)); ctx.quadraticCurveTo(0, yb - 0.12 * Math.min(1, hb * 4), 1, yb + 0.12 * Math.min(1, hb * 4)); ctx.strokeStyle = brillo; ctx.lineWidth = 0.035; ctx.stroke(); }
    if (fr > 0.004 && fr < 0.999) { const yEnd = yb - 0.08 * Math.min(1, hb * 4); ctx.beginPath(); ctx.moveTo(0, -0.05); ctx.lineTo(0, yEnd); ctx.strokeStyle = arena; ctx.lineWidth = 0.05; ctx.stroke(); ctx.strokeStyle = brillo; ctx.lineWidth = 0.02; ctx.stroke();
      for (let i = 0; i < 5; i++) { const f = (tiempo * 2.4 + i / 5) % 1, y = lerp(0.0, yEnd, f); ctx.beginPath(); ctx.arc(0.012 * Math.sin(i * 9 + tiempo * 20), y, 0.022, 0, TAU); ctx.fillStyle = brillo; ctx.fill(); } }
    ctx.restore();
  }
  function dibujarCuerpoMorph(T, bx, by) {
    const info = infoActual, esc = S.s.x, U = S0 * pxu * esc, P0 = pathPts(ptsActual); let P = P0; const eM = [];
    if (minis.length) {
      P = new Path2D(); P.addPath(P0); const mp = pathPts(ptsBicho(tiempo, wob * .5, null));
      for (const m of minis) {
        const dxU = (m.x - bx) / (S0 * esc), dyU = -(m.y - by) / (S0 * esc);
        if (m.drop) { const rU = m.drop / (S0 * esc), D = Math.hypot(dxU, dyU), rn = Math.max(0, 0.26 * (1 - D / 0.62)); P.moveTo(dxU + rU, dyU); P.arc(dxU, dyU, rU, 0, TAU); if (rn > 0.02) for (let q = 0; q <= 8; q++) { const f = q / 8, rr = rn * (0.3 + 0.7 * Math.abs(2 * f - 1)); P.moveTo(dxU * f + rr, dyU * f); P.arc(dxU * f, dyU * f, rr, 0, TAU); } continue; }
        if (m.s < 0.03) continue; const k = m.s / esc;
        P.addPath(mp, new DOMMatrix([k, 0, 0, k, dxU, dyU]));
        const D = Math.hypot(dxU, dyU), rn = Math.max(0, 0.42 * (1 - D / 2.7)) * Math.min(1, k + 0.3);
        if (rn > 0.02) for (let q = 0; q <= 8; q++) { const f = q / 8, rr = rn * (0.3 + 0.7 * Math.abs(2 * f - 1)); P.moveTo(dxU * f + rr, dyU * f); P.arc(dxU * f, dyU * f, rr, 0, TAU); }
        eM.push({ dxU, dyU, k, dot: m.dot || 0 }); }
    }
    const spinK = T.spin !== undefined ? Math.max(0.14, Math.abs(cos(T.spin))) : 1, sxv = (1 + S.sx.x - 0.4 * S.sy.x) * spinK, syv = 1 + S.sy.x - 0.4 * S.sx.x, jit = (vozN > 0.02 ? vozN * 0.006 * sin(tiempo * 60) : 0) + shiver * 0.012 * sin(tiempo * 83);
    if (info.a > 0.01 || minis.length) {
      ctx.save(); ctx.translate(px(bx + jit), py(by)); ctx.rotate(-S.r.x - rotX); ctx.scale(U * sxv, U * syv);
      material(P, minis.some(m => m.drop) ? 1 : info.a, 1, { col, U, dim: dimv > 0.3, frozen: congelado, pequeno: U < 26, rad: minis.length ? 3.6 : 0, pts: minis.length ? null : ptsActual, act, arco: !minis.length && info.a > 0.6, vol: volOn ? { yaw: YAW.x, rot: S.r.x } : null, legs: volOn && shapeTo === 'bicho' && morphU >= 0.999 && !minis.length ? legsA : null });
      const fu = (tiempo - flashT) / 0.5; if (fu > 0 && fu < 1) {
        ctx.save(); ctx.globalAlpha = (1 - fu); ctx.strokeStyle = '#fff'; ctx.lineWidth = (4 + 16 * fu) / U; ctx.stroke(P0); ctx.globalAlpha = 0.5 * (1 - fu) * (1 - fu); ctx.fillStyle = '#fff'; ctx.fill(P0);
        for (const [d, w] of [[0, 3], [0.14, 2]]) { const f2 = clamp((fu - d) / (1 - d), 0, 1); if (f2 <= 0 || f2 >= 1) continue; ctx.globalAlpha = (1 - f2) * 0.9; ctx.beginPath(); ctx.ellipse(0, 0.1, 1.0 + 2.6 * f2, 0.85 + 2.2 * f2, 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = (w * (1 - f2) + 0.8) * 2 / U; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3 / U; ctx.stroke(); }
        ctx.restore(); }
      if (info.hoja > 0.02) {
        ctx.save(); ctx.clip(P0); ctx.globalAlpha = info.hoja; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) { const y = -0.2 + i * 0.15, w = 0.9 + 0.5 * ((i * 37) % 7) / 7; ctx.beginPath(); ctx.moveTo(-0.55, y); ctx.lineTo(-0.55 + w, y); ctx.strokeStyle = 'rgba(110,67,5,.28)'; ctx.lineWidth = 3.2 / U; ctx.stroke(); }
        if (T.scan !== undefined) { const sy = (by - T.scan) / (S0 * esc); const g = ctx.createLinearGradient(0, sy - 0.7, 0, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.35)'); ctx.fillStyle = g; ctx.fillRect(-1, sy - 0.7, 2, 0.7); ctx.beginPath(); ctx.moveTo(-1, sy); ctx.lineTo(1, sy); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 / U; ctx.stroke(); }
        ctx.restore();
      }
      if (arenaK > 0.02) dibujarArena(arenaV, P0, ease(clamp(arenaK, 0, 1)));
      if (info.eyes > 0.02) ojos(info.a, U, { eyes: info.eyes * (T.spin !== undefined ? Math.pow(Math.max(0, cos(T.spin)), 1.5) : 1), eyeY: info.ey, eyePitch: info.pitch * eyeK, dim: dimv > 0.3, fw: info.fw, clip: P0 });
      for (const m of eM) { ctx.save(); ctx.translate(m.dxU, m.dyU); ctx.scale(m.k, m.k); ojos(1, U * m.k, { eyes: 1, dim: false }); ctx.restore(); if (m.dot > 0.02) { ctx.save(); ctx.globalAlpha = m.dot; const ds = 0.55; ctx.drawImage(SPR.cian, m.dxU - ds / 2, m.dyU - 1.05 * m.k - ds / 2, ds, ds); ctx.restore(); } }
      ctx.restore();
    }
    if (info.kb > 0.02) dibujarTeclado(info.kb);
  }
  // ----- teclado en planta (vista cenital ortogonal) -----
  const FILAS = [[12, 0], [12, 0.02], [11, 0.045], [10, 0.075], [1, 0]];
  function llave(r, i) {
    const KW = 1.40, KH = 0.50, rows = 5, rh = KH / rows, n = FILAS[r][0];
    const x0 = r === 4 ? -0.36 : -KW / 2 + FILAS[r][1], x1 = r === 4 ? 0.36 : KW / 2 - FILAS[r][1], w = (x1 - x0) / n;
    const y0 = KH / 2 - (r + 1) * rh + 0.012, y1 = KH / 2 - r * rh - 0.012;
    return [x0 + w * i + 0.006, y0, x0 + w * (i + 1) - 0.006, y1];
  }
  function dibujarTeclado(a) {
    ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = 'round';
    const lw = Math.max(1, pxu * 0.0045);
    const rr = (k, esc) => { const cx = (k[0] + k[2]) / 2, cy = (k[1] + k[3]) / 2, w = (k[2] - k[0]) * esc, h = (k[3] - k[1]) * esc; return [px(cx) - w * pxu / 2, py(cy) - h * pxu / 2, w * pxu, h * pxu]; };
    FILAS.forEach(([n], r) => { for (let i = 0; i < n; i++) { const [x, y, w, h] = rr(llave(r, i), 1); ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.2); ctx.fillStyle = 'rgba(240,194,75,.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,238,215,.55)'; ctx.lineWidth = lw; ctx.stroke(); } });
    for (const k of teclas) {
      const u = tiempo - k.t; if (u > 1.1) continue; const kk = llave(k.r, k.i), sink = u < 0.05 ? u / 0.05 : Math.max(0, 1 - (u - 0.05) / 0.14), esc = 1 - 0.14 * sink;
      const [x, y, w, h] = rr(kk, esc), cx = x + w / 2, cy = y + h / 2, p = clamp((u - 0.04) / 0.95, 0, 1);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.2);
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, w * 0.75); g.addColorStop(0, rgba([255, 237, 205], 0.55 * (1 - p * 0.6) + 0.35 * sink)); g.addColorStop(1, rgba(BASE, 0.18 + 0.2 * sink)); ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = rgba(BASE, 1); ctx.shadowBlur = pequenoK() ? 0 : 10 * (1 - p); ctx.strokeStyle = rgba([255, 240, 222], 0.95 - 0.4 * p); ctx.lineWidth = lw * 1.5; ctx.stroke(); ctx.shadowBlur = 0; ctx.clip();
      for (let j = 0; j < 4; j++) { const r2 = p - j * 0.2; if (r2 <= 0.03 || r2 > 1) continue; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.60 * r2, h * 0.60 * r2, 0, 0, TAU); ctx.strokeStyle = rgba([255, 238, 215], (1 - r2) * 0.9); ctx.lineWidth = lw; ctx.stroke(); }
      ctx.restore();
      if (u < 0.15) chispas(cx, cy, w * 0.95, u / 0.15, k.t * 997 + k.i * 3 + k.r);
    }
    ctx.restore();
  }
  const pequenoK = () => W < 200;
  function chispas(x, y, size, u, seed, n = 6) {
    if (u < 0 || u >= 1) return; const al = 1 - u; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = al;
    for (let i = 0; i < n; i++) {
      const a = hh(seed + i * 1.3) * TAU, len = size * (0.55 + 0.7 * hh(seed + i + 9)) * (0.35 + u), pts = [[x + Math.cos(a) * size * 0.2, y + Math.sin(a) * size * 0.2]]; let ang = a;
      for (let q = 0; q < 3; q++) { ang += (hh(seed + i * 7 + q) - 0.5) * 1.5; const p = pts[q]; pts.push([p[0] + Math.cos(ang) * len / 3, p[1] + Math.sin(ang) * len / 3]); }
      for (const [w, a2, cc] of [[3.2, .35, BASE], [1, 1, [255, 255, 255]]]) { ctx.beginPath(); pts.forEach(([a3, b3], q) => q ? ctx.lineTo(a3, b3) : ctx.moveTo(a3, b3)); ctx.strokeStyle = rgba(cc, a2); ctx.lineWidth = Math.max(w * 0.6, pxu * 0.0035 * w); ctx.stroke(); }
    }
    ctx.restore();
  }
  function gotaPx(x, y, r, tear, a, c = BASE) {
    ctx.save(); ctx.globalAlpha = a; ctx.beginPath();
    if (tear) { ctx.moveTo(x, y - 2.3 * r); ctx.bezierCurveTo(x + .25 * r, y - 1.3 * r, x + r, y - .7 * r, x + r, y); ctx.arc(x, y, r, 0, Math.PI, false); ctx.bezierCurveTo(x - r, y - .7 * r, x - .25 * r, y - 1.3 * r, x, y - 2.3 * r); } else ctx.arc(x, y, r, 0, TAU);
    const g = ctx.createRadialGradient(x - .3 * r, y - .3 * r, 0, x, y, r * 1.2); g.addColorStop(0, rgba(mezcla(c, [255, 255, 255], .8))); g.addColorStop(.5, rgba(c)); g.addColorStop(1, rgba(mezcla(c, [70, 38, 10], .5))); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - .35 * r, y - .3 * r, .2 * r, .3 * r, -.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.restore();
  }
  function dibujarLadrillos(a) {
    const bw = 0.118, bh = 0.088, y0 = GROUND + 0.04;
    for (let k = 0; k < 15; k++) {
      const row = Math.floor(k / 3), c = k % 3, bx = (c - 1) * bw + (row % 2 ? 0.03 : -0.03), by = y0 + bh / 2 + row * bh, b = ladr[k];
      if (b.caida >= 0) { const f = b.caida, wx = lerp(S.x.x * 0.0, bx, ease(Math.min(1, f * 1.2))), wy = lerp(S.y.x - 0.12, by, f * f); gotaPx(px(wx), py(wy), pxu * 0.012, 1, a); if (f < 0.4) { ctx.save(); ctx.globalAlpha = a * (1 - f / 0.4); ctx.beginPath(); ctx.moveTo(px(S.x.x), py(S.y.x - 0.1)); ctx.lineTo(px(wx), py(wy) - pxu * 0.03); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = pxu * 0.012 * (1 - f / 0.4); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); } }
      if (b.q !== undefined && b.q >= 0 && b.q < 0.17) chispas(px(bx), py(by), bw * pxu * 0.95, b.q / 0.17, k * 13 + 3);
      if (b.s <= 0.01) continue;
      const w = (bw - 0.008) * pxu * b.s, h = (bh - 0.008) * pxu * b.s, x = px(bx) - w / 2, y = py(by) - h / 2;
      ctx.save(); ctx.globalAlpha = a; ctx.lineJoin = 'round';
      ctx.fillStyle = rgba(BASE, .06 + .12 * glow); ctx.beginPath(); ctx.roundRect(x - 5, y - 5, w + 10, h + 10, 9); ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(mezcla(BASE, [255, 255, 255], .5 + .4 * glow))); g.addColorStop(1, rgba(mezcla(BASE, [70, 38, 10], .3 - .25 * glow)));
      ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(2, h * .22)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255, 240, 222,.9)'; ctx.lineWidth = Math.max(1, pxu * .004); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * .12, y + h * .22); ctx.lineTo(x + w * .5, y + h * .22); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1, pxu * .005); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    }
  }

  function empezarMorph(nuevo, dur = 0.5, desde) {
    fromPts = desde ? ptsFijo(desde) : (ptsActual || ptsBicho(tiempo, 0, null)); fromInfo = desde ? { ...INFO[desde] } : { ...infoActual };
    shapeTo = nuevo; morphU = 0; morphDur = dur; flashT = tiempo + 0.1;
  }
  function calcularForma() { calcularForma0(); vibracion(); }
  function calcularForma0() {
    const legs = legsA.map(l => ({ dl: l.dl, dx: l.dx })); if (tapLeg) { legs[3].dl = -0.16 * Math.abs(tapLeg); legs[3].dx = 0.04 * tapLeg; }
    const toP = ptsForma(shapeTo, tiempo, wob + vozN * 0.6, legs), toI = INFO[shapeTo];
    if (morphU >= 1) { ptsActual = toP; infoActual = { ...toI }; return; }
    const u = morphU, v = clamp((u - 0.2) / 0.8, 0, 1), c1 = 0.9, c3 = c1 + 1;
    const e = u < 0.2 ? 0 : 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
    const ant = 1 - 0.08 * ease(Math.min(1, u / 0.2)) * (1 - clamp(e, 0, 1));
    // Si aún no hay forma de partida (primer fotograma o forma rara), se parte de la de destino: nunca se rompe el bucle.
    const desde = (i) => (fromPts && fromPts[i] && Number.isFinite(fromPts[i][0]) ? fromPts[i] : toP[i]);
    ptsActual = toP.map((p, i) => { const f = desde(i); return [(f[0] + (p[0] - f[0]) * e) * ant, (f[1] + (p[1] - f[1]) * e) * ant]; });
    const ec = clamp(e, 0, 1); infoActual = {}; for (const k in toI) infoActual[k] = lerp(fromInfo && Number.isFinite(fromInfo[k]) ? fromInfo[k] : toI[k], toI[k], ec);
  }

  // ----- bucle de actualizacion -----
  const AB = { lid: 0, tilt: 0 };
  function actualizar(dt, dibujar = true) {
    tiempo += dt; const T = objetivos(dt);
    const hopOff = hopY;
    if (T.f !== shapeTo) empezarMorph(T.f);
    morphU = Math.min(1, morphU + dt / morphDur);
    // arrastre
    let dx = 0, dy = 0; if (arrastre && puntero) { dx = puntero[0] - HX; dy = puntero[1] - HY; const l = Math.hypot(dx, dy), m = Math.min(l, 0.6); if (l > 1e-4) { dx *= m / l; dy *= m / l; } }
    S.x.t = T.x + (arrastre ? dx * 0.5 : 0); S.y.t = T.y + (arrastre ? dy * 0.5 : 0); S.s.t = T.s; S.r.t = T.r + (ojosId === '4' ? -0.055 * ELook.x * (0.6 + 0.8 * PZ.foc) : 0);
    S.sx.t = clamp(T.sx + (arrastre ? Math.abs(dx) * 0.4 : 0), -0.3, 0.3); S.sy.t = clamp(T.sy + (arrastre ? Math.abs(dy) * 0.4 : 0), -0.3, 0.3);
    [S.x, S.y, S.s, S.r, S.sx, S.sy].forEach(m => m.paso(dt));
    wob *= Math.exp(-dt * 3);
    const kc = Math.min(1, dt * 6); for (let i = 0; i < 3; i++) col[i] += (colT[i] - col[i]) * kc;
    congelado += (T.frozen - congelado) * Math.min(1, dt * 4); dimv += ((T.dim ? 1 : 0) - dimv) * Math.min(1, dt * 4);
    // ojos: expresion, look, parpadeo
    parp -= dt; proxParp -= dt; if (proxParp < 0) { parp = 0.14; proxParp = Math.random() < 0.2 ? 0.36 : rnd(2.2, 5); }
    let open = parp > 0 ? Math.abs(parp - 0.07) / 0.07 : 1; open = clamp(open, 0, 1);
    cerrar = Math.max(0, cerrar - dt);
    let expr = T.ex; if (cerrar > 0) expr = 'happy'; if (exprF) { if (tiempo < exprF.hasta) expr = exprF.n; else exprF = null; }
    const tgt = T.look || (puntero ? [clamp((puntero[0] - S.x.x) / 0.5, -1, 1), clamp(-(puntero[1] - S.y.x) / 0.5, -1, 1)] : [0.6 * Math.sin(tiempo * 0.4), 0.15 * Math.sin(tiempo * 0.7)]);
    proxSac -= dt; if (proxSac < 0) { proxSac = rnd(0.5, 2.1); sacT[0] = rnd(-0.14, 0.14); sacT[1] = rnd(-0.08, 0.08); }
    sac[0] += (sacT[0] - sac[0]) * Math.min(1, dt * 28); sac[1] += (sacT[1] - sac[1]) * Math.min(1, dt * 28);
    const ks = T.look ? 0.45 : 1, tg2 = [tgt[0] + sac[0] * ks, tgt[1] + sac[1] * ks];
    if (Math.hypot(tgt[0] - tgtPrev[0], tgt[1] - tgtPrev[1]) > 0.9 && parp <= 0 && tiempo > proxBlink2) { proxBlink2 = tiempo + 1.2; if (Math.random() < 0.6) parp = 0.14; }
    tgtPrev[0] = tgt[0]; tgtPrev[1] = tgt[1];
    const kl = Math.min(1, dt * 10); ELook.x += (tg2[0] - ELook.x) * kl; ELook.y += (tg2[1] - ELook.y) * kl;
    { const gk = (gesto && gesto.t0) || (esp && esp.t0) || 0; if (gk !== yawGK) { yawGK = gk; if (gk && volOn) YAW.v += (Math.random() < 0.5 ? -1 : 1) * 2.4; } YAW.t = volOn ? clamp(giroBase + 0.34 * E.px + 0.07 * Math.sin(tiempo * 0.45) + (est === 'dormir' ? -0.12 : 0), -0.75, 0.75) : 0; YAW.paso(dt); }
    AB.lid += (T.lid - AB.lid) * Math.min(1, dt * 9); AB.tilt += (T.tilt - AB.tilt) * Math.min(1, dt * 9);
    E.lid = AB.lid; E.tilt = AB.tilt; E.open = open; E.px = clamp(ELook.x, -1, 1); E.py = clamp(ELook.y, -1, 1);
    posar(expr, dt); if (ojosSw < 1) { ojosSw = Math.min(1, ojosSw + dt / 0.25); if (ojosSw >= 1) ojosPrev = null; }
    const ke = 1 - Math.exp(-dt * 28), Ec = { lid: 0, tilt: 0, open: 1, px: E.px, py: E.py, seed: E.seed };
    for (let s = 0; s < 2; s++) for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const i = s * 36 + r * 6 + c, tv = celdaObj(expr === 'sleep' || expr === 'strain' ? 'n' : expr, r, c, s ? 1 : -1, Ec); celdas[i] += (tv - celdas[i]) * ke; }
    // voz
    if (est === 'escuchando') {
      if (vozN > 0.07) ultVoz = tiempo;
      if (vozN > 0.3 && vozN - vPrev > 0.12 && tiempo > proxAnillo) { proxAnillo = tiempo + 0.2; anillos.push({ t: tiempo, a: vozN }); if (anillos.length > 4) anillos.shift(); pulso = 1; if (tiempo > proxBlink && parp <= 0) { proxBlink = tiempo + 0.7; parp = 0.14; } }
      vPrev = vozN; vib += (vozN - vib) * Math.min(1, dt * 10);
    } else vib *= Math.exp(-dt * 6);
    pulso *= Math.exp(-dt * 7); eyeK += (eyeKt - eyeK) * Math.min(1, dt * 8); E.seed = Math.floor(tiempo * 18); lastT = T;
    if (vozN > 0.02 && est !== 'escuchando') { proxVoz -= dt; if (proxVoz < 0) { proxVoz = 0.15; ondasVoz.push({ t: tiempo, a: vozN }); if (ondasVoz.length > 6) ondasVoz.shift(); } }
    burb.forEach(b => { if (b.a <= 0) return; b.e += dt; if (b.e < b.vida) { b.y += b.v * dt; b.x += (0.04 * Math.sin(b.e * 3 + b.ph) + (b.vx || 0)) * dt; } else if (b.e > b.vida + 0.18) b.a = 0; });
    if (est === 'error') {
      const t = tiempo - t0;
      part.forEach(p => { p.age += dt; if (p.age < 0) return; if (t < 1.7) { p.vy -= 1.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < GROUND + p.r) { p.y = GROUND + p.r; p.vy *= -0.25; p.vx *= 0.6; } } else { const k = Math.min(1, dt * 3.2); p.x += (S.x.x - p.x) * k; p.y += (S.y.x - 0.05 - p.y) * k; } });
    }
    { const AC = { reposo: 0.25, dormir: 0.08, parado: 0.1, pensar: 0.85, leer: 0.7, escribir: 1, comando: 1, web: 0.8, esperando: 0.55, enviar: 0.9, hecho: 0.7, error: 1, proyectos: 0.8, escuchando: 0.6 }; const tg = clamp((AC[est] ?? 0.3) + (morphU < 1 ? 0.5 : 0) + vozN * 0.4 + zapK * 0.5, 0, 1); act += (tg - act) * Math.min(1, dt * 5); }
    if (T.arena !== undefined) arenaV = T.arena; arenaK += (((shapeTo === 'reloj' && T.arena !== undefined) ? 1 : 0) - arenaK) * Math.min(1, dt * 8);
    if (enfK > 0.25 && tiempo > proxVapor) { proxVapor = tiempo + rnd(1.6, 3.4) / (0.5 + enfK); const sc = S.s.x, yt = S.y.x + 0.34 * sc; for (const sg of [-1, 1]) vapor.push({ x: S.x.x + sg * 0.16 * sc, y: yt, vx: sg * rnd(0.05, 0.11), vy: rnd(0.16, 0.26), e: -rnd(0, 0.12), vida: rnd(0.9, 1.3), r: 0.07 * sc }); }
    for (let i = vapor.length - 1; i >= 0; i--) { const v = vapor[i]; v.e += dt; if (v.e < 0) continue; v.x += v.vx * dt; v.y += v.vy * dt; if (v.e > v.vida) vapor.splice(i, 1); }
    calcularForma();
    if (!dibujar) return;
    pintar(T, hopOff, dt);
  }

  function pintar(T, hopOff, dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (O.transparente) ctx.clearRect(0, 0, W, H);
    else { ctx.fillStyle = '#131416'; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(W / 2, H * .45, 0, W / 2, H * .45, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(60,50,40,.30)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const bx = S.x.x, by = S.y.x + hopOff;
    // sombra
    if (O.sombra) { const alt = clamp((by - GROUND) / 1.2, 0, 1), sw = (0.36 * S.s.x + 0.05) * pxu * (1 - .3 * alt), sh = sw * 0.2; if (est !== 'comando' && est !== 'leer') { const g = ctx.createRadialGradient(px(bx * 0.9), py(GROUND), 0, px(bx * 0.9), py(GROUND), sw); g.addColorStop(0, `rgba(0,0,0,${O.transparente ? .35 : .5 * (1 - .4 * alt)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.translate(0, py(GROUND)); ctx.scale(1, sh / sw); ctx.translate(0, -py(GROUND)); ctx.fillStyle = g; ctx.fillRect(px(bx * .9) - sw, py(GROUND) - sw, sw * 2, sw * 2); ctx.restore(); } }
    if (O.sombra && volOn && est !== 'comando' && est !== 'leer') { const alt = clamp((by - GROUND) / 1.2, 0, 1), sw = (0.36 * S.s.x + 0.05) * pxu * (1 - .3 * alt), sh = sw * 0.2, X = px(bx * 0.9 + 0.05 * Math.sin(YAW.x)), Y = py(GROUND);
      ctx.save(); ctx.translate(0, Y); ctx.scale(1, sh / sw); ctx.translate(0, -Y);
      let g = ctx.createRadialGradient(X, Y, 0, X, Y, sw * 1.55); g.addColorStop(0, 'rgba(240,194,75,' + 0.10 * (1 - 0.5 * alt) + ')'); g.addColorStop(1, 'rgba(240,194,75,0)'); ctx.fillStyle = g; ctx.fillRect(X - sw * 1.6, Y - sw * 1.6, sw * 3.2, sw * 3.2);
      g = ctx.createRadialGradient(X, Y, 0, X, Y, sw * 0.62); g.addColorStop(0, 'rgba(10,4,0,' + (O.transparente ? 0.55 : 0.8) * (1 - 0.45 * alt) + ')'); g.addColorStop(0.6, 'rgba(10,4,0,' + 0.26 * (1 - 0.45 * alt) + ')'); g.addColorStop(1, 'rgba(10,4,0,0)'); ctx.fillStyle = g; ctx.fillRect(X - sw, Y - sw, sw * 2, sw * 2); ctx.restore(); }
    const De = esp ? ESP[esp.n] : null, ue = esp ? tiempo - esp.t0 : 0;
    if (De && De.p) De.p(esp, ue, bx, by, T);
    dibujarCuerpoMorph(T, bx, by);
    if (anillos.length && ptsActual) { const P = pathPts(ptsActual), U0 = S0 * pxu * S.s.x; for (const a of anillos) { const u = (tiempo - a.t) / 1.1; if (u >= 1) continue; const k = 1 + 0.9 * ease(u); ctx.save(); ctx.translate(px(bx), py(by)); ctx.rotate(-S.r.x); ctx.scale(U0 * k, U0 * k); ctx.globalAlpha = Math.pow(1 - u, 1.2) * (0.5 + 0.45 * a.a); ctx.lineWidth = Math.max(1, pxu * 0.006) / (U0 * k); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,234,200,1)'; ctx.stroke(P); ctx.restore(); } }
    if (De && De.d) De.d(esp, ue, bx, by);
    if (est === 'escribir') dibujarLadrillos(1);
    // check de 'hecho'
    if (T.check) { const k = ease(T.check); dibujarContorno(ptsFijo('check'), bx + 0.55 * S.s.x, by + 0.55 * S.s.x, 0.42 * k, 1); }
    // gotas rojas
    if (est === 'error') { const t = tiempo - t0; for (const p of part) { if (p.age < 0) continue; const dB = Math.hypot(p.x - S.x.x, p.y - S.y.x), g = clamp(p.age / 0.14, 0, 1) * (t > 1.7 ? clamp((dB - 0.06) / 0.12, 0, 1) : 1); if (g > 0.03) gotaPx(px(p.x), py(p.y), p.r * pxu * g, 0, 1, mezcla(ROJO, BASE, t > 1.7 ? clamp((t - 1.7) / 0.9, 0, 1) : 0)); } }
    // Z Z Z (dormir): glifo 5x5 de LEDs que sube flotando
    for (let i = zs.length - 1; i >= 0; i--) { const z = zs[i], u = (tiempo - z.t) / 3.4; if (u > 1) { zs.splice(i, 1); continue; }
      const cs = pxu * (0.016 + 0.016 * u), x0 = px(S.x.x + 0.34 + 0.10 * u + 0.025 * Math.sin(u * 9)), y0 = py(S.y.x + 0.26 + 0.55 * u), al = Math.sin(Math.PI * u) * 0.9, sz = cs * 2.7;
      const Zp = ['11111', '00010', '00100', '01000', '11111']; ctx.save(); ctx.globalAlpha = al;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (Zp[r][c] === '1') ctx.drawImage(SPR.cian, x0 + (c - 2) * cs * 1.15 - sz / 2, y0 + (r - 2) * cs * 1.15 - sz / 2, sz, sz);
      ctx.restore(); }
    // burbujas finas
    for (const b of burb) { if (b.a <= 0) continue; const pop = b.e > b.vida ? (b.e - b.vida) / 0.18 : 0, r = b.r * pxu * (1 + 0.5 * pop), al = (1 - pop) * Math.min(1, b.e * 6); ctx.save(); ctx.globalAlpha = al * 0.9; ctx.beginPath(); ctx.arc(px(b.x), py(b.y), r, 0, TAU); ctx.strokeStyle = 'rgba(255,238,215,.95)'; ctx.lineWidth = Math.max(1, pxu * 0.004); ctx.stroke(); ctx.fillStyle = 'rgba(240,194,75,.08)'; ctx.fill(); ctx.beginPath(); ctx.arc(px(b.x) - r * .35, py(b.y) - r * .38, r * .16, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(); ctx.restore(); }
    // vapor del enfado: nubecitas que suben y se abren
    for (const v of vapor) { if (v.e < 0) continue; const f = v.e / v.vida, R = v.r * (1 + 1.7 * f) * pxu, al = (1 - f) * Math.min(1, v.e * 8); ctx.save(); ctx.globalAlpha = al;
      for (const [ox, oy, k] of [[-0.55, 0.1, 0.8], [0.5, 0.2, 0.75], [0, -0.45, 0.85], [0.05, 0.35, 0.7]]) { const X = px(v.x) + ox * R, Y = py(v.y) - oy * R, r = R * k, g = ctx.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, 'rgba(255,248,246,1)'); g.addColorStop(0.6, 'rgba(255,206,198,.75)'); g.addColorStop(1, 'rgba(255,170,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill(); }
      ctx.restore(); }
    // ondas de voz (anillos finos alrededor)
    for (const o of ondasVoz) { const u = (tiempo - o.t) / 0.9; if (u > 1) continue; ctx.save(); ctx.globalAlpha = (1 - u) * 0.6 * o.a; ctx.beginPath(); ctx.ellipse(px(bx), py(by - 0.02), pxu * S0 * S.s.x * (1.2 + u * 1.2), pxu * S0 * S.s.x * (0.95 + u * 0.9), 0, 0, TAU); ctx.strokeStyle = rgba(BASE, 1); ctx.lineWidth = Math.max(1, pxu * 0.005); ctx.stroke(); ctx.restore(); }
  }

  // ----- puntero -----
  function aMundo(e) { const r = canvas.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null; const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = 1 - (e.clientY - r.top) / r.height * 2; return [nx * (r.width / r.height) * O.vista, ny * O.vista]; }
  const mover = e => { const p = aMundo(e); if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) puntero = p; };
  const abajo = e => { const p = aMundo(e); if (!p) return; puntero = p; if (Math.hypot(p[0] - S.x.x, p[1] - S.y.x) < 0.45 * S.s.x + 0.1) { arrastre = { t: tiempo, x: p[0], y: p[1] }; canvas.setPointerCapture?.(e.pointerId); } };
  const arriba = e => { if (arrastre) { const p = aMundo(e) || [arrastre.x, arrastre.y]; const corto = tiempo - arrastre.t < 0.28 && Math.hypot(p[0] - arrastre.x, p[1] - arrastre.y) < 0.05; arrastre = null; wob = Math.max(wob, 0.7); if (corto) cosquillas(); else S.sy.v += 1.2; } };
  window.addEventListener('pointermove', mover); canvas.addEventListener('pointerdown', abajo); window.addEventListener('pointerup', arriba);
  canvas.style.touchAction = 'none';
  function cosquillas() { cerrar = 0.7; wob = 1; S.sx.v += rnd(-1.5, 1.5); S.sy.v += rnd(1, 2); }

  // ----- reloj -----
  const reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reducido) espOn = false;
  let acum = 0, raf = 0, ult = 0, ms = 16, cont = 0, manual = !!window.__tiempoManual;
  function bucle(ahora) {
    raf = requestAnimationFrame(bucle);
    const real = ahora - ult, dt = Math.min(0.05, real / 1000 || 0.016); ult = ahora;
    if (reducido) { acum += dt; if (acum < 1 / 12) return; const d2 = acum; acum = 0; wob = 0; proxGesto = tiempo + 99; esp = null; actualizar(d2); return; }
    actualizar(dt);
    ms = ms * 0.95 + real * 0.05; if (++cont % 60 === 0 && ms > 26 && calidad > 0.5) { calidad *= 0.85; tamano(); }
  }
  function arrancar() { if (!raf && !manual && !document.hidden) { ult = performance.now(); raf = requestAnimationFrame(bucle); } }
  function parar() { cancelAnimationFrame(raf); raf = 0; }
  const visib = () => document.hidden ? parar() : arrancar();
  document.addEventListener('visibilitychange', visib); arrancar();

  const api = {
    estados: ESTADOS, formas: FORMAS,
    estado(n) { if (!ESTADOS.includes(n)) throw new Error('estado desconocido: ' + n); formaSel = null; entrar(n); return api; },
    ojos(id) { id = String(id); if (!ID_OJOS.includes(id)) throw new Error('estilo de ojos desconocido: ' + id); if (id !== ojosId) { ojosPrev = ojosId; ojosId = id; ojosSw = 0; } return api; },
    expresion(n, seg = 1.2) { exprF = n ? { n, hasta: tiempo + seg } : null; return api; },
    volumen(b = true) { volOn = !!b; return api; }, get conVolumen() { return volOn; }, get giroActual() { return YAW.x; }, giro(r = 0) { giroBase = Number.isFinite(r) ? clamp(r, -0.75, 0.75) : 0; return api; }, visor(b) { visorOjos = b === undefined ? undefined : !!b; return api; },
    listaOjos() { return Object.assign({}, NOMBRE_OJOS); },
    get estiloOjos() { return ojosId; },
    forma(n) { if (est !== 'reposo') entrar('reposo'); formaSel = FORMAS.includes(n) && n !== 'circulo' ? n : null; formaT = tiempo; wob = Math.max(wob, 0.4); return api; },
    proyectos(n, dur = 4) { n = clamp(Math.round(n), 1, 4); if (n < 2) { if (est === 'proyectos') t0 = tiempo - durProy; return api; } np = n; durProy = dur; formaSel = null; entrar('proyectos'); return api; },
    voz(nivel) { vozN = Number.isFinite(nivel) ? clamp(nivel, 0, 1) : 0; return api; },
    atento(b = true) { atentoOn = !!b; return api; },
    dormir() { return api.estado('dormir'); },
    despertar() { return api.estado('reposo'); },
    extras(o = {}) {
      if ('proyectosTrabajando' in o) { const n = clamp(Math.round(o.proyectosTrabajando || 0), 0, 4); if (n >= 2) { if (est !== 'proyectos' || np !== n) api.proyectos(n, 1e9); } else if (est === 'proyectos') t0 = tiempo - durProy; }
      if ('voz' in o) api.voz(reducido ? 0 : o.voz || 0);
      if ('atento' in o) api.atento(!!o.atento);
      if ('dormir' in o) { if (o.dormir && est !== 'dormir') api.estado('dormir'); else if (!o.dormir && est === 'dormir') api.estado('reposo'); }
      return api;
    },
    espontanea(n) { if (!n) n = elegirEsp(); if (!ESP[n]) throw new Error('espontanea desconocida: ' + n); if (est !== 'reposo') entrar('reposo'); formaSel = null; gesto = null; minis = []; iniciarEsp(n); return api; },
    reloj(f) { if (f === null || f === undefined || !Number.isFinite(+f)) relojP = null; else { relojP = clamp(+f, 0, 1); if (est !== 'reposo') entrar('reposo'); esp = null; gesto = null; formaSel = null; } return api; },
    enfado(n) { enfadoN = n === null || n === undefined || !Number.isFinite(+n) ? 0 : clamp(+n, 0, 1); return api; },
    listaEspontaneas() { return NOMBRES.slice(); },
    gesto(tipo) { if (est === 'reposo') { gesto = { tipo, t0: tiempo, lado: Math.random() < 0.5 ? -1 : 1 }; if (tipo === 'salto') S.sy.v += 1.6; } return api; },
    avanzar(dt, dibujar = true) { manual = true; parar(); actualizar(dt, dibujar); return api; },
    saltar(seg) { manual = true; parar(); const n = Math.max(1, Math.round(seg * 60)); for (let i = 0; i < n - 1; i++) actualizar(1 / 60, false); actualizar(1 / 60, true); return api; },
    cosquillas, get tiempo() { return tiempo; }, get estadoActual() { return est; }, get calidad() { return calidad; },
    pausar: parar, seguir: arrancar,
    destruir() { parar(); ro.disconnect(); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', arriba); document.removeEventListener('visibilitychange', visib); canvas.removeEventListener('pointerdown', abajo); },
  };
  return api;
}
