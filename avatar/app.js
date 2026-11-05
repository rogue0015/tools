// app.js — wires the stage, tracker, recorder, teleprompter, editor and clips together.

import { drawAvatar, NEUTRAL, DEFAULT_LOOK, SCHEMA, PRESETS, randomLook, idleFace } from './avatar.js';
import { createLandmarker, FaceSolver, ASSETS } from './tracker.js';
import { Prompter, SAMPLE_SCRIPT, countWords } from './prompter.js';
import * as store from './store.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// aspect ratio of each format; the size setting picks the short side
const FORMATS = { landscape: [16, 9], portrait: [9, 16], square: [1, 1], classic: [4, 3], tall: [4, 5] };
const even = n => Math.max(2, Math.round(n / 2) * 2);
function outputSize() {
  if (settings.format === 'custom') {
    let w = clamp(settings.customW, 240, 3840), h = clamp(settings.customH, 240, 3840);
    if (settings.lite && Math.min(w, h) > 480) { const k = 480 / Math.min(w, h); w *= k; h *= k; }
    return [even(w), even(h)];
  }
  const [a, b] = FORMATS[settings.format] || FORMATS.landscape;
  const short = settings.lite ? Math.min(480, settings.size) : settings.size;
  return a >= b ? [even(short * a / b), even(short)] : [even(short), even(short * b / a)];
}
// what actually runs, after Lite mode limits
const recFps = () => (settings.lite ? Math.min(30, settings.fps) : settings.fps);
const recBitrate = () => (settings.lite ? Math.min(2.5, settings.vbitrate) : settings.vbitrate);
const SENS = [
  ['blink', 'Blinks', ['blinkL', 'blinkR']], ['wide', 'Wide eyes', ['wideL', 'wideR']], ['squint', 'Squint', ['squintL', 'squintR']],
  ['gaze', 'Eye gaze', ['lookX', 'lookY']], ['brows', 'Brows', ['browInner', 'browOuterL', 'browOuterR', 'browDownL', 'browDownR']],
  ['jaw', 'Mouth open', ['jaw']], ['smile', 'Smile', ['smileL', 'smileR']], ['frown', 'Frown', ['frown']],
  ['pucker', 'Pucker / O', ['pucker', 'funnel']], ['mouthSide', 'Mouth sideways', ['mouthX']], ['cheek', 'Cheek puff', ['cheekPuff']],
];

// ---------------------------------------------------------------- saved state
const load = (key, fallback) => {
  try { const v = localStorage.getItem('avatar-studio.' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem('avatar-studio.' + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const DEFAULT_SETTINGS = {
  mirror: true, expression: 1.15, headMotion: 1, follow: 0.4, smoothing: 0.45, showCam: true,
  sens: Object.fromEntries(['blink', 'wide', 'squint', 'gaze', 'brows', 'jaw', 'smile', 'frown', 'pucker', 'mouthSide', 'cheek'].map(k => [k, 1])),
  yawGain: 1, pitchGain: 1, rollGain: 1, linkBlinks: false, delegate: 'auto', conf: 0.5, trackEvery: 1,
  size: 720, customW: 1280, customH: 720, fps: 30, vbitrate: 4, abitrate: 128, mime: 'auto',
  echoCancel: true, noiseSuppress: true, autoGain: true,
  // Lite mode: lighter work so phones keep up (on by default on touch screens)
  lite: matchMedia('(pointer: coarse)').matches,
  // phones start in portrait (Reels, Shorts, Status); bigger screens in 16:9
  format: matchMedia('(max-width: 700px)').matches ? 'portrait' : 'landscape',
  quality: 'standard', countdown: 3, recordMic: true, camId: '', micId: '',
  wpm: 140, promptSize: 26, promptPos: 'top', promptMirror: false, promptAuto: true, promptShow: true,
};
const settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
settings.sens = { ...DEFAULT_SETTINGS.sens, ...(settings.sens || {}) };
if (settings.quality === 'high' && !load('settings', {}).vbitrate) settings.vbitrate = 8;
let look = sanitizeLook(load('look', DEFAULT_LOOK));
let savedLooks = load('looks', []);
let script = load('script', SAMPLE_SCRIPT);
const undoStack = [];

const saveSettings = debounce(() => save('settings', settings), 250);
const saveLook = debounce(() => save('look', look), 300);
const saveScript = debounce(() => save('script', script), 400);

function sanitizeLook(obj) {
  const out = { ...DEFAULT_LOOK };
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(DEFAULT_LOOK)) {
      if (k in obj && typeof obj[k] === typeof DEFAULT_LOOK[k]) out[k] = obj[k];
    }
  }
  return out;
}

// ---------------------------------------------------------------- elements
const canvas = $('#avatar');
const ctx = canvas.getContext('2d');
const stageEl = $('#stage');
const cam = $('#cam');

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  $('#toastMsg').textContent = msg;
  const btn = $('#toastAction');
  btn.hidden = !action;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { el.hidden = true; action.run(); };
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 9000 : 4200);
}

function setChip(el, state, text) {
  el.dataset.state = state;
  el.textContent = text;
}

