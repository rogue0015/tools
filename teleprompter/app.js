// app.js — camera, live canvas, recorder, teleprompter, saved scripts and clips.
// Recording works like Avatar Studio: every frame is drawn onto a canvas, and the
// canvas stream plus the microphone are combined into one MediaRecorder stream.
// The canvas lets us crop the camera to any format and mirror it if wanted.

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

// ---------------------------------------------------------------- saved state
const PREFIX = 'prompter-studio.';
const load = (key, fallback) => {
  try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const DEFAULT_SETTINGS = {
  mirrorPreview: true, flipRec: false, facing: 'user',
  size: 720, customW: 1280, customH: 720, fps: 30, vbitrate: 5, abitrate: 128, mime: 'auto',
  echoCancel: true, noiseSuppress: true, autoGain: true,
  lite: matchMedia('(pointer: coarse)').matches,
  format: matchMedia('(max-width: 700px)').matches ? 'portrait' : 'landscape',
  countdown: 3, recordMic: true, camId: '', micId: '', autoDownload: false,
  wpm: 140, promptSize: 26, promptPos: 'top', promptMirror: false, promptAuto: true, promptShow: true,
};
const settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
let script = load('script', SAMPLE_SCRIPT);
let scripts = load('scripts', []); // [{ id, name, text, updated }]
let scriptId = load('scriptId', '');

const saveSettings = debounce(() => save('settings', settings), 250);
const saveScript = debounce(() => save('script', script), 400);

// ---------------------------------------------------------------- elements
const canvas = $('#view');
const ctx = canvas.getContext('2d', { alpha: false });
const cam = document.createElement('video');
cam.muted = true;
cam.playsInline = true;
cam.setAttribute('playsinline', '');
// Kept in the page (but invisible) because some browsers stop updating a detached video.
cam.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
document.body.append(cam);

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

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg, action) {
  const box = $('#toast');
  $('#toastMsg').textContent = msg;
  const btn = $('#toastAction');
  btn.hidden = !action;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { box.hidden = true; action.run(); };
  }
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, action ? 9000 : 4200);
}

function setChip(chip, state, text) {
  chip.dataset.state = state;
  chip.textContent = text;
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
  if (recorder) return; // the canvas size is fixed while a take is running
  const [w, h] = outputSize();
  $('#sizeInfo').textContent = `${w} × ${h}` + (settings.lite ? ' · Lite' : '');
  $('#customSize').hidden = settings.format !== 'custom';
  $('#sizeOpts').hidden = settings.format === 'custom';
  canvas.width = w;
  canvas.height = h;
  document.documentElement.style.setProperty('--ar', `${w} / ${h}`);
  for (const b of $$('#formatOpts .opt')) b.setAttribute('aria-pressed', b.dataset.format === settings.format);
  prompter?.measure();
  paint();
}

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
  for (const b of $$('.opt[data-pos]')) b.setAttribute('aria-pressed', b.dataset.pos === settings.promptPos);
  updateScriptStats();
  requestAnimationFrame(() => prompter.measure());
}

function setWpm(v) {
  settings.wpm = clamp(Math.round(v / 5) * 5, 80, 220);
  saveSettings();
  applyPrompterSettings();
}

function setScriptText(text, { restart = true } = {}) {
  script = text;
  $('#scriptInput').value = script;
  prompter.setScript(script);
  if (restart) prompter.restart();
  updateScriptStats();
  saveScript();
}

$('#scriptInput').value = script;
$('#scriptInput').addEventListener('input', e => {
  script = e.target.value;
  prompter.setScript(script);
  updateScriptStats();
  saveScript();
  renderScriptLib();
});
$('#exportScriptBtn').addEventListener('click', () => {
  const name = (currentScript()?.name || 'script').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'script';
  downloadBlob(new Blob([script], { type: 'text/plain;charset=utf-8' }), `${name}.txt`);
  toast(`Script exported as ${name}.txt.`);
});
$('#scriptFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    setScriptText(await file.text());
    scriptId = ''; save('scriptId', scriptId);
    $('#scriptName').value = file.name.replace(/\.txt$/i, '');
    renderScriptLib();
    toast(`Loaded ${file.name}. Press Save script to keep it in the list.`);
  } catch {
    toast('Could not read that file. Choose a plain text .txt script.');
  }
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

// ---------------------------------------------------------------- saved scripts
const currentScript = () => scripts.find(s => s.id === scriptId);

function renderScriptLib() {
  const sel = $('#scriptPick');
  const cur = currentScript();
  const edited = cur && cur.text !== script;
  sel.replaceChildren(el('option', { value: '' }, scripts.length ? '— Unsaved script —' : 'No saved scripts yet'));
  for (const s of [...scripts].sort((a, b) => a.name.localeCompare(b.name))) {
    sel.append(el('option', { value: s.id }, s.id === scriptId && edited ? `${s.name} (edited)` : s.name));
  }
  sel.value = cur ? cur.id : '';
  $('#deleteScriptBtn').disabled = !cur;
  $('#saveScriptBtn').textContent = cur && $('#scriptName').value.trim() === cur.name ? 'Update script' : 'Save script';
}

