// avatar.js — a layered 2D avatar drawn on a canvas.
// drawAvatar() takes a "look" (how the avatar is styled) and a "face"
// (the live expression state from the tracker) and paints one frame.
//
// In the face state, L and R mean the avatar's screen-left and screen-right
// side. The tracker decides which of your eyes drives which side
// (see "Mirror movements" in Setup).

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const NEUTRAL = Object.freeze({
  blinkL: 0, blinkR: 0, wideL: 0, wideR: 0, squintL: 0, squintR: 0,
  lookX: 0, lookY: 0,
  browInner: 0, browOuterL: 0, browOuterR: 0, browDownL: 0, browDownR: 0,
  jaw: 0, smileL: 0, smileR: 0, frown: 0, pucker: 0, funnel: 0, mouthX: 0, cheekPuff: 0,
  yaw: 0, pitch: 0, roll: 0, tx: 0, ty: 0,
});

// ---------- palettes used by the editor ----------
export const SKIN = ['#2d1a12', '#4a2b1c', '#663d26', '#7f4d2c', '#965f36', '#b07442', '#c98d5a', '#dba678', '#ebc39b', '#f6dcc1'];
export const HAIR = ['#0d0a09', '#2a1a12', '#46291a', '#6e4226', '#9c6232', '#c9a063', '#e6cf98', '#8f8f8f', '#ece8e1', '#b03a3a', '#3557b7', '#7a3db8', '#2c9c86'];
export const CLOTH = ['#1c2433', '#2f6fd6', '#1f9e74', '#e3b23c', '#d9534f', '#7f56d9', '#f2f2f2', '#e477a6', '#17a2b8', '#ef8a2a', '#3b3b3b', '#7a8f3c'];
export const IRIS = ['#2b1a10', '#5b3a1e', '#8a5a2b', '#3e7a3a', '#2f6e9e', '#6e8fa8', '#9a7b3b', '#6b3fa0'];
export const BGS = ['#1a2238', '#2b3a55', '#3b2a4d', '#173b3a', '#4d2a2a', '#f2efe9', '#e9f0f7', '#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#0e1118'];
export const ACCENTS = ['#f2c14e', '#d7d7d7', '#c47b3b', '#e85d75', '#4cc9f0', '#ffffff', '#111111', '#2ec27e'];
export const LIPS = ['#7c3a3a', '#9c4a4a', '#b5525b', '#c96b6b', '#d98c8c', '#6b2b3a', '#8e3b5c', '#a35d3d'];
export const BLUSH = ['#e07a7a', '#ef8f9b', '#d9776a', '#c4645c', '#f2a65a'];

export const CHROMA = { green: '#00b140', blue: '#0047bb' };

export const DEFAULT_LOOK = Object.freeze({
  body: 'male', shoulders: 1, neckWidth: 1, age: 'adult',
  faceShape: 'oval', skin: '#7f4d2c', faceWidth: 1, faceLength: 1, shading: true,
  blush: false, blushColor: '#e07a7a', freckles: false, ears: true, earSize: 1,
  eyeStyle: 'round', irisColor: '#5b3a1e', eyeSize: 1, eyeSpacing: 1, eyeHeight: 0, lashes: false,
  eyeshadow: false, eyeshadowColor: '#8e5bb8', eyeliner: false, beautyMark: 'none',
  browStyle: 'soft', browColor: '#1a110c', browThickness: 1,
  noseStyle: 'button', noseSize: 1,
  mouthStyle: 'lips', lipColor: '#7c3a3a', mouthWidth: 1,
  hairStyle: 'short', hairColor: '#0d0a09',
  facialHair: 'none', facialHairColor: '#0d0a09',
  glasses: 'none', glassesColor: '#1c1c1c',
  headwear: 'none', headwearColor: '#d9534f', headwearColor2: '#f2c14e',
  earrings: 'none', earringColor: '#f2c14e',
  top: 'tee', topColor: '#2f6fd6', topColor2: '#f2f2f2',
  bg: 'studio', bgColor: '#2b3a55', bgColor2: '#0e1118', zoom: 1, posY: 0,
  outline: true, outlineColor: '#15121a', outlineWidth: 3.2,
});

const opt = (...pairs) => pairs.map(p => (Array.isArray(p) ? p : [p, p[0].toUpperCase() + p.slice(1)]));

// The editor is generated from this schema.
export const SCHEMA = [
  { id: 'body', title: 'Body', fields: [
    { key: 'body', label: 'Body type', type: 'choice', options: opt('male', 'female', 'neutral') },
    { key: 'shoulders', label: 'Shoulder width', type: 'range', min: 0.8, max: 1.2, step: 0.01 },
    { key: 'neckWidth', label: 'Neck width', type: 'range', min: 0.75, max: 1.3, step: 0.01 },
    { key: 'age', label: 'Age', type: 'choice', options: opt('young', 'adult', 'older') },
  ] },
  { id: 'face', title: 'Face', fields: [
    { key: 'faceShape', label: 'Shape', type: 'choice', options: opt('oval', 'round', 'square', 'heart', 'long') },
    { key: 'skin', label: 'Skin tone', type: 'color', swatches: SKIN },
    { key: 'faceWidth', label: 'Width', type: 'range', min: 0.82, max: 1.18, step: 0.01 },
    { key: 'faceLength', label: 'Length', type: 'range', min: 0.86, max: 1.14, step: 0.01 },
    { key: 'shading', label: 'Soft shading', type: 'toggle' },
    { key: 'blush', label: 'Blush', type: 'toggle' },
    { key: 'blushColor', label: 'Blush colour', type: 'color', swatches: BLUSH, when: l => l.blush },
    { key: 'freckles', label: 'Freckles', type: 'toggle' },
    { key: 'beautyMark', label: 'Beauty mark', type: 'choice', options: opt('none', 'cheek', 'lip') },
    { key: 'ears', label: 'Show ears', type: 'toggle' },
    { key: 'earSize', label: 'Ear size', type: 'range', min: 0.7, max: 1.35, step: 0.01, when: l => l.ears },
  ] },
  { id: 'eyes', title: 'Eyes', fields: [
    { key: 'eyeStyle', label: 'Style', type: 'choice', options: opt('round', 'almond', 'anime', 'sleepy', 'dot') },
    { key: 'irisColor', label: 'Eye colour', type: 'color', swatches: IRIS, when: l => l.eyeStyle !== 'dot' },
    { key: 'eyeSize', label: 'Size', type: 'range', min: 0.75, max: 1.35, step: 0.01 },
    { key: 'eyeSpacing', label: 'Spacing', type: 'range', min: 0.82, max: 1.2, step: 0.01 },
    { key: 'eyeHeight', label: 'Height', type: 'range', min: -1, max: 1, step: 0.02 },
    { key: 'lashes', label: 'Lashes', type: 'toggle' },
    { key: 'eyeliner', label: 'Eyeliner', type: 'toggle' },
    { key: 'eyeshadow', label: 'Eyeshadow', type: 'toggle' },
    { key: 'eyeshadowColor', label: 'Eyeshadow colour', type: 'color', swatches: ['#8e5bb8', '#c47b3b', '#2f6e9e', '#d98c8c', '#3e7a3a', '#c9a063', '#3b3b3b'], when: l => l.eyeshadow },
  ] },
  { id: 'brows', title: 'Brows & nose', fields: [
    { key: 'browStyle', label: 'Brows', type: 'choice', options: opt('soft', 'arched', 'straight', 'thick', 'thin', 'none') },
    { key: 'browColor', label: 'Brow colour', type: 'color', swatches: HAIR, when: l => l.browStyle !== 'none' },
    { key: 'browThickness', label: 'Brow weight', type: 'range', min: 0.6, max: 1.6, step: 0.01, when: l => l.browStyle !== 'none' },
    { key: 'noseStyle', label: 'Nose', type: 'choice', options: opt('button', 'line', 'nostrils', 'wide', 'none') },
    { key: 'noseSize', label: 'Nose size', type: 'range', min: 0.7, max: 1.4, step: 0.01, when: l => l.noseStyle !== 'none' },
  ] },
  { id: 'mouth', title: 'Mouth', fields: [
    { key: 'mouthStyle', label: 'Style', type: 'choice', options: opt('lips', 'line', 'bold') },
    { key: 'lipColor', label: 'Lip colour', type: 'color', swatches: LIPS, when: l => l.mouthStyle === 'lips' },
    { key: 'mouthWidth', label: 'Width', type: 'range', min: 0.75, max: 1.3, step: 0.01 },
  ] },
  { id: 'hair', title: 'Hair', fields: [
    { key: 'hairStyle', label: 'Style', type: 'choice', options: opt('none', 'buzz', 'short', ['sidepart', 'Side part'], 'afro', 'curly', 'locs', 'bob', 'long', 'bun', 'ponytail', 'mohawk', 'pixie', 'braids', 'wavy', 'puffs') },
    { key: 'hairColor', label: 'Hair colour', type: 'color', swatches: HAIR, when: l => l.hairStyle !== 'none' },
  ] },
  { id: 'facial', title: 'Facial hair', fields: [
    { key: 'facialHair', label: 'Style', type: 'choice', options: opt('none', 'stubble', 'mustache', 'goatee', 'beard', ['chinstrap', 'Chin strap']) },
    { key: 'facialHairColor', label: 'Colour', type: 'color', swatches: HAIR, when: l => l.facialHair !== 'none' },
  ] },
  { id: 'acc', title: 'Accessories', fields: [
    { key: 'glasses', label: 'Glasses', type: 'choice', options: opt('none', 'round', 'square', 'browline', ['shades', 'Sunglasses']) },
    { key: 'glassesColor', label: 'Frame colour', type: 'color', swatches: ['#1c1c1c', '#6b4226', '#c9a063', '#d9d9d9', '#d9534f', '#2f6fd6'], when: l => l.glasses !== 'none' },
    { key: 'headwear', label: 'Headwear', type: 'choice', options: opt('none', 'beanie', 'cap', ['headwrap', 'Headwrap'], 'headphones') },
    { key: 'headwearColor', label: 'Main colour', type: 'color', swatches: CLOTH, when: l => l.headwear !== 'none' },
    { key: 'headwearColor2', label: 'Detail colour', type: 'color', swatches: ACCENTS, when: l => l.headwear !== 'none' },
    { key: 'earrings', label: 'Earrings', type: 'choice', options: opt('none', 'studs', 'hoops', 'drops') },
    { key: 'earringColor', label: 'Earring colour', type: 'color', swatches: ACCENTS, when: l => l.earrings !== 'none' },
  ] },
  { id: 'clothes', title: 'Clothes', fields: [
    { key: 'top', label: 'Top', type: 'choice', options: opt(['tee', 'T-shirt'], ['vneck', 'V-neck'], 'hoodie', ['collared', 'Collared'], 'blazer', ['scoop', 'Scoop neck'], ['turtleneck', 'Turtleneck'], ['tank', 'Tank top']) },
    { key: 'topColor', label: 'Main colour', type: 'color', swatches: CLOTH },
    { key: 'topColor2', label: 'Detail colour', type: 'color', swatches: CLOTH, when: l => ['hoodie', 'collared', 'blazer'].includes(l.top) },
  ] },
  { id: 'scene', title: 'Background & framing', fields: [
    { key: 'bg', label: 'Background', type: 'choice', options: opt('studio', 'solid', 'gradient', 'dots', ['green', 'Green screen'], ['blue', 'Blue screen']) },
    { key: 'bgColor', label: 'Colour', type: 'color', swatches: BGS, when: l => !(l.bg in CHROMA) },
    { key: 'bgColor2', label: 'Second colour', type: 'color', swatches: BGS, when: l => ['studio', 'gradient', 'dots'].includes(l.bg) },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.7, max: 1.6, step: 0.01 },
    { key: 'posY', label: 'Move up / down', type: 'range', min: -1, max: 1, step: 0.02 },
  ] },
  { id: 'line', title: 'Line style', fields: [
    { key: 'outline', label: 'Ink outlines', type: 'toggle' },
    { key: 'outlineColor', label: 'Ink colour', type: 'color', swatches: ['#15121a', '#3a2a22', '#1c2433', '#ffffff', '#5a1f3a'], when: l => l.outline },
    { key: 'outlineWidth', label: 'Ink weight', type: 'range', min: 1.5, max: 6, step: 0.1, when: l => l.outline },
  ] },
];