// ---------------------------------------------------------------- tabs
function showTab(name) {
  for (const t of $$('.tab')) {
    const on = t.id === 'tab-' + name;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  }
  if (name === 'clips') renderClips();
  if (name === 'setup') refreshOfflineInfo();
}
// Phones: the tabs sit in a bottom bar and open their panel as a sheet over the
// stage. Tapping the open tab again (or the handle) closes it.
const phone = matchMedia('(max-width: 899px)');
function setSheet(open) {
  document.body.classList.toggle('sheet-open', open);
  $('#sheetClose').setAttribute('aria-expanded', open);
}
$('#sheetClose').addEventListener('click', () => setSheet(false));
for (const t of $$('.tab')) {
  t.addEventListener('click', () => {
    const name = t.id.slice(4);
    if (phone.matches) {
      const same = t.getAttribute('aria-selected') === 'true';
      if (same && document.body.classList.contains('sheet-open')) return setSheet(false);
      setSheet(true);
    }
    showTab(name);
  });
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.tab');
    const i = (tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[i].focus();
    showTab(tabs[i].id.slice(4));
  });
}

// ---------------------------------------------------------------- format
function applyFormat() {
  const [w, h] = outputSize();
  $('#sizeInfo').textContent = `${w} × ${h}` + (settings.lite ? ' · Lite' : '');
  $('#customSize').hidden = settings.format !== 'custom';
  $('#sizeOpts').hidden = settings.format === 'custom';
  canvas.width = w;
  canvas.height = h;
  document.documentElement.style.setProperty('--ar', `${w} / ${h}`);
  for (const b of $$('#formatOpts .opt')) b.setAttribute('aria-pressed', b.dataset.format === settings.format);
  prompter?.measure();
}

// ---------------------------------------------------------------- avatar editor
const editorControls = new Map(); // key -> { field, wrap, sync() }

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

function formatValue(field, v) {
  if (field.key === 'eyeHeight' || field.key === 'posY') return (v > 0 ? '+' : '') + Math.round(v * 100);
  if (field.key === 'outlineWidth') return v.toFixed(1);
  return Math.round(v * 100) + '%';
}

function buildField(field) {
  const id = 'f-' + field.key;
  const wrap = el('div', { class: 'field', 'data-key': field.key });
  let sync;
  if (field.type === 'toggle') {
    const input = el('input', { type: 'checkbox', id, onchange: () => setLook(field.key, input.checked) });
    wrap.append(el('label', { class: 'switch', for: id }, field.label, input));
    sync = () => { input.checked = !!look[field.key]; };
  } else if (field.type === 'range') {
    const out = el('output', { for: id });
    const input = el('input', { type: 'range', id, min: field.min, max: field.max, step: field.step, oninput: () => setLook(field.key, parseFloat(input.value)) });
    wrap.append(el('div', { class: 'field-head' }, el('label', { for: id }, field.label), out), input);
    sync = () => { input.value = look[field.key]; out.textContent = formatValue(field, look[field.key]); };
  } else if (field.type === 'choice') {
    const labelId = id + '-label';
    const opts = el('div', { class: 'opts', role: 'group', 'aria-labelledby': labelId });
    const buttons = field.options.map(([value, text]) => {
      const b = el('button', { type: 'button', class: 'opt', onclick: () => setLook(field.key, value) }, text);
      b.dataset.value = value;
      opts.append(b);
      return b;
    });
    wrap.append(el('div', { class: 'field-head' }, el('span', { id: labelId }, field.label)), opts);
    sync = () => { for (const b of buttons) b.setAttribute('aria-pressed', b.dataset.value === look[field.key]); };
  } else if (field.type === 'color') {
    const labelId = id + '-label';
    const row = el('div', { class: 'swatches', role: 'group', 'aria-labelledby': labelId });
    const buttons = field.swatches.map(c => {
      const b = el('button', { type: 'button', class: 'sw', 'aria-label': c, title: c, onclick: () => setLook(field.key, c) });
      b.style.background = c;
      b.dataset.value = c;
      row.append(b);
      return b;
    });
    const picker = el('input', { type: 'color', 'aria-label': `Custom ${field.label.toLowerCase()}`, oninput: () => setLook(field.key, picker.value) });
    const custom = el('label', { class: 'sw-custom', title: 'Pick any colour' }, '+', picker);
    row.append(custom);
    wrap.append(el('div', { class: 'field-head' }, el('span', { id: labelId }, field.label)), row);
    sync = () => {
      const v = String(look[field.key]).toLowerCase();
      let matched = false;
      for (const b of buttons) { const on = b.dataset.value.toLowerCase() === v; matched ||= on; b.setAttribute('aria-pressed', on); }
      picker.value = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
      custom.style.background = matched ? '' : v;
      custom.style.borderStyle = matched ? 'dashed' : 'solid';
    };
  }
  editorControls.set(field.key, { field, wrap, sync });
  return wrap;
}

function buildEditor() {
  const host = $('#editor');
  host.textContent = '';
  SCHEMA.forEach((sec, i) => {
    const fields = el('div', { class: 'fields' });
    for (const f of sec.fields) fields.append(buildField(f));
    const det = el('details', { class: 'sec', open: i === 0 }, el('summary', {}, sec.title), fields);
    host.append(det);
  });
  syncEditor();
}

function syncEditor(onlyKey) {
  for (const [key, c] of editorControls) {
    if (!onlyKey || key === onlyKey) c.sync();
    c.wrap.hidden = c.field.when ? !c.field.when(look) : false;
  }
}

function setLook(key, value) {
  look[key] = value;
  syncEditor(key);
  saveLook();
}

function applyLook(next, { remember = true } = {}) {
  if (remember) {
    undoStack.push({ ...look });
    if (undoStack.length > 30) undoStack.shift();
    $('#undoBtn').disabled = false;
  }
  look = sanitizeLook(next);
  syncEditor();
  saveLook();
}

