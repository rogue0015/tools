// tracker.js — MediaPipe Face Landmarker, and turning its output into
// the avatar's expression state.

import { NEUTRAL } from './avatar.js';

// MediaPipe tasks-vision, loaded from the web on first use, then kept offline by sw.js.
// The versions are pinned, so the cached copies never go stale.
const MP_VERSION = '1.1.1';
export const ASSETS = {
  bundle: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`,
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
  model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

// opts.delegate: 'auto' | 'GPU' | 'CPU'; opts.conf: detection confidence 0.2–0.9
export async function createLandmarker(opts = {}) {
  const conf = opts.conf ?? 0.5;
  const { FilesetResolver, FaceLandmarker } = await import(ASSETS.bundle);
  const fileset = await FilesetResolver.forVisionTasks(ASSETS.wasm);
  const options = delegate => ({
    baseOptions: { modelAssetPath: ASSETS.model, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
    minFaceDetectionConfidence: conf,
    minFacePresenceConfidence: conf,
    minTrackingConfidence: conf,
  });
  if (opts.delegate === 'CPU') return { landmarker: await FaceLandmarker.createFromOptions(fileset, options('CPU')), delegate: 'CPU' };
  if (opts.delegate === 'GPU') return { landmarker: await FaceLandmarker.createFromOptions(fileset, options('GPU')), delegate: 'GPU' };
  try {
    return { landmarker: await FaceLandmarker.createFromOptions(fileset, options('GPU')), delegate: 'GPU' };
  } catch (err) {
    console.warn('GPU delegate failed, using CPU', err);
    return { landmarker: await FaceLandmarker.createFromOptions(fileset, options('CPU')), delegate: 'CPU' };
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const remap = (v, lo, hi) => clamp(((v || 0) - lo) / (hi - lo), 0, 1);

// Landmark indices on the 478-point face mesh
const EYE_OUTER_R = 33, EYE_OUTER_L = 263, NOSE_TIP = 1, CHEEK_R = 234, CHEEK_L = 454, FOREHEAD = 10, CHIN = 152;

export class FaceSolver {
  constructor() {
    this.state = { ...NEUTRAL };
    this.recenter();
  }

  // Forget the neutral pose; the next ~20 frames set a new one.
  recenter() {
    this.neutral = null;
    this.samples = [];
  }

  // Raw head pose in "mirror" space: +x is the viewer's right.
  measure(lm, aspect) {
    const P = i => ({ x: (1 - lm[i].x) * aspect, y: lm[i].y });
    const eL = P(EYE_OUTER_L), eR = P(EYE_OUTER_R);
    const a = eL.x < eR.x ? eL : eR, b = eL.x < eR.x ? eR : eL;
    const roll = Math.atan2(b.y - a.y, b.x - a.x);
    const cL = P(CHEEK_L), cR = P(CHEEK_R), nose = P(NOSE_TIP);
    const left = Math.min(cL.x, cR.x), right = Math.max(cL.x, cR.x);
    const yaw = (nose.x - (left + right) / 2) / ((right - left) / 2 || 1);
    const top = P(FOREHEAD), chin = P(CHIN);
    const ratio = (nose.y - top.y) / ((chin.y - top.y) || 1);
    const cx = (a.x + b.x) / 2 / aspect, cy = (a.y + b.y) / 2;
    return { roll, yaw, ratio, cx, cy };
  }

  // result: FaceLandmarkerResult. Returns true when a face was found.
  update(result, cfg, aspect) {
    const lm = result?.faceLandmarks?.[0];
    const cats = result?.faceBlendshapes?.[0]?.categories;
    if (!lm || !cats) return false;
    const bs = {};
    for (const c of cats) bs[c.categoryName] = c.score;

    const m = this.measure(lm, aspect);
    if (!this.neutral) {
      this.samples.push(m);
      if (this.samples.length >= 20) {
        const avg = k => this.samples.reduce((s, x) => s + x[k], 0) / this.samples.length;
        this.neutral = { roll: avg('roll'), yaw: avg('yaw'), ratio: avg('ratio'), cx: avg('cx'), cy: avg('cy') };
      }
    }
    const n = this.neutral || { roll: 0, yaw: 0, ratio: 0.6, cx: 0.5, cy: 0.45 };

    const g = cfg.expression;   // expression strength
    const hg = cfg.headMotion;  // head movement strength
    const sens = cfg.sens || {};
    const k = name => sens[name] ?? 1;
    const e = (v, lo, hi, name) => clamp(remap(v, lo, hi) * g * k(name), 0, 1.2);

    // Blendshape Left/Right refer to your own face. In mirror space your left
    // side is on the viewer's left, so Left drives the avatar's screen-left.
    const t = {
      blinkL: e(bs.eyeBlinkLeft, 0.22, 0.62, 'blink'),
      blinkR: e(bs.eyeBlinkRight, 0.22, 0.62, 'blink'),
      wideL: e(bs.eyeWideLeft, 0.12, 0.6, 'wide'),
      wideR: e(bs.eyeWideRight, 0.12, 0.6, 'wide'),
      squintL: e(bs.eyeSquintLeft, 0.35, 0.85, 'squint'),
      squintR: e(bs.eyeSquintRight, 0.35, 0.85, 'squint'),
      lookX: clamp((((bs.eyeLookInLeft || 0) - (bs.eyeLookOutLeft || 0)) + ((bs.eyeLookOutRight || 0) - (bs.eyeLookInRight || 0))) * 1.1 * k('gaze'), -1, 1),
      lookY: clamp((((bs.eyeLookDownLeft || 0) + (bs.eyeLookDownRight || 0)) - ((bs.eyeLookUpLeft || 0) + (bs.eyeLookUpRight || 0))) * 0.9 * k('gaze'), -1, 1),
      browInner: e(bs.browInnerUp, 0.12, 0.75, 'brows'),
      browOuterL: e(bs.browOuterUpLeft, 0.1, 0.7, 'brows'),
      browOuterR: e(bs.browOuterUpRight, 0.1, 0.7, 'brows'),
      browDownL: e(bs.browDownLeft, 0.08, 0.6, 'brows'),
      browDownR: e(bs.browDownRight, 0.08, 0.6, 'brows'),
      jaw: e(bs.jawOpen, 0.04, 0.62, 'jaw'),
      smileL: e(bs.mouthSmileLeft, 0.06, 0.72, 'smile'),
      smileR: e(bs.mouthSmileRight, 0.06, 0.72, 'smile'),
      frown: e(((bs.mouthFrownLeft || 0) + (bs.mouthFrownRight || 0)) / 2, 0.05, 0.45, 'frown'),
      pucker: e(bs.mouthPucker, 0.25, 0.9, 'pucker'),
      funnel: e(bs.mouthFunnel, 0.12, 0.6, 'pucker'),
      mouthX: clamp(((bs.mouthRight || 0) - (bs.mouthLeft || 0)) * 2.4 * k('mouthSide'), -1, 1),
      cheekPuff: e(bs.cheekPuff, 0.12, 0.6, 'cheek'),
      yaw: clamp(((m.yaw - n.yaw) / 0.55) * hg * (cfg.yawGain ?? 1), -1, 1),
      pitch: clamp(((n.ratio - m.ratio) / 0.12) * hg * (cfg.pitchGain ?? 1), -1, 1),
      roll: clamp((m.roll - n.roll) * hg * (cfg.rollGain ?? 1), -0.7, 0.7),
      tx: clamp((m.cx - n.cx) * 3 * cfg.follow, -1, 1),
      ty: clamp((m.cy - n.cy) * 3 * cfg.follow, -1, 1),
    };

    if (cfg.linkBlinks) {
      // both eyes blink together (stops a lazy eye or a half-closed lid looking like a wink)
      t.blinkL = t.blinkR = Math.max(t.blinkL, t.blinkR) > 0.6 ? Math.max(t.blinkL, t.blinkR) : (t.blinkL + t.blinkR) / 2;
    }
    if (!cfg.mirror) {
      // "As the camera sees it": swap sides and flip horizontal motion.
      for (const [a, b] of [['blinkL', 'blinkR'], ['wideL', 'wideR'], ['squintL', 'squintR'], ['browOuterL', 'browOuterR'], ['browDownL', 'browDownR'], ['smileL', 'smileR']]) {
        [t[a], t[b]] = [t[b], t[a]];
      }
      for (const k of ['lookX', 'mouthX', 'yaw', 'roll', 'tx']) t[k] = -t[k];
    }

    // Smoothing: blinks stay snappy, head pose is calmer.
    const sm = clamp(cfg.smoothing, 0, 1);
    const aPose = 0.6 - sm * 0.48, aExpr = 0.8 - sm * 0.5, aBlink = 0.92 - sm * 0.35;
    const s = this.state;
    for (const k in t) {
      const a = k.startsWith('blink') ? aBlink : (['yaw', 'pitch', 'roll', 'tx', 'ty'].includes(k) ? aPose : aExpr);
      s[k] += (t[k] - s[k]) * a;
    }
    return true;
  }
}