export const PRESETS = [
  { name: 'Host', look: { ...DEFAULT_LOOK } },
  { name: 'Podcaster', look: { ...DEFAULT_LOOK, skin: '#4a2b1c', hairStyle: 'locs', hairColor: '#2a1a12', facialHair: 'beard', facialHairColor: '#1a110c', headwear: 'headphones', headwearColor: '#1c2433', headwearColor2: '#ef8a2a', top: 'hoodie', topColor: '#ef8a2a', topColor2: '#f2f2f2', bg: 'studio', bgColor: '#3b2a4d', bgColor2: '#120d18', browStyle: 'thick' } },
  { name: 'Headwrap', look: { ...DEFAULT_LOOK, skin: '#663d26', hairStyle: 'none', headwear: 'headwrap', headwearColor: '#d9534f', headwearColor2: '#f2c14e', eyeStyle: 'almond', lashes: true, earrings: 'hoops', earringColor: '#f2c14e', lipColor: '#8e3b5c', blush: true, blushColor: '#c4645c', top: 'vneck', topColor: '#1f9e74', bg: 'gradient', bgColor: '#ffd166', bgColor2: '#ef8a2a', browStyle: 'arched' } },
  { name: 'Lecturer', look: { ...DEFAULT_LOOK, skin: '#dba678', faceShape: 'square', hairStyle: 'sidepart', hairColor: '#8f8f8f', facialHair: 'goatee', facialHairColor: '#8f8f8f', glasses: 'browline', glassesColor: '#1c1c1c', top: 'blazer', topColor: '#1c2433', topColor2: '#e9f0f7', bg: 'solid', bgColor: '#e9f0f7', eyeStyle: 'almond', mouthStyle: 'line', noseStyle: 'line' } },
  { name: 'Male', look: { ...DEFAULT_LOOK, body: 'male', faceShape: 'square', hairStyle: 'sidepart', hairColor: '#2a1a12', facialHair: 'stubble', facialHairColor: '#2a1a12', browStyle: 'thick', mouthStyle: 'line', top: 'collared', topColor: '#1c2433', topColor2: '#f2f2f2', bg: 'studio', bgColor: '#173b3a', bgColor2: '#0e1118' } },
  { name: 'Female', look: { ...DEFAULT_LOOK, body: 'female', faceShape: 'oval', skin: '#965f36', hairStyle: 'wavy', hairColor: '#2a1a12', eyeStyle: 'almond', lashes: true, eyeliner: true, browStyle: 'arched', lipColor: '#b5525b', blush: true, earrings: 'studs', earringColor: '#f2c14e', top: 'scoop', topColor: '#e477a6', bg: 'studio', bgColor: '#3b2a4d', bgColor2: '#120d18', shoulders: 0.95 } },
  { name: 'Student', look: { ...DEFAULT_LOOK, body: 'neutral', age: 'young', faceShape: 'round', skin: '#c98d5a', hairStyle: 'puffs', hairColor: '#0d0a09', eyeStyle: 'anime', freckles: true, top: 'hoodie', topColor: '#7f56d9', topColor2: '#f2f2f2', bg: 'dots', bgColor: '#ffd166', bgColor2: '#ef8a2a' } },
  { name: 'Grandpa', look: { ...DEFAULT_LOOK, body: 'male', age: 'older', skin: '#b07442', faceShape: 'long', hairStyle: 'buzz', hairColor: '#ece8e1', browColor: '#8f8f8f', facialHair: 'mustache', facialHairColor: '#ece8e1', glasses: 'round', top: 'turtleneck', topColor: '#7a8f3c', bg: 'solid', bgColor: '#f2efe9' } },
  { name: 'Grandma', look: { ...DEFAULT_LOOK, body: 'female', age: 'older', skin: '#ebc39b', hairStyle: 'bun', hairColor: '#ece8e1', browColor: '#8f8f8f', eyeStyle: 'sleepy', glasses: 'browline', glassesColor: '#c9a063', earrings: 'drops', earringColor: '#d7d7d7', lipColor: '#c96b6b', blush: true, top: 'blazer', topColor: '#8e3b5c', topColor2: '#f2f2f2', bg: 'gradient', bgColor: '#e9f0f7', bgColor2: '#d98c8c', shoulders: 0.92 } },
  { name: 'Coach', look: { ...DEFAULT_LOOK, body: 'female', skin: '#4a2b1c', hairStyle: 'braids', hairColor: '#0d0a09', browStyle: 'straight', headwear: 'cap', headwearColor: '#1f9e74', headwearColor2: '#f2f2f2', top: 'tank', topColor: '#1c2433', bg: 'green' } },
  { name: 'Neon', look: { ...DEFAULT_LOOK, skin: '#ebc39b', faceShape: 'heart', hairStyle: 'bob', hairColor: '#7a3db8', eyeStyle: 'anime', irisColor: '#2f6e9e', lashes: true, blush: true, freckles: true, top: 'collared', topColor: '#17a2b8', topColor2: '#f2f2f2', bg: 'dots', bgColor: '#ef476f', bgColor2: '#1a2238', outlineColor: '#1c2433', outlineWidth: 4, noseStyle: 'nostrils', mouthStyle: 'bold' } },
];

// Pick a random look from the schema (used by the Randomize button).
export function randomLook(base = DEFAULT_LOOK) {
  const look = { ...base };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  for (const sec of SCHEMA) {
    for (const f of sec.fields) {
      if (f.type === 'choice') look[f.key] = pick(f.options)[0];
      else if (f.type === 'color') look[f.key] = pick(f.swatches);
      else if (f.type === 'range' && !['zoom', 'posY', 'outlineWidth'].includes(f.key)) look[f.key] = +(f.min + Math.random() * (f.max - f.min) * 0.8 + (f.max - f.min) * 0.1).toFixed(2);
    }
  }
  look.bg = Math.random() < 0.85 ? pick(['studio', 'solid', 'gradient', 'dots']) : look.bg;
  if (Math.random() < 0.55) look.glasses = 'none';
  if (Math.random() < 0.6) look.headwear = 'none';
  if (Math.random() < 0.55) look.facialHair = 'none';
  if (Math.random() < 0.5) look.earrings = 'none';
  look.browColor = look.hairColor === '#ece8e1' ? '#8f8f8f' : look.hairColor;
  look.facialHairColor = look.hairColor;
  look.outline = Math.random() < 0.85;
  if (look.body === 'male') { look.eyeshadow = false; look.eyeliner = false; }
  else if (Math.random() < 0.8) look.facialHair = 'none';
  if (Math.random() < 0.8) look.beautyMark = 'none';
  if (Math.random() < 0.7) look.age = 'adult';
  return look;
}