function renderLooks() {
  const host = $('#looks');
  host.textContent = '';
  for (const p of PRESETS) {
    host.append(el('span', { class: 'look-chip' }, el('button', { type: 'button', onclick: () => applyLook(p.look) }, p.name)));
  }
  savedLooks.forEach((s, i) => {
    host.append(el('span', { class: 'look-chip user' },
      el('button', { type: 'button', onclick: () => applyLook(s.look) }, s.name),
      el('button', { type: 'button', 'aria-label': `Delete ${s.name}`, title: 'Delete this look', onclick: () => {
        savedLooks.splice(i, 1);
        save('looks', savedLooks);
        renderLooks();
        toast(`Deleted “${s.name}”.`);
      } }, '×')));
  });
}

$('#randomBtn').addEventListener('click', () => applyLook(randomLook(look)));
$('#undoBtn').addEventListener('click', () => {
  const prev = undoStack.pop();
  if (prev) applyLook(prev, { remember: false });
  $('#undoBtn').disabled = undoStack.length === 0;
});
$('#saveLookBtn').addEventListener('click', () => {
  const input = $('#lookName');
  const name = input.value.trim() || `Look ${savedLooks.length + 1}`;
  const existing = savedLooks.findIndex(s => s.name === name);
  if (existing >= 0) savedLooks[existing].look = { ...look };
  else savedLooks.push({ name, look: { ...look } });
  savedLooks = savedLooks.slice(-24);
  save('looks', savedLooks);
  input.value = '';
  renderLooks();
  toast(existing >= 0 ? `Updated “${name}”.` : `Saved “${name}”. Find it under Looks.`);
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'avatar-studio', version: 1, look }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'avatar-look.json');
});
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = data.look || data;
    if (!incoming || typeof incoming !== 'object' || !('skin' in incoming)) throw new Error('not a look');
    applyLook(incoming);
    toast('Look imported.');
  } catch {
    toast('That file isn’t an avatar look. Choose a .json file exported from Avatar Studio.');
  }
});

// ---------------------------------------------------------------- teleprompter
const prompterRoot = $('#prompter');
const prompter = new Prompter({
  root: prompterRoot,
  viewport: $('#prompterView'),
  content: $('#prompterText'),
  onState: p => {
    $('#pPlay').innerHTML = `<svg class="i"><use href="#i-${p.playing ? 'pause' : 'play'}"/></svg>`;
    $('#pPlay').setAttribute('aria-label', p.playing ? 'Pause the script' : 'Start scrolling');
  },
});

function updateScriptStats() {
  const words = countWords(script);
  const secs = Math.round((words / settings.wpm) * 60);
  const m = Math.floor(secs / 60), s = secs % 60;
  $('#scriptStats').textContent = `${words} words · ${m ? m + ' min ' : ''}${s} s at ${settings.wpm} wpm`;
}

function applyPrompterSettings() {
  prompterRoot.hidden = !settings.promptShow;
  prompterRoot.dataset.pos = settings.promptPos;
  prompterRoot.dataset.mirror = settings.promptMirror;
  prompterRoot.style.setProperty('--pfs', `${settings.promptSize}px`);
  prompter.setWpm(settings.wpm);
  $('#pWpm').textContent = `${settings.wpm} wpm`;
  $('#wpmOut').textContent = `${settings.wpm} wpm`;
  $('#promptSizeOut').textContent = `${settings.promptSize} px`;
  $('#wpm').value = settings.wpm;
  $('#promptSize').value = settings.promptSize;
  $('#promptAuto').checked = settings.promptAuto;
  $('#promptMirror').checked = settings.promptMirror;
  $('#promptBtn').setAttribute('aria-pressed', settings.promptShow);
  for (const b of $$('[data-pos]')) if (b.classList.contains('opt')) b.setAttribute('aria-pressed', b.dataset.pos === settings.promptPos);
  updateScriptStats();
  requestAnimationFrame(() => prompter.measure());
}

function setWpm(v) {
  settings.wpm = clamp(Math.round(v / 5) * 5, 80, 220);
  saveSettings();
  applyPrompterSettings();
}

$('#scriptInput').value = script;
$('#scriptInput').addEventListener('input', e => {
  script = e.target.value;
  prompter.setScript(script);
  updateScriptStats();
  saveScript();
});
$('#wpm').addEventListener('input', e => setWpm(+e.target.value));
$('#promptSize').addEventListener('input', e => { settings.promptSize = +e.target.value; saveSettings(); applyPrompterSettings(); });
$('#promptAuto').addEventListener('change', e => { settings.promptAuto = e.target.checked; saveSettings(); });
$('#promptMirror').addEventListener('change', e => { settings.promptMirror = e.target.checked; saveSettings(); applyPrompterSettings(); });
for (const b of $$('.opt[data-pos]')) b.addEventListener('click', () => { settings.promptPos = b.dataset.pos; saveSettings(); applyPrompterSettings(); });
$('#promptBtn').addEventListener('click', () => { settings.promptShow = !settings.promptShow; saveSettings(); applyPrompterSettings(); });
$('#prompterView').addEventListener('click', () => prompter.toggle());
$('#pPlay').addEventListener('click', () => prompter.toggle());
$('#pRestart').addEventListener('click', () => prompter.restart());
$('#pSlower').addEventListener('click', () => setWpm(settings.wpm - 10));
$('#pFaster').addEventListener('click', () => setWpm(settings.wpm + 10));
$('#prompterView').addEventListener('wheel', e => { e.preventDefault(); prompter.nudge(e.deltaY * 0.6); }, { passive: false });