$('#scriptPick').addEventListener('change', e => {
  const s = scripts.find(x => x.id === e.target.value);
  if (!s) { scriptId = ''; save('scriptId', ''); $('#scriptName').value = ''; renderScriptLib(); return; }
  scriptId = s.id;
  save('scriptId', scriptId);
  $('#scriptName').value = s.name;
  setScriptText(s.text);
  renderScriptLib();
  toast(`Loaded “${s.name}”.`);
});
$('#scriptName').addEventListener('input', renderScriptLib);
$('#saveScriptBtn').addEventListener('click', () => {
  const name = $('#scriptName').value.trim() || `Script ${scripts.length + 1}`;
  let s = scripts.find(x => x.name === name);
  const updating = !!s;
  if (s) Object.assign(s, { text: script, updated: Date.now() });
  else scripts.push(s = { id: 'script-' + Date.now(), name, text: script, updated: Date.now() });
  scriptId = s.id;
  $('#scriptName').value = name;
  save('scripts', scripts);
  save('scriptId', scriptId);
  renderScriptLib();
  toast(updating ? `Updated “${name}”.` : `Saved “${name}”.`);
});
let delScriptTimer;
$('#deleteScriptBtn').addEventListener('click', () => {
  const btn = $('#deleteScriptBtn');
  const s = currentScript();
  if (!s) return;
  if (btn.dataset.armed !== 'true') {
    btn.dataset.armed = 'true';
    btn.textContent = 'Tap again to delete';
    delScriptTimer = setTimeout(() => { btn.dataset.armed = 'false'; btn.textContent = 'Delete'; }, 3500);
    return;
  }
  clearTimeout(delScriptTimer);
  btn.dataset.armed = 'false';
  btn.textContent = 'Delete';
  scripts = scripts.filter(x => x.id !== s.id);
  scriptId = '';
  save('scripts', scripts);
  save('scriptId', '');
  $('#scriptName').value = '';
  renderScriptLib();
  toast(`Deleted “${s.name}”. The text is still in the editor.`);
});
$('#newScriptBtn').addEventListener('click', () => {
  scriptId = '';
  save('scriptId', '');
  $('#scriptName').value = '';
  setScriptText('');
  renderScriptLib();
  $('#scriptInput').focus();
});

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
  for (const b of buttons) b.addEventListener('click', () => {
    if (recorder) { toast('Stop recording before changing the recording settings.'); return; }
    settings[key] = parse(b.dataset[attr]); sync(); saveSettings(); after?.();
  });
  sync();
}
const restartCamera = () => { if (camOn && !recorder) startCamera(); };
bindToggle('mirrorPreview', 'mirrorPreview', applyMirror);
bindToggle('flipRec', 'flipRec', applyMirror);
bindToggle('recordMic', 'recordMic', updateMimeInfo);
bindToggle('autoDownload', 'autoDownload');
bindOpts('#formatOpts', 'format', 'format', String, applyFormat);
bindOpts('#sizeOpts', 'size', 'size', Number, () => { applyFormat(); restartCamera(); });
bindOpts('#fpsOpts', 'fps', 'fps', Number, restartCamera);
bindOpts('#abitrateOpts', 'abitrate', 'abitrate', Number);
bindOpts('#countdownOpts', 'countdown', 'countdown', Number);
bindRange('vbitrate', 'vbitrate', v => v + ' Mbps');
bindToggle('lite', 'lite', () => { applyFormat(); restartCamera(); });
for (const id of ['echoCancel', 'noiseSuppress', 'autoGain']) bindToggle(id, id, restartCamera);
for (const id of ['customW', 'customH']) {
  const input = $('#' + id);
  input.value = settings[id];
  input.addEventListener('change', () => { settings[id] = even(clamp(+input.value || 720, 240, 3840)); input.value = settings[id]; saveSettings(); applyFormat(); });
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

// ---------------------------------------------------------------- camera + mic
let stream = null;
let camOn = false;
let isFront = true;
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

// Ask for a camera picture big enough for the output, in landscape terms
// (phones rotate it themselves).
function cameraConstraints() {
  const [w, h] = outputSize();
  const long = Math.max(w, h), short = Math.min(w, h);
  const video = {
    width: { ideal: Math.max(640, long) },
    height: { ideal: Math.max(480, short) },
    frameRate: { ideal: recFps() },
  };
  if (settings.camId) video.deviceId = { exact: settings.camId };
  else video.facingMode = settings.facing;
  return video;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { toast(cameraError()); return false; }
  stopCamera();
  const video = cameraConstraints();
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
  const vt = stream.getVideoTracks()[0];
  const facing = vt?.getSettings?.().facingMode;
  isFront = facing ? facing === 'user' : (settings.camId ? !/back|rear|environment/i.test(vt?.label || '') : settings.facing === 'user');
  cam.srcObject = stream;
  try { await cam.play(); } catch { /* muted autoplay is allowed; ignore */ }
  camOn = true;
  setupMeter();
  updateCamUI();
  applyMirror();
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
  paint();
}

function updateCamUI() {
  $('#camBtn').setAttribute('aria-pressed', camOn);
  $('#camBtn .lbl').textContent = camOn ? 'Camera on' : 'Camera';
  $('#stageEmpty').hidden = camOn;
  const chip = $('#camChip');
  chip.hidden = !camOn;
  if (camOn) {
    const s = stream?.getVideoTracks()[0]?.getSettings?.() || {};
    const res = s.width && s.height ? `${s.width}×${s.height}` : 'Camera on';
    setChip(chip, stream?.getAudioTracks().length ? 'ok' : 'warn', `${isFront ? 'Front' : 'Back'} · ${res}${stream?.getAudioTracks().length ? '' : ' · no mic'}`);
  }
}

// The canvas is what gets recorded. Front-camera preview is mirrored on screen
// with CSS, so mirroring the recording too means not flipping it on screen.
const recMirrored = () => isFront && settings.flipRec;
function applyMirror() {
  const showMirrored = isFront && settings.mirrorPreview;
  canvas.classList.toggle('mirror', showMirrored !== recMirrored());
  paint();
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
    fill('#camSelect', 'videoinput', settings.facing === 'user' ? 'Front camera' : 'Back camera', 'camId');
    fill('#micSelect', 'audioinput', 'Default microphone', 'micId');
  } catch { /* device list unavailable */ }
}
$('#camSelect').addEventListener('change', e => { settings.camId = e.target.value; saveSettings(); restartCamera(); });
$('#micSelect').addEventListener('change', e => { settings.micId = e.target.value; saveSettings(); restartCamera(); });
$('#camBtn').addEventListener('click', () => {
  if (recorder) { toast('Stop recording before turning the camera off.'); return; }
  camOn ? stopCamera() : startCamera();
});
$('#flipBtn').addEventListener('click', async () => {
  if (recorder) { toast('Stop recording before switching cameras.'); return; }
  settings.facing = settings.facing === 'user' ? 'environment' : 'user';
  settings.camId = '';
  saveSettings();
  if (camOn) await startCamera();
  else toast(`${settings.facing === 'user' ? 'Front' : 'Back'} camera selected.`);
});