// ---------- colour helpers ----------
function hexToRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = amt < 0 ? c => Math.round(c * (1 + amt)) : c => Math.round(c + (255 - c) * amt);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------- background ----------
function drawBackground(ctx, W, H, look) {
  if (look.bg in CHROMA) {
    ctx.fillStyle = CHROMA[look.bg];
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (look.bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, look.bgColor);
    g.addColorStop(1, look.bgColor2);
    ctx.fillStyle = g;
  } else if (look.bg === 'studio') {
    const r = Math.hypot(W, H) * 0.62;
    const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, r);
    g.addColorStop(0, look.bgColor);
    g.addColorStop(1, look.bgColor2);
    ctx.fillStyle = g;
  } else if (look.bg === 'dots') {
    ctx.fillStyle = look.bgColor2;
    ctx.fillRect(0, 0, W, H);
    const step = Math.max(W, H) / 34;
    ctx.fillStyle = rgba(look.bgColor, 0.55);
    for (let y = step / 2, row = 0; y < H + step; y += step, row++) {
      for (let x = (row % 2) * step / 2; x < W + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, step * 0.12, 0, TAU);
        ctx.fill();
      }
    }
    return;
  } else {
    ctx.fillStyle = look.bgColor;
  }
  ctx.fillRect(0, 0, W, H);
}

// ---------- head shapes (right half as cubic segments, unit space) ----------
const SHAPES = {
  oval: { sx: 1, sy: 1, segs: [[0.56, -1, 1, -0.56, 1, 0], [1, 0.58, 0.6, 1, 0, 1]] },
  round: { sx: 1.07, sy: 0.94, segs: [[0.56, -1, 1, -0.56, 1, 0.02], [1, 0.6, 0.58, 1, 0, 1]] },
  square: { sx: 1.02, sy: 1, segs: [[0.7, -1, 1, -0.8, 1, -0.25], [1, 0.4, 0.94, 0.8, 0.52, 0.95], [0.26, 1.02, 0.1, 1, 0, 1]] },
  heart: { sx: 1.04, sy: 1, segs: [[0.74, -1, 1.04, -0.62, 1, -0.12], [0.96, 0.4, 0.46, 0.88, 0, 1]] },
  long: { sx: 0.92, sy: 1.08, segs: [[0.56, -1, 1, -0.56, 1, 0], [1, 0.62, 0.56, 1, 0, 1]] },
};

function headPath(ctx, hx, hy, shape) {
  const s = SHAPES[shape] || SHAPES.oval;
  const X = hx * s.sx, Y = hy * s.sy;
  ctx.beginPath();
  ctx.moveTo(0, -Y);
  for (const [a, b, c, d, e, f] of s.segs) ctx.bezierCurveTo(a * X, b * Y, c * X, d * Y, e * X, f * Y);
  // left half: walk the segments backwards with x mirrored
  const pts = [[0, -1], ...s.segs.map(g => [g[4], g[5]])];
  for (let i = s.segs.length - 1; i >= 0; i--) {
    const [a, b, c, d] = s.segs[i];
    const [px, py] = pts[i];
    ctx.bezierCurveTo(-c * X, d * Y, -a * X, b * Y, -px * X, py * Y);
  }
  ctx.closePath();
  return { X, Y };
}

// ---------- main entry ----------
export function drawAvatar(ctx, W, H, look, f, t = 0) {
  const L = { ...DEFAULT_LOOK, ...look };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawBackground(ctx, W, H, L);

  const s = (Math.min(W, H * 0.92) / 520) * L.zoom;
  ctx.translate(W / 2, H * (0.42 - L.posY * 0.12));
  ctx.scale(s, s);

  const OL = L.outline ? L.outlineWidth : 0;
  const ink = L.outline ? L.outlineColor : shade(L.skin, -0.62);
  const featInk = L.outline ? L.outlineColor : shade(L.skin, -0.66);

  const fillStroke = (fill, w = 1) => {
    ctx.fillStyle = fill;
    ctx.fill();
    if (OL) { ctx.lineWidth = OL * w; ctx.strokeStyle = ink; ctx.stroke(); }
  };
  const strokeOnly = (color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };

  const hx = 92 * L.faceWidth * (1 + f.cheekPuff * 0.05);
  const hy = 112 * L.faceLength;
  const yaw = clamp(f.yaw, -1, 1), pitch = clamp(f.pitch, -1, 1);
  const dx = d => yaw * hx * d;
  const dy = d => -pitch * hy * d * 0.8;
  const headTX = f.tx * 70, headTY = f.ty * 36;
  const S = hy + 46; // shoulder line, relative to head centre

  // The head tilts around the top of the neck, the body barely moves.
  const pivotY = hy * 0.85;
  const bodyRoll = f.roll * 0.12, bodyX = f.tx * 34, bodyY = f.ty * 14;
  const bodyGroup = fn => { ctx.save(); ctx.translate(bodyX, bodyY); ctx.rotate(bodyRoll); fn(); ctx.restore(); };
  const headGroup = fn => {
    ctx.save();
    ctx.translate(headTX, headTY + pivotY);
    ctx.rotate(f.roll);
    ctx.translate(0, -pivotY);
    fn();
    ctx.restore();
  };
  const headPt = (x, y) => {
    const c = Math.cos(f.roll), s2 = Math.sin(f.roll), py = y - pivotY;
    return [headTX + x * c - py * s2, headTY + pivotY + x * s2 + py * c];
  };
  const bodyPt = (x, y) => {
    const c = Math.cos(bodyRoll), s2 = Math.sin(bodyRoll);
    return [bodyX + x * c - y * s2, bodyY + x * s2 + y * c];
  };

  const build = { male: [1, 1.04], female: [0.84, 0.84], neutral: [0.92, 0.94] }[L.body] || [1, 1];
  const SW = 164 * build[0] * L.shoulders, NW = 31 * build[1] * L.neckWidth;
  const kit = { SW, NW, ctx, L, f, hx, hy, dx, dy, S, OL, ink, featInk, fillStroke, strokeOnly, t, headPt, bodyPt };

  if (L.top === 'hoodie') bodyGroup(() => drawHood(kit));
  headGroup(() => drawHairBack(kit));
  drawNeck(kit);
  bodyGroup(() => drawBody(kit));
  headGroup(() => drawHead(kit));

  ctx.restore();
}

// ---------- body ----------
function drawHood(k) {
  const { ctx, L, S, fillStroke } = k;
  const w = 104 * k.SW / 164;
  ctx.beginPath();
  ctx.ellipse(0, S - 10, w, 40, 0, Math.PI, TAU);
  ctx.lineTo(w, S + 30);
  ctx.lineTo(-w, S + 30);
  ctx.closePath();
  fillStroke(shade(L.topColor, -0.22));
}

// The neck joins two moving parts, so its corners are placed in world space:
// the top follows the head, the bottom follows the shoulders.
function drawNeck(k) {
  const { ctx, L, hy, S, fillStroke, headPt, bodyPt } = k;
  const nw = k.NW;
  const tl = headPt(-nw, hy * 0.45), tr = headPt(nw, hy * 0.45);
  const bl = bodyPt(-nw - 3, S + 60), br = bodyPt(nw + 3, S + 60);
  ctx.beginPath();
  ctx.moveTo(...tl);
  ctx.lineTo(...bl);
  ctx.lineTo(...br);
  ctx.lineTo(...tr);
  ctx.closePath();
  fillStroke(shade(L.skin, -0.07));
  // shadow under the chin, kept inside the neck
  ctx.save();
  ctx.clip();
  const [cx, cy] = headPt(0, hy * 0.98);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 40, 16, k.f.roll, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
  ctx.restore();
}