// ---------------------------------------------------------------- setup bindings
function bindRange(id, key, fmt) {
  const input = $('#' + id), out = $('#' + id + 'Out');
  const show = () => { out.textContent = fmt(settings[key]); };
  input.value = settings[key];
  show();
  input.addEventListener('input', () => { settings[key] = parseFloat(input.value); show(); saveSettings(); });
}
function bindToggle(id, key, after) {
  const input = $('#' + id);
  input.checked = !!settings[key];
  input.addEventListener('change', () => { settings[key] = input.checked; saveSettings(); after?.(); });
}
function bindOpts(containerSel, attr, key, parse, after) {
  const buttons = $$(containerSel + ' .opt');
  const sync = () => { for (const b of buttons) b.setAttribute('aria-pressed', parse(b.dataset[attr]) === settings[key]); };
  for (const b of buttons) b.addEventListener('click', () => { settings[key] = parse(b.dataset[attr]); sync(); saveSettings(); after?.(); });
  sync();
}
const pct = v => Math.round(v * 100) + '%';
bindRange('expression', 'expression', pct);
bindRange('headMotion', 'headMotion', pct);
bindRange('follow', 'follow', pct);
bindRange('smoothing', 'smoothing', pct);
bindToggle('mirror', 'mirror', () => solver.recenter());
bindToggle('showCam', 'showCam', () => { cam.hidden = !(camOn && settings.showCam); });
bindToggle('recordMic', 'recordMic', updateMimeInfo);
bindOpts('#formatOpts', 'format', 'format', String, applyFormat);
bindOpts('#sizeOpts', 'size', 'size', Number, applyFormat);
bindOpts('#fpsOpts', 'fps', 'fps', Number);
bindOpts('#abitrateOpts', 'abitrate', 'abitrate', Number);
bindOpts('#delegateOpts', 'delegate', 'delegate', String, reloadTracker);
bindRange('vbitrate', 'vbitrate', v => v + ' Mbps');
bindRange('yawGain', 'yawGain', pct);
bindRange('pitchGain', 'pitchGain', pct);
bindRange('rollGain', 'rollGain', pct);
bindRange('conf', 'conf', pct);
$('#conf').addEventListener('change', reloadTracker);
bindOpts('#trackEveryOpts', 'trackEvery', 'every', Number);
bindToggle('linkBlinks', 'linkBlinks');
bindToggle('lite', 'lite', () => { applyFormat(); if (camOn && !recorder) startCamera(); });
for (const id of ['echoCancel', 'noiseSuppress', 'autoGain']) bindToggle(id, id, () => { if (camOn && !recorder) startCamera(); });
for (const id of ['customW', 'customH']) {
  const input = $('#' + id);
  input.value = settings[id];
  input.addEventListener('change', () => { settings[id] = even(clamp(+input.value || 720, 240, 3840)); input.value = settings[id]; saveSettings(); applyFormat(); });
}

// per-expression sensitivity, with a live meter of what the tracker sees
const sensMeters = [];
for (const [key, label, channels] of SENS) {
  const out = el('output', {}, pct(settings.sens[key]));
  const input = el('input', { type: 'range', min: '0', max: '3', step: '0.05', value: String(settings.sens[key]), 'aria-label': label + ' sensitivity' });
  const bar = el('i');
  input.addEventListener('input', () => { settings.sens[key] = +input.value; out.textContent = pct(+input.value); saveSettings(); });
  $('#sensList').append(el('div', { class: 'field' }, el('div', { class: 'field-head' }, el('span', {}, label), out), input, el('div', { class: 'live' }, bar)));
  sensMeters.push([bar, channels]);
}
$('#sensReset').addEventListener('click', () => {
  for (const k in settings.sens) settings.sens[k] = 1;
  for (const k of ['yawGain', 'pitchGain', 'rollGain']) settings[k] = 1;
  saveSettings();
  location.reload();
});
function updateSensMeters() {
  if ($('#pane-setup').hidden) return;
  for (const [bar, ch] of sensMeters) {
    const v = Math.max(...ch.map(c => Math.abs(face[c] || 0)));
    bar.style.width = Math.min(100, v * 100).toFixed(0) + '%';
  }
}

// container / codec list from what this browser can record
function fillMimeSelect() {
  const sel = $('#mimeSelect');
  const all = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=hvc1,mp4a.40.2', 'video/mp4;codecs=av01,opus',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=av01,opus', 'video/webm;codecs=h264,opus'];
  const names = { 'avc1.42E01E': 'H.264 Baseline', 'avc1.640028': 'H.264 High', hvc1: 'H.265 / HEVC', av01: 'AV1', vp9: 'VP9', vp8: 'VP8', h264: 'H.264' };
  sel.replaceChildren(el('option', { value: 'auto' }, 'Automatic (best for this browser)'));
  if (window.MediaRecorder) for (const m of all) {
    if (!MediaRecorder.isTypeSupported(m)) continue;
    const [ct, codecs] = m.split(';codecs=');
    sel.append(el('option', { value: m }, `${ct === 'video/mp4' ? 'MP4' : 'WebM'} · ${names[codecs.split(',')[0]] || codecs}`));
  }
  if (![...sel.options].some(o => o.value === settings.mime)) settings.mime = 'auto';
  sel.value = settings.mime;
}
fillMimeSelect();
$('#mimeSelect').addEventListener('change', e => { settings.mime = e.target.value; saveSettings(); updateMimeInfo(); });
bindOpts('#countdownOpts', 'countdown', 'countdown', Number);

// ---------------------------------------------------------------- camera + mic
let stream = null;
let camOn = false;
let audioCtx = null, analyser = null, levelBuf = null, micLevel = 0;