// ---------------------------------------------------------------- drawing
// Crop the camera from the centre so it fills the canvas (like object-fit: cover).
function paint() {
  const W = canvas.width, H = canvas.height;
  if (!camOn || cam.readyState < 2 || !cam.videoWidth) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const vw = cam.videoWidth, vh = cam.videoHeight;
  const k = Math.max(W / vw, H / vh);
  const sw = W / k, sh = H / k;
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  ctx.save();
  if (recMirrored()) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(cam, sx, sy, sw, sh, 0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------- render loop
let lastT = performance.now();
let frameRequest = 0, lastPaint = 0, lastUiUpdate = 0, lastMicRead = 0;

function scheduleFrame() {
  if (!frameRequest && !document.hidden) frameRequest = requestAnimationFrame(frame);
}

function frame(t) {
  frameRequest = 0;
  if (document.hidden) return;
  scheduleFrame();
  const dt = Math.min(0.1, (t - lastT) / 1000);
  lastT = t;
  if (t - lastMicRead >= 1000 / 30) { readMic(); lastMicRead = t; }

  // paint a little faster than the target so captureStream never misses a frame
  const paintFps = recorder ? recFps() : 30;
  if (camOn && (!lastPaint || t - lastPaint >= 1000 / paintFps - 2)) {
    paint();
    lastPaint = t;
  }
  prompter.tick(dt);
  if (t - lastUiUpdate >= 100) {
    $('#meter').style.width = (micLevel * 100).toFixed(1) + '%';
    if (recorder) updateTimecode();
    lastUiUpdate = t;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { lastT = performance.now(); scheduleFrame(); }
});

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
  const fps = recFps();
  const totalFrames = Math.floor((ms / 1000) * fps);
  const ff = totalFrames % fps;
  const s = Math.floor(totalFrames / fps);
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
  if (!camOn && !(await startCamera())) return;
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
  paint();
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
  const cur = currentScript();
  const take = rec = {
    id: 'take-' + Date.now(),
    seq: 0,
    chunks: [],
    startedAt: performance.now(),
    pausedTotal: 0,
    pausedAt: 0,
    meta: { started: Date.now(), width: canvas.width, height: canvas.height },
    scriptName: cur && cur.text === script ? cur.name : '',
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
  applyFormat(); // pick up any size change made while recording
}

async function finishTake(take, r) {
  for (const t of take.vStream.getVideoTracks()) t.stop();
  const type = (r.mimeType || 'video/webm').split(';')[0];
  const blob = new Blob(take.chunks, { type });
  const clipCount = await store.countClips().catch(() => 0);
  const clip = {
    id: take.id,
    name: take.scriptName ? `${take.scriptName} · Take ${clipCount + 1}` : `Take ${clipCount + 1}`,
    created: take.meta.started,
    duration: take.duration || 0,
    mime: type,
    size: blob.size,
    width: take.meta.width,
    height: take.meta.height,
    script: take.scriptName,
    blob,
    thumb: take.thumb || null,
  };
  if (rec === take) rec = null;
  $('#timecode').textContent = timecode(0);
  if (settings.autoDownload) downloadBlob(blob, fileName(clip));
  try {
    await store.saveClip(clip);
    await store.deleteChunks(take.id);
    navigator.storage?.persist?.().catch(() => {});
    toast(`${clip.name} saved · ${timecode(clip.duration).slice(3, 8)}`, { label: 'View', run: () => { if (phone.matches) setSheet(true); showTab('clips'); } });
  } catch (err) {
    console.error(err);
    toast('This device is out of storage space, so the take wasn’t saved in the app. Download it now.', {
      label: 'Download', run: () => downloadBlob(blob, fileName(clip)),
    });
  }
  if (!$('#pane-clips').hidden) renderClips();
  else refreshClipCount();
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
  return `prompter-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${ext}`;
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

async function refreshClipCount() {
  try {
    const count = await store.countClips();
    $('#clipCount').textContent = count || '';
  } catch { /* renderClips shows storage errors when opened */ }
}

function renameControl(clip, title) {
  const btn = el('button', { type: 'button', class: 'btn small' }, 'Rename');
  btn.addEventListener('click', () => {
    const input = el('input', { type: 'text', value: clip.name, maxlength: '80', 'aria-label': 'Take name' });
    title.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async keep => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (keep && name && name !== clip.name) {
        clip.name = name;
        try { await store.saveClip(clip); } catch { toast('The new name couldn’t be saved.'); }
      }
      title.textContent = clip.name;
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  });
  return btn;
}

async function renderClips() {
  let clips = [], pending = [];
  try {
    [clips, pending] = await Promise.all([store.listClips(), store.pendingTakes()]);
  } catch {
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
    rescue.append(el('div', { class: 'banner' },
      el('div', {}, el('strong', {}, 'Unfinished take found. '), `Recorded ${when}, about ${p.chunks} s, ${mb(p.bytes)}.`),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn small primary', onclick: () => recoverTake(p) }, 'Recover it'),
        el('button', { type: 'button', class: 'btn small danger', onclick: async () => { await store.deleteChunks(p.rec); renderClips(); } }, 'Discard'))));
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
    const title = el('div', { class: 'clip-title' }, clip.name);
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
    actions.append(renameControl(clip, title));
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
      title,
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
    const clipCount = await store.countClips();
    await store.saveClip({
      id: p.rec, name: `Take ${clipCount + 1} (recovered)`, created: p.started || Date.now(),
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
    await navigator.serviceWorker.ready;
    return true;
  } catch (err) {
    console.warn('Offline mode unavailable', err);
    return false;
  }
}

async function refreshOfflineInfo() {
  const ready = !!(await navigator.serviceWorker?.getRegistration?.().catch(() => null))?.active;
  $('#offApp').textContent = ready ? 'Saved on this device' : 'Not saved yet';
  setChip($('#offlineChip'), ready ? 'ok' : 'warn', ready ? 'Offline ready' : 'Online only');
  showStorage();
}

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, button, summary, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); prompter.toggle(); }
  else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRecord(); }
});

// ---------------------------------------------------------------- start
new ResizeObserver(([entry]) => {
  const pinned = getComputedStyle(entry.target).position === 'sticky';
  document.documentElement.style.setProperty('--monitor-h', pinned ? entry.target.offsetHeight + 'px' : '0px');
}).observe($('.monitor'));

async function init() {
  applyFormat();
  if (currentScript()) $('#scriptName').value = currentScript().name;
  prompter.setScript(script);
  applyPrompterSettings();
  renderScriptLib();
  updateMimeInfo();
  applyMirror();
  scheduleFrame();
  refreshClipCount();
  if (await setupOffline()) await refreshOfflineInfo();
  else { setChip($('#offlineChip'), 'warn', 'Online only'); $('#offApp').textContent = 'This browser can’t keep files offline'; }
}
init();

// for quick checks from the browser console
window.prompterStudio = { settings, prompter };