function drawBody(k) {
  const { ctx, L, S, fillStroke, OL, ink, SW } = k;
  const NW = k.NW + 1, B = 900;
  const taper = L.body === 'female' ? 0.86 : L.body === 'neutral' ? 0.94 : 1;
  const main = L.top === 'blazer' ? L.topColor2 : L.topColor;

  const torso = neckline => {
    ctx.beginPath();
    ctx.moveTo(-SW * taper, B);
    ctx.quadraticCurveTo(-SW * taper, S + 240, -SW, S + 74);
    ctx.bezierCurveTo(-SW, S + 18, -SW * 0.72, S, -SW * 0.36, S);
    neckline();
    ctx.lineTo(SW * 0.36, S);
    ctx.bezierCurveTo(SW * 0.72, S, SW, S + 18, SW, S + 74);
    ctx.quadraticCurveTo(SW * taper, S + 240, SW * taper, B);
    ctx.closePath();
  };
  const crew = () => { ctx.lineTo(-NW - 10, S); ctx.quadraticCurveTo(0, S + 30, NW + 10, S); };
  const vee = depth => () => { ctx.lineTo(-NW - 10, S); ctx.lineTo(0, S + depth); ctx.lineTo(NW + 10, S); };

  const scoop = () => { ctx.lineTo(-NW - 22, S); ctx.quadraticCurveTo(0, S + 70, NW + 22, S); };
  if (L.top === 'tank') {
    // bare shoulders: skin first, then the vest with straps
    torso(crew);
    fillStroke(shade(L.skin, -0.04));
    ctx.beginPath();
    ctx.moveTo(-SW * taper * 0.82, B);
    ctx.lineTo(-SW * 0.8, S + 90);
    ctx.lineTo(-SW * 0.55, S + 2);
    ctx.lineTo(-SW * 0.4, S + 2);
    ctx.quadraticCurveTo(0, S + 90, SW * 0.4, S + 2);
    ctx.lineTo(SW * 0.55, S + 2);
    ctx.lineTo(SW * 0.8, S + 90);
    ctx.lineTo(SW * taper * 0.82, B);
    ctx.closePath();
    fillStroke(main);
    return;
  }
  if (L.top === 'vneck' || L.top === 'collared') torso(vee(L.top === 'vneck' ? 54 : 34));
  else if (L.top === 'scoop') torso(scoop);
  else if (L.top === 'blazer') torso(vee(40));
  else torso(crew);
  fillStroke(main);

  // a soft fold shadow down each side
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(-SW, S + 60, 26, B);
  ctx.fillRect(SW - 26, S + 60, 26, B);
  ctx.restore();

  if (L.top === 'turtleneck') {
    ctx.beginPath();
    ctx.roundRect(-NW - 8, S - 46, (NW + 8) * 2, 64, 10);
    fillStroke(shade(main, -0.08));
    for (const y of [S - 30, S - 14]) {
      ctx.beginPath(); ctx.moveTo(-NW - 4, y); ctx.lineTo(NW + 4, y);
      ctx.strokeStyle = shade(main, -0.3); ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
  if (L.top === 'tee') {
    ctx.beginPath();
    ctx.moveTo(-NW - 10, S);
    ctx.quadraticCurveTo(0, S + 30, NW + 10, S);
    ctx.strokeStyle = shade(main, -0.25);
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  if (L.top === 'hoodie') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 16, S + 16);
      ctx.lineTo(sx * 20, S + 78);
      ctx.strokeStyle = L.topColor2;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx * 20, S + 82, 5, 0, TAU);
      fillStroke(L.topColor2, 0.6);
    }
    ctx.beginPath();
    ctx.roundRect(-70, S + 140, 140, 80, 18);
    ctx.strokeStyle = shade(main, -0.22);
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (L.top === 'collared') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * (NW + 12), S - 6);
      ctx.lineTo(sx * 3, S + 34);
      ctx.lineTo(sx * (NW + 30), S + 26);
      ctx.closePath();
      fillStroke(L.topColor2, 0.8);
    }
    for (const y of [S + 54, S + 92, S + 130]) {
      ctx.beginPath();
      ctx.arc(0, y, 3.6, 0, TAU);
      ctx.fillStyle = shade(main, -0.35);
      ctx.fill();
    }
  }
  if (L.top === 'blazer') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * SW, B);
      ctx.lineTo(sx * SW, S + 74);
      ctx.bezierCurveTo(sx * SW, S + 18, sx * SW * 0.72, S, sx * SW * 0.36, S);
      ctx.lineTo(sx * (NW + 10), S);
      ctx.lineTo(sx * (NW + 2), S + 30);
      ctx.lineTo(sx * (NW + 22), S + 52);
      ctx.lineTo(sx * 8, S + 150);
      ctx.lineTo(sx * 8, B);
      ctx.closePath();
      fillStroke(L.topColor);
    }
    ctx.beginPath();
    ctx.arc(-16, S + 176, 4.5, 0, TAU);
    fillStroke(shade(L.topColor, 0.25), 0.6);
  }
  if (L.body === 'female' && !['blazer', 'hoodie'].includes(L.top)) {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * SW * 0.36, S + 128, SW * 0.24, Math.PI * (sx < 0 ? 0.3 : 0.45), Math.PI * (sx < 0 ? 0.55 : 0.7));
      ctx.strokeStyle = shade(main, -0.22);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  if (!OL) return;
  ctx.strokeStyle = ink;
}