function cameraError(err) {
  if (!navigator.mediaDevices?.getUserMedia) return 'The camera needs a secure page. Open the app over https:// or on localhost.';
  switch (err?.name) {
    case 'NotAllowedError': return 'Camera access is blocked. Allow the camera for this site in your browser settings, then try again.';
    case 'NotFoundError': return 'No camera was found on this device.';
    case 'NotReadableError': return 'Another app is using the camera. Close it and try again.';
    default: return 'The camera didn’t start. Reload the page and try again.';
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { toast(cameraError()); return false; }
  stopCamera();
  // the tracker only needs a small picture; Lite mode halves it again
  const video = settings.lite
    ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }
    : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: Math.max(30, settings.fps) } };
  if (settings.camId) video.deviceId = { exact: settings.camId };
  else video.facingMode = 'user';
  const audio = { echoCancellation: settings.echoCancel, noiseSuppression: settings.noiseSuppress, autoGainControl: settings.autoGain };
  if (settings.micId) audio.deviceId = { exact: settings.micId };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch (err) {
    if (err.name === 'OverconstrainedError' && (settings.camId || settings.micId)) {
      settings.camId = ''; settings.micId = ''; saveSettings();
      return startCamera();
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video });
      toast('The microphone is blocked, so takes will be silent. Allow the microphone for this site to record your voice.');
    } catch (err2) {
      toast(cameraError(err2));
      updateCamUI();
      return false;
    }
  }
  cam.srcObject = stream;
  try { await cam.play(); } catch { /* autoplay of a muted video is allowed; ignore */ }
  camOn = true;
  solver.recenter();
  setupMeter();
  updateCamUI();
  fillDevices();
  updateMimeInfo();
  return true;
}

function stopCamera() {
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  camOn = false;
  cam.srcObject = null;
  analyser = null;
  updateCamUI();
}

function updateCamUI() {
  $('#camBtn').setAttribute('aria-pressed', camOn);
  $('#camBtn .lbl').textContent = camOn ? 'Camera on' : 'Camera';
  cam.hidden = !(camOn && settings.showCam);
  if (!camOn) setChip($('#faceChip'), '', 'Camera off');
}

function setupMeter() {
  const track = stream?.getAudioTracks()[0];
  if (!track) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    levelBuf = new Uint8Array(analyser.fftSize);
    src.connect(analyser);
  } catch (e) { console.warn('Level meter unavailable', e); }
}

function readMic() {
  if (!analyser) { micLevel *= 0.9; return; }
  analyser.getByteTimeDomainData(levelBuf);
  let sum = 0;
  for (const v of levelBuf) { const x = (v - 128) / 128; sum += x * x; }
  const rms = Math.sqrt(sum / levelBuf.length);
  const lvl = clamp(rms * 4.5, 0, 1);
  micLevel += (lvl - micLevel) * (lvl > micLevel ? 0.6 : 0.15);
}

async function fillDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const fill = (sel, kind, fallback, key) => {
      const s = $(sel);
      s.textContent = '';
      s.append(el('option', { value: '' }, fallback));
      devices.filter(d => d.kind === kind).forEach((d, i) => s.append(el('option', { value: d.deviceId }, d.label || `${fallback} ${i + 1}`)));
      s.value = settings[key] && [...s.options].some(o => o.value === settings[key]) ? settings[key] : '';
    };
    fill('#camSelect', 'videoinput', 'Front camera', 'camId');
    fill('#micSelect', 'audioinput', 'Default microphone', 'micId');
  } catch { /* device list unavailable */ }
}
$('#camSelect').addEventListener('change', e => { settings.camId = e.target.value; saveSettings(); if (camOn && !recorder) startCamera(); });
$('#micSelect').addEventListener('change', e => { settings.micId = e.target.value; saveSettings(); if (camOn && !recorder) startCamera(); });
$('#camBtn').addEventListener('click', () => {
  if (recorder) { toast('Stop recording before turning the camera off.'); return; }
  camOn ? stopCamera() : startCamera();
});
$('#recenterBtn').addEventListener('click', () => {
  solver.recenter();
  toast(camOn ? 'Recentred. Keep looking at the camera for a moment.' : 'Turn the camera on first.');
});

// ---------------------------------------------------------------- tracker
let landmarker = null;
const solver = new FaceSolver();

async function loadTracker() {
  setChip($('#trackerChip'), 'busy', 'Loading tracker');
  try {
    const { landmarker: lm, delegate } = await createLandmarker({ delegate: settings.delegate, conf: settings.conf });
    landmarker = lm;
    setChip($('#trackerChip'), 'ok', `Tracker ready · ${delegate}`);
  } catch (err) {
    console.error(err);
    setChip($('#trackerChip'), 'bad', 'Tracker unavailable');
    toast(navigator.onLine
      ? 'The face tracker didn’t load. Check your connection and reload the page.'
      : 'You’re offline and the face tracker hasn’t been downloaded yet. Open the app once with internet, then it works offline.');
  }
}

let reloading = null;
async function reloadTracker() {
  if (reloading) return;
  const old = landmarker;
  landmarker = null;
  try { old?.close(); } catch { /* already closed */ }
  reloading = loadTracker();
  await reloading;
  reloading = null;
}

// ---------------------------------------------------------------- render loop
const face = { ...NEUTRAL };
let trackTick = 0;
// Lite mode draws a flat avatar: no soft shading, plain background
let liteSrc = null, liteCache = null;
function liteLook() {
  if (liteSrc !== look) {
    liteSrc = look;
    liteCache = { ...look, shading: false, bg: ['studio', 'gradient', 'dots'].includes(look.bg) ? 'solid' : look.bg };
  }
  return liteCache;
}
let lastT = performance.now(), lastVideoTime = -1, lastSeen = -1e9, trackMix = 0, faceState = '';

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  readMic();

  trackTick++;
  if (landmarker && camOn && cam.readyState >= 2 && cam.currentTime !== lastVideoTime && trackTick % settings.trackEvery === 0) {
    lastVideoTime = cam.currentTime;
    try {
      const res = landmarker.detectForVideo(cam, t);
      const cfg = settings.lite ? { ...settings, smoothing: Math.min(settings.smoothing, 0.25) } : settings;
      if (solver.update(res, cfg, (cam.videoWidth || 4) / (cam.videoHeight || 3))) lastSeen = t;
    } catch (err) { console.warn(err); }
  }
  const tracking = camOn && t - lastSeen < 600;
  const nextState = !camOn ? '' : tracking ? 'ok' : 'warn';
  if (nextState !== faceState) {
    faceState = nextState;
    if (camOn) setChip($('#faceChip'), nextState, tracking ? 'Tracking' : (landmarker ? 'No face found' : 'Waiting for tracker'));
  }

  trackMix += ((tracking ? 1 : 0) - trackMix) * Math.min(1, dt * 6);
  const idle = idleFace(t, micLevel);
  const live = solver.state;
  for (const k in face) face[k] = idle[k] + (live[k] - idle[k]) * trackMix;

  drawAvatar(ctx, canvas.width, canvas.height, settings.lite ? liteLook() : look, face, t);
  prompter.tick(dt);
  $('#meter').style.width = (micLevel * 100).toFixed(1) + '%';
  if (recorder) updateTimecode();
  updateSensMeters();
}

// ---------------------------------------------------------------- recording
let recorder = null;
let rec = null; // details of the take in progress
let countdownCancel = null;
let wakeLock = null;

function pickMime(withAudio) {
  if (!window.MediaRecorder) return null;
  const list = withAudio
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (settings.mime !== 'auto' && MediaRecorder.isTypeSupported(settings.mime)) {
    return withAudio ? settings.mime : settings.mime.split(',')[0];
  }
  return list.find(m => MediaRecorder.isTypeSupported(m)) || '';
}
function updateMimeInfo() {
  const m = pickMime(settings.recordMic);
  $('#mimeInfo').textContent = m === null ? 'Recording not supported here' : (m.startsWith('video/mp4') ? 'MP4' : 'WebM') + (settings.recordMic ? ' with audio' : ', no audio');
}