// ---------- head and face ----------
function drawHead(k) {
  const { ctx, L, f, hx, hy, dx, dy, fillStroke, featInk } = k;
  const yaw = clamp(f.yaw, -1, 1);
  const eyeY = -6 + L.eyeHeight * 12;

  // ears sit behind the head and slide opposite to the turn
  if (L.ears) {
    for (const side of [-1, 1]) {
      const ex = side * hx * 0.96 - dx(0.16);
      const ey = eyeY + 8;
      const z = L.earSize;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 13 * z, 20 * z, side * 0.12, 0, TAU);
      fillStroke(L.skin);
      ctx.beginPath();
      ctx.ellipse(ex + side * 1.5, ey + 1, 6.5 * z, 12 * z, side * 0.12, 0, TAU);
      ctx.fillStyle = shade(L.skin, -0.16);
      ctx.fill();
    }
  }

  // head shape
  ctx.save();
  ctx.translate(dx(0.035), 0);
  ctx.scale(1 - Math.abs(yaw) * 0.05, 1);
  const { X, Y } = headPath(ctx, hx, hy, L.faceShape);
  ctx.fillStyle = L.skin;
  ctx.fill();
  if (L.shading) {
    ctx.save();
    ctx.clip();
    const lightSide = 0.25 - yaw * 0.35;
    const g = ctx.createLinearGradient(-X, 0, X, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(clamp(0.6 + lightSide * 0.2, 0.3, 0.9), 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(-X * 1.2, -Y * 1.2, X * 2.4, Y * 2.4);
    ctx.restore();
  }
  if (k.OL) { ctx.lineWidth = k.OL; ctx.strokeStyle = k.ink; ctx.stroke(); }
  ctx.restore();

  // cheeks: blush, freckles
  const eyeGap = 34 * L.eyeSpacing * (1 - Math.abs(yaw) * 0.12);
  const noseY = eyeY + 30 * L.faceLength;
  const smile = (f.smileL + f.smileR) / 2;
  if (L.blush || f.cheekPuff > 0.05) {
    for (const side of [-1, 1]) {
      const bx = side * (eyeGap + 6) + dx(0.18), by = eyeY + 26 + dy(0.18) - smile * 3;
      const r = 17 + f.cheekPuff * 6;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      const a = (L.blush ? 0.42 + smile * 0.12 : 0) + f.cheekPuff * 0.2;
      g.addColorStop(0, rgba(L.blush ? L.blushColor : '#e07a7a', clamp(a, 0, 0.7)));
      g.addColorStop(1, rgba(L.blush ? L.blushColor : '#e07a7a', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.fill();
    }
  }
  if (L.freckles) {
    ctx.fillStyle = rgba('#000000', luminance(L.skin) > 0.5 ? 0.22 : 0.3);
    const dots = [[16, 8], [24, 4], [21, 14], [31, 11], [13, 17], [28, 18], [36, 5]];
    for (const side of [-1, 1]) for (const [x, y] of dots) {
      ctx.beginPath();
      ctx.arc(side * x + dx(0.26), noseY - 8 + y + dy(0.26), 1.7, 0, TAU);
      ctx.fill();
    }
  }

  // age: smile lines, eye creases and forehead lines
  if (L.age === 'older') {
    ctx.strokeStyle = rgba(shade(L.skin, -0.5), 0.55);
    ctx.lineWidth = 2.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 22 + dx(0.3), noseY + 4 + dy(0.3));
      ctx.quadraticCurveTo(side * (36 + smile * 4) + dx(0.25), noseY + 22, side * 32 + dx(0.22), noseY + 40 + dy(0.2));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(side * eyeGap + dx(0.22), eyeY + 10 + dy(0.22), 9 * L.eyeSize, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
    for (const j of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(-30 + dx(0.15), -hy * 0.46 + j * 9 + dy(0.15));
      ctx.quadraticCurveTo(dx(0.15), -hy * 0.5 + j * 9, 30 + dx(0.15), -hy * 0.46 + j * 9 + dy(0.15));
      ctx.stroke();
    }
  }
  if (L.beautyMark !== 'none') {
    const [bx, by] = L.beautyMark === 'lip' ? [18, 46 * L.faceLength - 8] : [-eyeGap - 4, eyeY + 34];
    ctx.beginPath();
    ctx.arc(bx + dx(0.24), by + dy(0.22), 2.6, 0, TAU);
    ctx.fillStyle = shade(L.skin, -0.6);
    ctx.fill();
  }

  drawFacialHair(k, eyeY);

  // eyes
  const eyeSx = side => 1 - Math.max(0, side * yaw) * 0.38 + Math.max(0, -side * yaw) * 0.05;
  const open = side => {
    const b = side < 0 ? f.blinkL : f.blinkR;
    const w = side < 0 ? f.wideL : f.wideR;
    const sq = side < 0 ? f.squintL : f.squintR;
    return 1 - b + w * 0.28 - sq * 0.3 - smile * 0.12;
  };
  const eyeYs = eyeY + dy(0.22);
  for (const side of [-1, 1]) {
    const ex = side * eyeGap + dx(0.22);
    if (L.eyeshadow) {
      const g = ctx.createRadialGradient(ex, eyeYs - 6, 0, ex, eyeYs - 6, 22 * L.eyeSize);
      g.addColorStop(0, rgba(L.eyeshadowColor, 0.55));
      g.addColorStop(1, rgba(L.eyeshadowColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex, eyeYs - 6, 22 * L.eyeSize * eyeSx(side), 16 * L.eyeSize, 0, 0, TAU);
      ctx.fill();
    }
    drawEye(k, ex, eyeYs, side, open(side), eyeSx(side));
    if (L.eyeliner && open(side) > 0.16) {
      const ew = 15 * L.eyeSize * eyeSx(side);
      ctx.beginPath();
      ctx.moveTo(ex - side * ew * 0.6, eyeYs - 9 * L.eyeSize);
      ctx.quadraticCurveTo(ex + side * ew * 0.6, eyeYs - 10 * L.eyeSize, ex + side * (ew + 7), eyeYs - 14 * L.eyeSize);
      ctx.strokeStyle = featInk;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // brows
  if (L.browStyle !== 'none') {
    const eh = { round: 13, almond: 9.5, anime: 17, sleepy: 9, dot: 8 }[L.eyeStyle] * L.eyeSize;
    const by = eyeY - eh - 11 + dy(0.2);
    for (const side of [-1, 1]) {
      const bx = side * eyeGap + dx(0.2);
      drawBrow(k, bx, by, side, eyeSx(side));
    }
  }

  drawNose(k, dx(0.32), noseY + dy(0.32));
  const mouthY = 46 * L.faceLength + 4 + dy(0.2);
  drawMouth(k, dx(0.2) + f.mouthX * 7, mouthY);
  if (['mustache', 'goatee'].includes(L.facialHair)) drawMustache(k, dx(0.22) + f.mouthX * 7, mouthY);

  drawHairFront(k, eyeY);
  drawGlasses(k, eyeGap, eyeYs, eyeSx);
  drawHeadwear(k, eyeY);
  drawEarrings(k, eyeY);
}

function eyeShape(ctx, x, y, w, h, style) {
  ctx.beginPath();
  if (style === 'almond' || style === 'sleepy') {
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - h * 2, x + w, y);
    ctx.quadraticCurveTo(x, y + h * 1.55, x - w, y);
    ctx.closePath();
  } else {
    ctx.ellipse(x, y, w, h, 0, 0, TAU);
  }
}

function drawEye(k, x, y, side, open, sx) {
  const { ctx, L, f, featInk, OL } = k;
  const st = L.eyeStyle, z = L.eyeSize;
  const geo = { round: [13, 13], almond: [16, 9.5], anime: [13, 17], sleepy: [15, 9], dot: [5.5, 7.5] }[st] || [13, 13];
  const w = geo[0] * z * sx, h = geo[1] * z;
  const o = clamp(open, 0, 1.3);
  const lw = 3 * z;

  if (o < 0.16) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + h * 0.55, x + w, y);
    ctx.strokeStyle = featInk;
    ctx.lineWidth = lw;
    ctx.stroke();
    if (L.lashes) drawLashes(k, x, y, w, h * 0.2, side, z, true);
    return;
  }
  const hh = h * o;
  if (st === 'dot') {
    ctx.beginPath();
    ctx.ellipse(x + f.lookX * 2.5, y + f.lookY * 2.5, w, hh, 0, 0, TAU);
    ctx.fillStyle = featInk;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + f.lookX * 2.5 - w * 0.35, y - hh * 0.4, 1.6 * z, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (L.lashes) drawLashes(k, x, y - hh, w, hh, side, z, false);
    return;
  }

  eyeShape(ctx, x, y, w, hh, st);
  ctx.fillStyle = '#fbfaf6';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const ix = x + f.lookX * w * 0.42;
  const iy = y + f.lookY * h * 0.32;
  if (st === 'anime') {
    const g = ctx.createLinearGradient(0, iy - h * 0.8, 0, iy + h * 0.8);
    g.addColorStop(0, shade(L.irisColor, -0.45));
    g.addColorStop(1, shade(L.irisColor, 0.25));
    ctx.beginPath();
    ctx.ellipse(ix, iy, w * 0.68, h * 0.78, 0, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(ix, iy + 1, w * 0.32, h * 0.4, 0, 0, TAU);
    ctx.fillStyle = '#0b0b10';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(ix - w * 0.28, iy - h * 0.34, w * 0.2, h * 0.16, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ix + w * 0.26, iy + h * 0.3, w * 0.09, 0, TAU); ctx.fill();
  } else {
    const ir = (st === 'round' ? 0.62 : 0.78) * h;
    ctx.beginPath();
    ctx.arc(ix, iy, ir, 0, TAU);
    ctx.fillStyle = L.irisColor;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = shade(L.irisColor, -0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, ir * 0.48, 0, TAU);
    ctx.fillStyle = '#0b0b10';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix - ir * 0.36, iy - ir * 0.38, ir * 0.24, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  if (st === 'sleepy') {
    ctx.fillStyle = shade(L.skin, -0.06);
    ctx.fillRect(x - w * 1.2, y - h * 1.4, w * 2.4, h * 0.95);
    ctx.beginPath();
    ctx.moveTo(x - w, y - h * 0.42);
    ctx.quadraticCurveTo(x, y - h * 0.62, x + w, y - h * 0.42);
    ctx.strokeStyle = featInk;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }
  ctx.restore();

  // lid line along the top edge
  ctx.beginPath();
  if (st === 'almond' || st === 'sleepy') {
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - hh * 2, x + w, y);
  } else {
    ctx.ellipse(x, y, w, hh, 0, Math.PI * 1.04, Math.PI * 1.96);
  }
  ctx.strokeStyle = featInk;
  ctx.lineWidth = st === 'anime' ? lw * 1.5 : lw;
  ctx.stroke();
  if (OL) {
    eyeShape(ctx, x, y, w, hh, st);
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  if (L.lashes || st === 'anime') drawLashes(k, x, y - (st === 'almond' || st === 'sleepy' ? hh * 0.2 : hh * 0.7), w, hh, side, z, false);
}

function drawLashes(k, x, y, w, h, side, z, closed) {
  const { ctx, featInk } = k;
  ctx.strokeStyle = featInk;
  ctx.lineWidth = 2.2 * z;
  const ox = x + side * w * 0.92;
  for (let i = 0; i < 3; i++) {
    const a = (closed ? 0.35 : -0.55) - i * 0.32;
    const sx = ox - side * i * w * 0.18;
    const sy = y + (closed ? 1 : i * 1.2);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + side * Math.cos(a) * 7 * z, sy + Math.sin(a) * 7 * z);
    ctx.stroke();
  }
}

function drawBrow(k, x, y, side, sx) {
  const { ctx, L, f } = k;
  const z = L.eyeSize;
  const inner = f.browInner, outer = side < 0 ? f.browOuterL : f.browOuterR;
  const down = side < 0 ? f.browDownL : f.browDownR;
  const ix = x - side * 13 * z * sx, ox = x + side * 17 * z * sx;
  const iy = y - inner * 12 + down * 7;
  const oy = y + 2 - outer * 9 - inner * 3 + down * 2;
  const arch = { soft: 6, arched: 12, straight: 1.5, thick: 5, thin: 7 }[L.browStyle] ?? 6;
  const wdt = { soft: 5, arched: 4.6, straight: 6, thick: 9.5, thin: 2.6 }[L.browStyle] ?? 5;
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - arch + down * 2, ox, oy);
  ctx.strokeStyle = L.browColor;
  ctx.lineWidth = wdt * L.browThickness;
  ctx.stroke();
  if (L.browStyle === 'thick') {
    ctx.lineWidth = wdt * L.browThickness * 0.6;
    ctx.beginPath();
    ctx.moveTo(ix, iy + 2.5);
    ctx.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - arch + 4, ox - side * 3, oy + 1);
    ctx.stroke();
  }
}

function drawNose(k, x, y) {
  const { ctx, L, featInk, OL, ink } = k;
  const z = L.noseSize;
  switch (L.noseStyle) {
    case 'button':
      ctx.beginPath();
      ctx.ellipse(x, y, 9 * z, 6.5 * z, 0, 0, TAU);
      ctx.fillStyle = shade(L.skin, -0.14);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - 2.5 * z, y - 2 * z, 3 * z, 2 * z, 0, 0, TAU);
      ctx.fillStyle = rgba('#ffffff', 0.28);
      ctx.fill();
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 18 * z);
      ctx.quadraticCurveTo(x + 7 * z, y - 2 * z, x + 4 * z, y + 4 * z);
      ctx.quadraticCurveTo(x - 2 * z, y + 7 * z, x - 6 * z, y + 3 * z);
      ctx.strokeStyle = featInk;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      break;
    case 'nostrils':
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sd * 5 * z, y + 2, 2.6 * z, 1.8 * z, sd * 0.4, 0, TAU);
        ctx.fillStyle = featInk;
        ctx.fill();
      }
      break;
    case 'wide':
      ctx.beginPath();
      ctx.moveTo(x - 13 * z, y + 2 * z);
      ctx.quadraticCurveTo(x - 15 * z, y - 7 * z, x - 6 * z, y - 6 * z);
      ctx.quadraticCurveTo(x, y - 14 * z, x + 6 * z, y - 6 * z);
      ctx.quadraticCurveTo(x + 15 * z, y - 7 * z, x + 13 * z, y + 2 * z);
      ctx.quadraticCurveTo(x, y + 9 * z, x - 13 * z, y + 2 * z);
      ctx.fillStyle = shade(L.skin, -0.1);
      ctx.fill();
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sd * 6 * z, y + 1.5 * z, 2.6 * z, 1.8 * z, sd * 0.3, 0, TAU);
        ctx.fillStyle = shade(L.skin, -0.5);
        ctx.fill();
      }
      if (OL) { ctx.beginPath(); ctx.moveTo(x - 13 * z, y + 2 * z); ctx.quadraticCurveTo(x, y + 9 * z, x + 13 * z, y + 2 * z); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke(); }
      break;
    default:
  }
}