function timecode(ms) {
  const totalFrames = Math.floor((ms / 1000) * recFps());
  const ff = totalFrames % recFps();
  const s = Math.floor(totalFrames / recFps());
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`;
}
function elapsed() {
  if (!rec) return 0;
  const pausedNow = rec.pausedAt ? performance.now() - rec.pausedAt : 0;
  return performance.now() - rec.startedAt - rec.pausedTotal - pausedNow;
}
function updateTimecode() { $('#timecode').textContent = timecode(elapsed()); }

function runCountdown(n) {
  return new Promise(resolve => {
    const box = $('#countdown');
    let left = n;
    box.hidden = false;
    box.textContent = left;
    const iv = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(iv); box.hidden = true; countdownCancel = null; resolve(true); }
      else box.textContent = left;
    }, 1000);
    countdownCancel = () => { clearInterval(iv); box.hidden = true; countdownCancel = null; resolve(false); };
  });
}

async function toggleRecord() {
  if (recorder) return stopRecording();
  if (countdownCancel) { countdownCancel(); toast('Countdown cancelled.'); return; }
  if (!window.MediaRecorder || !canvas.captureStream) { toast('This browser can’t record video. Use a recent Chrome, Edge, Safari or Firefox.'); return; }
  if (!camOn) await startCamera();
  if (settings.countdown > 0) {
    if (settings.promptShow) prompter.restart();
    const go = await runCountdown(settings.countdown);
    if (!go) return;
  }
  beginRecording();
}

async function makeThumb() {
  const w = 320, h = Math.round(320 * canvas.height / canvas.width);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.75));
}

function beginRecording() {
  const vStream = canvas.captureStream(recFps());
  const tracks = [...vStream.getVideoTracks()];
  const audioTrack = settings.recordMic ? stream?.getAudioTracks()[0] : null;
  if (audioTrack) tracks.push(audioTrack);
  const mime = pickMime(!!audioTrack);
  try {
    recorder = new MediaRecorder(new MediaStream(tracks), {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: Math.round(recBitrate() * 1_000_000),
      audioBitsPerSecond: settings.abitrate * 1000,
    });
  } catch (err) {
    console.error(err);
    for (const t of vStream.getVideoTracks()) t.stop();
    toast('Recording couldn’t start in this browser. Try turning off "Record microphone audio" or use Chrome.');
    return;
  }
  const take = rec = {
    id: 'take-' + Date.now(),
    seq: 0,
    chunks: [],
    startedAt: performance.now(),
    pausedTotal: 0,
    pausedAt: 0,
    meta: { started: Date.now(), width: canvas.width, height: canvas.height },
    vStream,
    thumb: null,
  };
  makeThumb().then(b => { take.thumb = b; });
  const r = recorder;
  r.ondataavailable = e => {
    if (!e.data || !e.data.size) return;
    take.chunks.push(e.data);
    store.putChunk(take.id, take.seq++, r.mimeType || mime, e.data, take.meta).catch(err => console.warn('Chunk not saved', err));
  };
  r.onstop = () => finishTake(take, r);
  r.onerror = e => { console.error(e); toast('Recording stopped because of an error. What was recorded so far has been saved.'); };
  r.start(1000);

  $('#recBtn').setAttribute('aria-pressed', 'true');
  $('#recBtn').setAttribute('aria-label', 'Stop recording');
  $('#tally').hidden = false;
  $('#timecode').dataset.live = 'true';
  requestWakeLock();
  if (settings.promptShow && settings.promptAuto) { prompter.restart(); prompter.play(); }
}

function stopRecording() {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  rec.duration = elapsed();
  try { r.state !== 'inactive' && r.stop(); } catch (e) { console.warn(e); }
  $('#recBtn').setAttribute('aria-pressed', 'false');
  $('#recBtn').setAttribute('aria-label', 'Start recording');
  $('#tally').hidden = true;
  $('#timecode').dataset.live = 'false';
  prompter.pause();
  releaseWakeLock();
}

async function finishTake(take, r) {
  for (const t of take.vStream.getVideoTracks()) t.stop();
  const type = (r.mimeType || 'video/webm').split(';')[0];
  const blob = new Blob(take.chunks, { type });
  const clips = await store.listClips().catch(() => []);
  const clip = {
    id: take.id,
    name: `Take ${clips.length + 1}`,
    created: take.meta.started,
    duration: take.duration || 0,
    mime: type,
    size: blob.size,
    width: take.meta.width,
    height: take.meta.height,
    blob,
    thumb: take.thumb || null,
  };
  if (rec === take) rec = null;
  $('#timecode').textContent = timecode(0);
  try {
    await store.saveClip(clip);
    await store.deleteChunks(take.id);
    toast(`${clip.name} saved · ${timecode(clip.duration).slice(3, 8)}`, { label: 'View', run: () => showTab('clips') });
  } catch (err) {
    console.error(err);
    toast('This device is out of storage space, so the take wasn’t saved in the app. Download it now.', {
      label: 'Download', run: () => downloadBlob(blob, fileName(clip)),
    });
  }
  renderClips();
}

$('#recBtn').addEventListener('click', toggleRecord);

// Pausing while the app is in the background keeps picture and sound in step.
document.addEventListener('visibilitychange', () => {
  if (!recorder || !rec) return;
  if (document.hidden && recorder.state === 'recording') {
    recorder.pause();
    rec.pausedAt = performance.now();
  } else if (!document.hidden && recorder.state === 'paused') {
    recorder.resume();
    rec.pausedTotal += performance.now() - rec.pausedAt;
    rec.pausedAt = 0;
    requestWakeLock();
    toast('Recording resumed. The time the app spent in the background was left out.');
  }
});

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported or refused */ }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* already released */ }
  wakeLock = null;
}

// ---------------------------------------------------------------- clips
const objectUrls = new Set();
function blobUrl(blob) { const u = URL.createObjectURL(blob); objectUrls.add(u); return u; }
function fileName(clip) {
  const d = new Date(clip.created);
  const p = n => String(n).padStart(2, '0');
  const ext = clip.mime.includes('mp4') ? 'mp4' : 'webm';
  return `avatar-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
const mb = bytes => (bytes / 1048576).toFixed(bytes > 104857600 ? 0 : 1) + ' MB';

async function renderClips() {
  let clips = [], pending = [];
  try {
    [clips, pending] = await Promise.all([store.listClips(), store.pendingTakes()]);
  } catch (err) {
    $('#clipList').textContent = 'Saved takes can’t be read in this browser mode (private browsing blocks storage).';
    return;
  }
  for (const u of objectUrls) URL.revokeObjectURL(u);
  objectUrls.clear();
  $('#clipCount').textContent = clips.length ? clips.length : '';

  // takes interrupted by a crash or a closed tab
  const rescue = $('#recovery');
  rescue.textContent = '';
  for (const p of pending.filter(p => p.rec !== rec?.id)) {
    const when = p.started ? new Date(p.started).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'earlier';
    const box = el('div', { class: 'banner' },
      el('div', {}, el('strong', {}, 'Unfinished take found. '), `Recorded ${when}, about ${p.chunks} s, ${mb(p.bytes)}.`),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small primary', onclick: () => recoverTake(p) }, 'Recover it'),
        el('button', { type: 'button', class: 'btn small danger', onclick: async () => { await store.deleteChunks(p.rec); renderClips(); } }, 'Discard')));
    rescue.append(box);
  }

  const list = $('#clipList');
  list.textContent = '';
  if (!clips.length) {
    list.append(el('div', { class: 'empty' }, el('strong', {}, 'No takes yet'), 'Press the red button to record. Takes are saved on this device only.'));
  }
  for (const clip of clips) {
    const d = new Date(clip.created);
    const thumb = clip.thumb ? el('img', { class: 'clip-thumb', alt: '', src: blobUrl(clip.thumb) }) : el('div', { class: 'clip-thumb' });
    const card = el('article', { class: 'clip' });
    const actions = el('div', { class: 'row' });
    const playBtn = el('button', { type: 'button', class: 'btn small' }, el('span', {}, 'Play'));
    playBtn.addEventListener('click', () => {
      const existing = card.querySelector('video');
      if (existing) { existing.remove(); playBtn.firstChild.textContent = 'Play'; return; }
      const v = el('video', { controls: true, playsinline: true, src: blobUrl(clip.blob) });
      card.append(v);
      playBtn.firstChild.textContent = 'Close';
      v.play().catch(() => {});
    });
    const saveBtn = el('button', { type: 'button', class: 'btn small', onclick: () => downloadBlob(clip.blob, fileName(clip)) });
    saveBtn.innerHTML = '<svg class="i"><use href="#i-down"/></svg>Save';
    actions.append(playBtn, saveBtn);
    const file = new File([clip.blob], fileName(clip), { type: clip.mime });
    if (navigator.canShare?.({ files: [file] })) {
      const shareBtn = el('button', { type: 'button', class: 'btn small', onclick: () => navigator.share({ files: [file], title: clip.name }).catch(() => {}) });
      shareBtn.innerHTML = '<svg class="i"><use href="#i-share"/></svg>Share';
      actions.append(shareBtn);
    }
    const delBtn = el('button', { type: 'button', class: 'btn small danger' }, 'Delete');
    let armTimer;
    delBtn.addEventListener('click', async () => {
      if (delBtn.dataset.armed !== 'true') {
        delBtn.dataset.armed = 'true';
        delBtn.textContent = 'Tap again to delete';
        armTimer = setTimeout(() => { delBtn.dataset.armed = 'false'; delBtn.textContent = 'Delete'; }, 3500);
        return;
      }
      clearTimeout(armTimer);
      await store.deleteClip(clip.id);
      toast(`${clip.name} deleted.`);
      renderClips();
    });
    actions.append(delBtn);
    card.append(thumb, el('div', { class: 'clip-body' },
      el('div', { class: 'clip-title' }, clip.name),
      el('div', { class: 'clip-meta' }, `${timecode(clip.duration).slice(3, 8)} · ${clip.width}×${clip.height} · ${clip.mime.includes('mp4') ? 'MP4' : 'WebM'} · ${mb(clip.size)}`),
      el('div', { class: 'clip-meta' }, d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })),
      actions));
    list.append(card);
  }
  showStorage();
}