function drawMouth(k, x, y) {
  const { ctx, L, f, featInk, OL, ink } = k;
  const smileL = f.smileL, smileR = f.smileR;
  const smile = (smileL + smileR) / 2;
  const W = 21 * L.mouthWidth * (1 + smile * 0.28 - f.pucker * 0.42 - f.funnel * 0.25);
  const H = f.jaw * 30 + f.funnel * 8;
  const lyL = y - smileL * 10 + f.frown * 7;
  const lyR = y - smileR * 10 + f.frown * 7;
  const lx = x - W, rx = x + W;
  const lipCol = L.mouthStyle === 'lips' ? L.lipColor : featInk;
  const lw = L.mouthStyle === 'bold' ? 4.4 : 3.2;

  // puckered / "oo" mouth
  if (f.pucker > 0.45 && H < 10) {
    const r = 6 + f.pucker * 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.9, r * 1.05, 0, 0, TAU);
    ctx.fillStyle = L.mouthStyle === 'lips' ? L.lipColor : shade(L.skin, -0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.38, r * 0.5, 0, 0, TAU);
    ctx.fillStyle = '#3d151b';
    ctx.fill();
    if (OL) { ctx.beginPath(); ctx.ellipse(x, y + 2, r * 0.9, r * 1.05, 0, 0, TAU); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke(); }
    return;
  }

  if (H < 2.5) {
    // closed mouth
    const cy = y + 3 + smile * 9 - f.frown * 9;
    if (L.mouthStyle === 'lips') {
      ctx.beginPath();
      ctx.moveTo(lx, lyL);
      ctx.quadraticCurveTo(x, cy + 2, rx, lyR);
      ctx.quadraticCurveTo(x, cy + 15, lx, lyL);
      ctx.fillStyle = L.lipColor;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(lx + 3, lyL - 0.5);
      ctx.quadraticCurveTo(x - W * 0.5, y - 5, x, cy - 3);
      ctx.quadraticCurveTo(x + W * 0.5, y - 5, rx - 3, lyR - 0.5);
      ctx.quadraticCurveTo(x, cy + 2, lx + 3, lyL - 0.5);
      ctx.fillStyle = shade(L.lipColor, -0.12);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(lx, lyL);
    ctx.quadraticCurveTo(x, cy, rx, lyR);
    ctx.strokeStyle = L.mouthStyle === 'lips' ? shade(L.lipColor, -0.55) : featInk;
    ctx.lineWidth = lw;
    ctx.stroke();
    return;
  }

  // open mouth
  const topY = (lyL + lyR) / 2 - 2 - H * 0.12 + smile * 3;
  const botY = (lyL + lyR) / 2 + H * 1.55 + smile * 6;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(lx, lyL);
    ctx.quadraticCurveTo(x, topY, rx, lyR);
    ctx.quadraticCurveTo(x, botY, lx, lyL);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = '#4a1820';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // tongue and top teeth
  ctx.beginPath();
  ctx.ellipse(x, (lyL + lyR) / 2 + H * 0.95, W * 0.62, H * 0.45 + 2, 0, 0, TAU);
  ctx.fillStyle = '#d9636f';
  ctx.fill();
  if (H > 7) {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(x - W, Math.min(lyL, lyR) - 12, W * 2, (topY - Math.min(lyL, lyR)) / 2 + 17);
  }
  ctx.restore();
  path();
  if (L.mouthStyle === 'lips') {
    ctx.strokeStyle = L.lipColor;
    ctx.lineWidth = 5.5;
    ctx.stroke();
    path();
  }
  ctx.strokeStyle = L.mouthStyle === 'lips' ? shade(lipCol, -0.5) : featInk;
  ctx.lineWidth = L.mouthStyle === 'lips' ? 1.8 : lw;
  ctx.stroke();
}

function drawFacialHair(k, eyeY) {
  const { ctx, L, f, hx, hy, fillStroke } = k;
  const c = L.facialHairColor;
  const my = 46 * L.faceLength + 4;
  const jaw = f.jaw * 12;
  switch (L.facialHair) {
    case 'stubble': {
      ctx.save();
      headPath(ctx, hx, hy, L.faceShape);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-hx * 1.1, eyeY + 26);
      ctx.bezierCurveTo(-hx * 0.8, my + 4, -hx * 0.45, my - 16, 0, my - 15);
      ctx.bezierCurveTo(hx * 0.45, my - 16, hx * 0.8, my + 4, hx * 1.1, eyeY + 26);
      ctx.lineTo(hx * 1.1, hy * 1.3);
      ctx.lineTo(-hx * 1.1, hy * 1.3);
      ctx.closePath();
      ctx.fillStyle = rgba(c, 0.2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'beard':
      ctx.beginPath();
      ctx.moveTo(-hx * 1.0, eyeY + 6);
      ctx.bezierCurveTo(-hx * 1.04, hy * 0.62, -hx * 0.62, hy * 1.16 + jaw, 0, hy * 1.2 + jaw);
      ctx.bezierCurveTo(hx * 0.62, hy * 1.16 + jaw, hx * 1.04, hy * 0.62, hx * 1.0, eyeY + 6);
      ctx.lineTo(hx * 0.84, eyeY + 6);
      ctx.bezierCurveTo(hx * 0.8, my - 4, hx * 0.5, my - 22, 0, my - 17);
      ctx.bezierCurveTo(-hx * 0.5, my - 22, -hx * 0.8, my - 4, -hx * 0.84, eyeY + 6);
      ctx.closePath();
      fillStroke(c);
      break;
    case 'chinstrap':
      ctx.beginPath();
      ctx.moveTo(-hx * 1.0, eyeY + 6);
      ctx.bezierCurveTo(-hx * 1.02, hy * 0.62, -hx * 0.62, hy * 1.08 + jaw, 0, hy * 1.1 + jaw);
      ctx.bezierCurveTo(hx * 0.62, hy * 1.08 + jaw, hx * 1.02, hy * 0.62, hx * 1.0, eyeY + 6);
      ctx.lineTo(hx * 0.88, eyeY + 6);
      ctx.bezierCurveTo(hx * 0.88, hy * 0.6, hx * 0.5, hy * 0.92 + jaw, 0, hy * 0.94 + jaw);
      ctx.bezierCurveTo(-hx * 0.5, hy * 0.92 + jaw, -hx * 0.88, hy * 0.6, -hx * 0.88, eyeY + 6);
      ctx.closePath();
      fillStroke(c);
      break;
    case 'goatee':
      ctx.beginPath();
      ctx.moveTo(-hx * 0.3, my + 10 + jaw);
      ctx.quadraticCurveTo(-hx * 0.3, hy * 1.1 + jaw, 0, hy * 1.14 + jaw);
      ctx.quadraticCurveTo(hx * 0.3, hy * 1.1 + jaw, hx * 0.3, my + 10 + jaw);
      ctx.quadraticCurveTo(0, my + 20 + jaw, -hx * 0.3, my + 10 + jaw);
      fillStroke(c);
      break;
    default:
  }
}

function drawMustache(k, x, y) {
  const { ctx, L, f, fillStroke } = k;
  const sm = (f.smileL + f.smileR) / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.bezierCurveTo(x - 14, y - 18, x - 30, y - 12 - sm * 4, x - 28, y - 1 - sm * 8);
  ctx.bezierCurveTo(x - 20, y - 6, x - 8, y - 6, x, y - 7);
  ctx.bezierCurveTo(x + 8, y - 6, x + 20, y - 6, x + 28, y - 1 - sm * 8);
  ctx.bezierCurveTo(x + 30, y - 12 - sm * 4, x + 14, y - 18, x, y - 12);
  ctx.closePath();
  fillStroke(L.facialHairColor, 0.8);
}

// ---------- hair ----------
function shell(k, o) {
  const { ctx, hx, hy } = k;
  const W = hx * o.side, T = hy * (1 + o.top), part = o.partX || 0;
  ctx.beginPath();
  ctx.moveTo(-W, o.sideY);
  ctx.bezierCurveTo(-W, -hy * 0.72, -W * 0.62, -T, 0, -T);
  ctx.bezierCurveTo(W * 0.62, -T, W, -hy * 0.72, W, o.sideY);
  ctx.lineTo(W * 0.84, o.sideY);
  ctx.bezierCurveTo(W * 0.84, -hy * 0.18, W * 0.5, o.hairline + o.dip, part, o.hairline);
  ctx.bezierCurveTo(-W * 0.5, o.hairline + o.dip, -W * 0.84, -hy * 0.18, -W * 0.84, o.sideY);
  ctx.closePath();
}

function scallop(ctx, cx, cy, rx, ry, n, amp, start = -Math.PI / 2, end = start + TAU) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * (end - start);
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const am = start + ((i - 0.5) / n) * (end - start);
      const c = 1 + amp * 2.2;
      ctx.quadraticCurveTo(cx + Math.cos(am) * rx * c, cy + Math.sin(am) * ry * c, x, y);
    }
  }
  ctx.closePath();
}

function hairShine(k) {
  const { ctx, hx, hy, L } = k;
  ctx.beginPath();
  ctx.moveTo(-hx * 0.5, -hy * 0.86);
  ctx.quadraticCurveTo(-hx * 0.15, -hy * 1.02, hx * 0.2, -hy * 0.98);
  ctx.strokeStyle = rgba('#ffffff', luminance(L.hairColor) > 0.6 ? 0.35 : 0.16);
  ctx.lineWidth = 6;
  ctx.stroke();
}

function drawHairBack(k) {
  const { ctx, L, hx, hy, fillStroke, dx } = k;
  const c = L.hairColor;
  const back = dx(-0.1);
  ctx.save();
  ctx.translate(back, 0);
  switch (L.hairStyle) {
    case 'afro':
      scallop(ctx, 0, -hy * 0.26, hx * 1.48, hy * 1.08, 22, 0.07);
      fillStroke(c);
      break;
    case 'curly':
      scallop(ctx, 0, -hy * 0.3, hx * 1.2, hy * 0.98, 16, 0.08);
      fillStroke(c);
      break;
    case 'bob':
      ctx.beginPath();
      ctx.moveTo(-hx * 1.18, -hy * 0.2);
      ctx.bezierCurveTo(-hx * 1.18, -hy * 0.95, -hx * 0.7, -hy * 1.14, 0, -hy * 1.14);
      ctx.bezierCurveTo(hx * 0.7, -hy * 1.14, hx * 1.18, -hy * 0.95, hx * 1.18, -hy * 0.2);
      ctx.lineTo(hx * 1.16, hy * 0.62);
      ctx.quadraticCurveTo(hx * 1.12, hy * 0.76, hx * 0.92, hy * 0.74);
      ctx.lineTo(-hx * 0.92, hy * 0.74);
      ctx.quadraticCurveTo(-hx * 1.12, hy * 0.76, -hx * 1.16, hy * 0.62);
      ctx.closePath();
      fillStroke(c);
      break;
    case 'long':
      ctx.beginPath();
      ctx.moveTo(-hx * 1.16, -hy * 0.2);
      ctx.bezierCurveTo(-hx * 1.16, -hy * 0.95, -hx * 0.7, -hy * 1.12, 0, -hy * 1.12);
      ctx.bezierCurveTo(hx * 0.7, -hy * 1.12, hx * 1.16, -hy * 0.95, hx * 1.16, -hy * 0.2);
      ctx.bezierCurveTo(hx * 1.3, hy * 0.8, hx * 1.36, hy * 1.6, hx * 1.2, hy * 2.1);
      ctx.quadraticCurveTo(hx * 0.9, hy * 2.25, hx * 0.6, hy * 2.05);
      ctx.lineTo(-hx * 0.6, hy * 2.05);
      ctx.quadraticCurveTo(-hx * 0.9, hy * 2.25, -hx * 1.2, hy * 2.1);
      ctx.bezierCurveTo(-hx * 1.36, hy * 1.6, -hx * 1.3, hy * 0.8, -hx * 1.16, -hy * 0.2);
      ctx.closePath();
      fillStroke(c);
      break;
    case 'locs': {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) * 2 - 1;
        const x = u * hx * 1.08;
        const len = hy * (1.55 + ((i * 37) % 7) / 18) - Math.abs(u) * hy * 0.2;
        ctx.beginPath();
        ctx.roundRect(x - hx * 0.09, -hy * 0.75, hx * 0.18, len, hx * 0.09);
        fillStroke(i % 2 ? shade(c, 0.08) : c, 0.8);
      }
      break;
    }
    case 'bun':
      ctx.beginPath();
      ctx.arc(0, -hy * 1.12, hx * 0.38, 0, TAU);
      fillStroke(c);
      ctx.beginPath();
      ctx.arc(-hx * 0.1, -hy * 1.18, hx * 0.2, Math.PI * 1.1, Math.PI * 1.7);
      ctx.strokeStyle = rgba('#ffffff', 0.15);
      ctx.lineWidth = 5;
      ctx.stroke();
      break;
    case 'wavy': {
      ctx.beginPath();
      ctx.moveTo(-hx * 1.16, -hy * 0.2);
      ctx.bezierCurveTo(-hx * 1.16, -hy * 0.95, -hx * 0.7, -hy * 1.12, 0, -hy * 1.12);
      ctx.bezierCurveTo(hx * 0.7, -hy * 1.12, hx * 1.16, -hy * 0.95, hx * 1.16, -hy * 0.2);
      for (let i = 1; i <= 5; i++) ctx.quadraticCurveTo(hx * (i % 2 ? 1.38 : 1.12), hy * (-0.2 + (i - 0.5) * 0.42), hx * 1.2, hy * (-0.2 + i * 0.42));
      ctx.quadraticCurveTo(0, hy * 2.3, -hx * 1.2, hy * 1.9);
      for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(-hx * (i % 2 ? 1.12 : 1.38), hy * (-0.2 + (i + 0.5) * 0.42), -hx * (i ? 1.2 : 1.16), hy * (-0.2 + i * 0.42));
      ctx.closePath();
      fillStroke(c);
      break;
    }
    case 'braids':
      for (const sd of [-1, 1]) {
        for (let j = 0; j < 7; j++) {
          ctx.beginPath();
          ctx.ellipse(sd * hx * 1.0, hy * (0.1 + j * 0.24), hx * 0.15 - j * 0.6, hy * 0.15, sd * 0.25, 0, TAU);
          fillStroke(j % 2 ? shade(c, 0.1) : c, 0.7);
        }
      }
      break;
    case 'puffs':
      for (const sd of [-1, 1]) {
        scallop(ctx, sd * hx * 0.78, -hy * 0.98, hx * 0.42, hy * 0.36, 11, 0.08);
        fillStroke(c);
      }
      break;
    case 'ponytail':
      ctx.beginPath();
      ctx.moveTo(hx * 0.55, -hy * 0.7);
      ctx.bezierCurveTo(hx * 1.55, -hy * 0.6, hx * 1.55, hy * 0.4, hx * 1.28, hy * 1.05);
      ctx.bezierCurveTo(hx * 1.2, hy * 0.5, hx * 1.0, hy * 0.1, hx * 0.7, -hy * 0.1);
      ctx.closePath();
      fillStroke(c);
      break;
    default:
  }
  ctx.restore();
}

function drawHairFront(k, eyeY) {
  const { ctx, L, hx, hy, fillStroke, dx } = k;
  const c = L.hairColor;
  if (L.hairStyle === 'none') return;
  ctx.save();
  ctx.translate(dx(0.06), 0);
  switch (L.hairStyle) {
    case 'buzz':
      shell(k, { side: 1.02, top: 0.02, sideY: eyeY - 14, hairline: -hy * 0.54, dip: 6 });
      ctx.globalAlpha = 0.9;
      fillStroke(c, 0.8);
      break;
    case 'short':
      shell(k, { side: 1.06, top: 0.12, sideY: eyeY - 2, hairline: -hy * 0.46, dip: 16 });
      fillStroke(c);
      hairShine(k);
      break;
    case 'sidepart':
      shell(k, { side: 1.07, top: 0.16, sideY: eyeY - 2, hairline: -hy * 0.46, dip: 10, partX: -hx * 0.36 });
      fillStroke(c);
      ctx.beginPath();
      ctx.moveTo(-hx * 0.36, -hy * 0.98);
      ctx.bezierCurveTo(hx * 0.2, -hy * 1.06, hx * 0.92, -hy * 0.82, hx * 0.98, -hy * 0.14);
      ctx.bezierCurveTo(hx * 0.7, -hy * 0.44, hx * 0.1, -hy * 0.42, -hx * 0.36, -hy * 0.46);
      ctx.closePath();
      fillStroke(shade(c, 0.06));
      hairShine(k);
      break;
    case 'afro':
      scallop(ctx, 0, -hy * 0.6, hx * 1.04, hy * 0.5, 12, 0.07, Math.PI * 0.98, Math.PI * 2.02);
      fillStroke(c);
      break;
    case 'curly': {
      shell(k, { side: 1.06, top: 0.14, sideY: eyeY - 4, hairline: -hy * 0.5, dip: 12 });
      fillStroke(c);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) * 2 - 1;
        ctx.beginPath();
        ctx.arc(u * hx * 0.72, -hy * 0.5 + Math.abs(u) * hy * 0.12 + 6, hx * 0.15, 0, TAU);
        fillStroke(i % 2 ? shade(c, 0.07) : c, 0.8);
      }
      break;
    }
    case 'locs':
      shell(k, { side: 1.08, top: 0.15, sideY: eyeY - 4, hairline: -hy * 0.5, dip: 12 });
      fillStroke(c);
      for (const sd of [-1, 1]) {
        for (const j of [0, 1]) {
          ctx.beginPath();
          ctx.roundRect(sd * hx * (0.9 - j * 0.16) - hx * 0.08, -hy * 0.45, hx * 0.16, hy * (0.95 - j * 0.25), hx * 0.08);
          fillStroke(j ? shade(c, 0.08) : c, 0.8);
        }
      }
      break;
    case 'bob':
      shell(k, { side: 1.12, top: 0.12, sideY: hy * 0.36, hairline: -hy * 0.32, dip: -4 });
      fillStroke(c);
      hairShine(k);
      break;
    case 'long':
      shell(k, { side: 1.1, top: 0.1, sideY: hy * 0.5, hairline: -hy * 0.56, dip: 30 });
      fillStroke(c);
      hairShine(k);
      break;
    case 'pixie':
      shell(k, { side: 1.04, top: 0.1, sideY: eyeY - 8, hairline: -hy * 0.5, dip: 8 });
      fillStroke(c);
      ctx.beginPath();
      ctx.moveTo(-hx * 0.9, -hy * 0.7);
      ctx.bezierCurveTo(-hx * 0.2, -hy * 1.0, hx * 0.6, -hy * 0.7, hx * 0.95, -hy * 0.15);
      ctx.bezierCurveTo(hx * 0.4, -hy * 0.42, -hx * 0.2, -hy * 0.36, -hx * 0.9, -hy * 0.7);
      ctx.closePath();
      fillStroke(shade(c, 0.07));
      hairShine(k);
      break;
    case 'wavy':
      shell(k, { side: 1.1, top: 0.1, sideY: hy * 0.5, hairline: -hy * 0.56, dip: 30 });
      fillStroke(c);
      hairShine(k);
      break;
    case 'braids':
    case 'puffs':
    case 'bun':
    case 'ponytail':
      shell(k, { side: 1.04, top: 0.06, sideY: eyeY - 10, hairline: -hy * 0.52, dip: 10 });
      fillStroke(c);
      hairShine(k);
      break;
    case 'mohawk':
      shell(k, { side: 1.02, top: 0.02, sideY: eyeY - 14, hairline: -hy * 0.54, dip: 6 });
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = c;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-hx * 0.2, -hy * 0.55);
      for (let i = 0; i <= 5; i++) {
        const u = i / 5;
        const x = -hx * 0.2 + u * hx * 0.4;
        const a = Math.PI * (1.15 + u * 0.7);
        ctx.lineTo(x + Math.cos(a) * hy * 0.05, -hy * 1.0 - Math.sin(u * Math.PI) * hy * 0.42);
        if (i < 5) ctx.lineTo(x + hx * 0.04, -hy * 0.98);
      }
      ctx.lineTo(hx * 0.2, -hy * 0.55);
      ctx.closePath();
      fillStroke(c);
      break;
    default:
  }
  ctx.restore();
}