async function recoverTake(p) {
  try {
    const rows = await store.getChunks(p.rec);
    const type = (p.mime || 'video/webm').split(';')[0];
    const blob = new Blob(rows.map(r => r.data), { type });
    const clips = await store.listClips();
    await store.saveClip({
      id: p.rec, name: `Take ${clips.length + 1} (recovered)`, created: p.started || Date.now(),
      duration: rows.length * 1000, mime: type, size: blob.size, width: p.width || 0, height: p.height || 0, blob, thumb: null,
    });
    await store.deleteChunks(p.rec);
    toast('Take recovered.');
  } catch (err) {
    console.error(err);
    toast('That take couldn’t be recovered.');
  }
  renderClips();
}

async function showStorage() {
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const text = `${mb(usage)} used of about ${quota > 1073741824 ? (quota / 1073741824).toFixed(1) + ' GB' : mb(quota)} available to this app.`;
    $('#clipStorage').textContent = 'Takes stay on this device until you delete them. ' + text;
    $('#offStorage').textContent = mb(usage);
  } catch { /* estimate not supported */ }
}

// ---------------------------------------------------------------- offline
async function setupOffline() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('./sw.js');
    if (!navigator.serviceWorker.controller) {
      // First visit: wait for the worker to take control so the tracker
      // files are cached as they download.
      await new Promise(res => {
        navigator.serviceWorker.addEventListener('controllerchange', res, { once: true });
        setTimeout(res, 6000);
      });
    }
    return !!navigator.serviceWorker.controller;
  } catch (err) {
    console.warn('Offline mode unavailable', err);
    return false;
  }
}

async function trackerCached() {
  if (!('caches' in window)) return false;
  const has = async url => !!(await caches.match(url, { ignoreSearch: true }));
  const wasm = (await has(`${ASSETS.wasm}/vision_wasm_internal.wasm`));
  return wasm && (await has(ASSETS.model)) && (await has(ASSETS.bundle));
}

let offlineReady = false;
async function refreshOfflineInfo() {
  offlineReady = await trackerCached().catch(() => false);
  $('#offTracker').textContent = offlineReady ? 'Saved on this device' : (landmarker ? 'Not saved yet' : 'Not downloaded yet');
  showStorage();
}

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, button, summary, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); prompter.toggle(); }
  else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRecord(); }
});

// ---------------------------------------------------------------- start
// On phones the stage stays pinned; the panel tabs pin just below it.
new ResizeObserver(([entry]) => {
  const pinned = getComputedStyle(entry.target).position === 'sticky';
  document.documentElement.style.setProperty('--monitor-h', pinned ? entry.target.offsetHeight + 'px' : '0px');
}).observe($('.monitor'));

async function init() {
  applyFormat();
  buildEditor();
  renderLooks();
  prompter.setScript(script);
  applyPrompterSettings();
  updateMimeInfo();
  requestAnimationFrame(frame);
  renderClips();

  const controlled = await setupOffline();
  await loadTracker();
  if (controlled) {
    await refreshOfflineInfo();
    if (offlineReady) {
      setChip($('#offlineChip'), 'ok', 'Offline ready');
      navigator.storage?.persist?.().catch(() => {});
    } else {
      setChip($('#offlineChip'), 'warn', 'Not offline yet');
    }
  } else {
    setChip($('#offlineChip'), 'warn', 'Online only');
    $('#offTracker').textContent = 'This browser can’t keep files offline';
  }
}

window.addEventListener('online', () => { if (!landmarker) loadTracker(); });
init();

// for quick checks from the browser console
window.avatarStudio = { settings, get look() { return look; }, face, prompter };