// ---------- accessories ----------
function drawGlasses(k, eyeGap, eyeY, eyeSx) {
  const { ctx, L, dx, hx, OL, ink } = k;
  if (L.glasses === 'none') return;
  const z = L.eyeSize;
  const col = L.glassesColor;
  const gy = eyeY + 1;
  const lens = side => {
    const x = side * eyeGap + dx(0.27);
    const sx = eyeSx(side);
    ctx.beginPath();
    if (L.glasses === 'round') ctx.ellipse(x, gy, 20 * z * sx, 19 * z, 0, 0, TAU);
    else ctx.roundRect(x - 23 * z * sx, gy - 15 * z, 46 * z * sx, 31 * z, 7 * z);
    return x;
  };
  const xs = [];
  for (const side of [-1, 1]) {
    const x = lens(side);
    xs.push(x);
    if (L.glasses === 'shades') {
      ctx.fillStyle = 'rgba(12,12,18,0.88)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(x - 12 * z, gy - 18 * z);
      ctx.lineTo(x - 2 * z, gy - 18 * z);
      ctx.lineTo(x - 14 * z, gy + 18 * z);
      ctx.lineTo(x - 24 * z, gy + 18 * z);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.restore();
      lens(side);
    } else {
      ctx.fillStyle = 'rgba(200,225,255,0.12)';
      ctx.fill();
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = L.glasses === 'browline' ? 2 : 3.6;
    ctx.stroke();
    if (L.glasses === 'browline') {
      ctx.beginPath();
      ctx.moveTo(x - 24 * z, gy - 13 * z);
      ctx.quadraticCurveTo(x, gy - 19 * z, x + 24 * z, gy - 13 * z);
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  }
  // bridge and arms
  ctx.beginPath();
  const inner = L.glasses === 'round' ? 20 : 23;
  ctx.moveTo(xs[0] + inner * z * eyeSx(-1), gy - 3);
  ctx.quadraticCurveTo((xs[0] + xs[1]) / 2, gy - 9, xs[1] - inner * z * eyeSx(1), gy - 3);
  ctx.strokeStyle = col;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  for (const side of [-1, 1]) {
    const x = xs[side < 0 ? 0 : 1] + side * inner * z * eyeSx(side);
    ctx.beginPath();
    ctx.moveTo(x, gy - 4);
    ctx.lineTo(side * hx * 0.98 - dx(0.1), gy - 2);
    ctx.stroke();
  }
  if (OL && L.glasses === 'shades') { ctx.strokeStyle = ink; }
}

function drawHeadwear(k, eyeY) {
  const { ctx, L, hx, hy, dx, fillStroke, OL, ink } = k;
  const c1 = L.headwearColor, c2 = L.headwearColor2;
  if (L.headwear === 'none') return;
  ctx.save();
  ctx.translate(dx(0.04), 0);
  switch (L.headwear) {
    case 'beanie': {
      ctx.beginPath();
      ctx.moveTo(-hx * 1.1, -hy * 0.3);
      ctx.bezierCurveTo(-hx * 1.14, -hy * 1.05, -hx * 0.6, -hy * 1.3, 0, -hy * 1.3);
      ctx.bezierCurveTo(hx * 0.6, -hy * 1.3, hx * 1.14, -hy * 1.05, hx * 1.1, -hy * 0.3);
      ctx.closePath();
      fillStroke(c1);
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = shade(c1, -0.18);
      ctx.lineWidth = 3;
      for (let x = -hx * 1.2; x <= hx * 1.2; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, -hy * 1.4);
        ctx.lineTo(x * 1.05, -hy * 0.3);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(-hx * 1.16, -hy * 0.46, hx * 2.32, hy * 0.24, 10);
      fillStroke(c2);
      ctx.beginPath();
      ctx.arc(0, -hy * 1.36, hx * 0.2, 0, TAU);
      fillStroke(c2);
      break;
    }
    case 'cap': {
      ctx.beginPath();
      ctx.moveTo(-hx * 1.07, -hy * 0.34);
      ctx.bezierCurveTo(-hx * 1.1, -hy * 1.08, -hx * 0.6, -hy * 1.22, 0, -hy * 1.22);
      ctx.bezierCurveTo(hx * 0.6, -hy * 1.22, hx * 1.1, -hy * 1.08, hx * 1.07, -hy * 0.34);
      ctx.quadraticCurveTo(0, -hy * 0.44, -hx * 1.07, -hy * 0.34);
      ctx.closePath();
      fillStroke(c1);
      ctx.beginPath();
      ctx.moveTo(0, -hy * 1.22);
      ctx.quadraticCurveTo(-hx * 0.08, -hy * 0.8, 0, -hy * 0.42);
      ctx.strokeStyle = shade(c1, -0.25);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -hy * 1.22, 6, 0, TAU);
      fillStroke(shade(c1, -0.15), 0.6);
      const bx = dx(0.35);
      ctx.beginPath();
      ctx.moveTo(-hx * 1.0 + bx * 0.4, -hy * 0.38);
      ctx.quadraticCurveTo(bx, -hy * 0.38 + 46, hx * 1.0 + bx * 0.4, -hy * 0.38);
      ctx.quadraticCurveTo(bx, -hy * 0.32, -hx * 1.0 + bx * 0.4, -hy * 0.38);
      ctx.closePath();
      fillStroke(c2);
      break;
    }
    case 'headwrap': {
      const wrap = () => {
        ctx.beginPath();
        ctx.moveTo(-hx * 1.08, -hy * 0.22);
        ctx.bezierCurveTo(-hx * 1.3, -hy * 1.1, -hx * 0.5, -hy * 1.62, 0, -hy * 1.5);
        ctx.bezierCurveTo(hx * 0.5, -hy * 1.66, hx * 1.32, -hy * 1.1, hx * 1.08, -hy * 0.22);
        ctx.quadraticCurveTo(0, -hy * 0.56, -hx * 1.08, -hy * 0.22);
        ctx.closePath();
      };
      // knot behind the crown
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * hx * 0.42, -hy * 1.52, hx * 0.42, hy * 0.2, sd * -0.5, 0, TAU);
        fillStroke(shade(c1, -0.12));
      }
      wrap();
      fillStroke(c1);
      ctx.save();
      wrap();
      ctx.clip();
      ctx.strokeStyle = rgba(c2, 0.9);
      ctx.lineWidth = 7;
      for (let x = -hx * 2.4; x < hx * 2.4; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, -hy * 0.1);
        ctx.lineTo(x + hy * 1.6, -hy * 1.7);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 3;
      for (const [a, b] of [[-0.7, -0.4], [0.1, -0.5], [0.6, -0.42]]) {
        ctx.beginPath();
        ctx.moveTo(hx * a, -hy * 1.3);
        ctx.quadraticCurveTo(hx * (a + 0.3), -hy * 0.9, hx * (a + b + 0.6), -hy * 0.5);
        ctx.stroke();
      }
      ctx.restore();
      wrap();
      if (OL) { ctx.strokeStyle = ink; ctx.lineWidth = OL; ctx.stroke(); }
      break;
    }
    case 'headphones': {
      ctx.beginPath();
      ctx.ellipse(0, eyeY - 2, hx * 1.16, hy * 1.16, 0, Math.PI * 1.06, Math.PI * 1.94);
      if (OL) { ctx.strokeStyle = ink; ctx.lineWidth = 13 + OL * 2; ctx.stroke(); }
      ctx.strokeStyle = c1;
      ctx.lineWidth = 13;
      ctx.stroke();
      for (const sd of [-1, 1]) {
        const x = sd * hx * 1.02 - dx(0.12);
        ctx.beginPath();
        ctx.roundRect(x - 16, eyeY - 26, 32, 62, 14);
        fillStroke(c1);
        ctx.beginPath();
        ctx.roundRect(x - sd * 12 - 6, eyeY - 20, 12, 50, 6);
        fillStroke(c2, 0.6);
      }
      break;
    }
    default:
  }
  ctx.restore();
}

function drawEarrings(k, eyeY) {
  const { ctx, L, hx, dx, fillStroke } = k;
  if (L.earrings === 'none' || !L.ears || L.headwear === 'headphones') return;
  for (const side of [-1, 1]) {
    const ex = side * hx * 0.98 - dx(0.16);
    const ey = eyeY + 8 + 19 * L.earSize;
    ctx.beginPath();
    if (L.earrings === 'studs') {
      ctx.arc(ex, ey - 2, 4, 0, TAU);
      fillStroke(L.earringColor, 0.5);
    } else if (L.earrings === 'hoops') {
      ctx.arc(ex, ey + 9, 10, 0, TAU);
      ctx.strokeStyle = L.earringColor;
      ctx.lineWidth = 3.4;
      ctx.stroke();
    } else {
      ctx.moveTo(ex, ey - 2);
      ctx.lineTo(ex, ey + 8);
      ctx.strokeStyle = L.earringColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey + 6);
      ctx.quadraticCurveTo(ex + 7, ey + 16, ex, ey + 22);
      ctx.quadraticCurveTo(ex - 7, ey + 16, ex, ey + 6);
      fillStroke(L.earringColor, 0.5);
    }
  }
}

// ---------- idle motion when no face is tracked ----------
export function idleFace(t, micLevel = 0) {
  const s = t / 1000;
  const cycle = s % 4.2;
  const blink = cycle > 4.02 ? 1 - Math.abs(cycle - 4.11) / 0.09 : 0;
  return {
    ...NEUTRAL,
    blinkL: blink, blinkR: blink,
    yaw: Math.sin(s * 0.55) * 0.12,
    pitch: Math.sin(s * 0.8) * 0.05,
    roll: Math.sin(s * 0.45) * 0.03,
    lookX: Math.sin(s * 0.33) * 0.3,
    smileL: 0.18, smileR: 0.18,
    jaw: clamp(micLevel * 2.2, 0, 0.9),
  };
}
