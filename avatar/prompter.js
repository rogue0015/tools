// prompter.js — a scrolling script that sits over the stage.
// It is page content, not canvas content, so it never appears in the video.

export const SAMPLE_SCRIPT = `Hi, welcome back to the channel.

[smile]

Today I'm showing you how I record these videos with an animated avatar, straight from my phone.

The face tracking runs on the device, so once the app has loaded you can switch off your data and keep recording.

[pause]

Lines in square brackets are cues for you. They show in a different colour and you don't read them out.

Let's get into it.`;

const escapeHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function countWords(text) {
  return text.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean).length;
}

export class Prompter {
  constructor({ root, viewport, content, onState }) {
    this.root = root;
    this.viewport = viewport;
    this.content = content;
    this.onState = onState || (() => {});
    this.offset = 0;
    this.playing = false;
    this.wpm = 140;
    this.words = 0;
    this.pxPerWord = 0;
    new ResizeObserver(() => this.measure()).observe(content);
    new ResizeObserver(() => this.measure()).observe(viewport);
  }

  setScript(text) {
    const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    this.content.innerHTML = paras.map(p => {
      const html = escapeHtml(p).replace(/\[([^\]]*)\]/g, '<span class="cue">[$1]</span>').replace(/\n/g, '<br>');
      return `<p>${html}</p>`;
    }).join('') || '<p class="cue">Your script is empty. Write it in the Prompter tab.</p>';
    this.words = Math.max(1, countWords(text));
    this.measure();
  }

  // The content has spacer padding so the first line starts on the reading
  // line and the last line can scroll up to it. Speed uses the text height only.
  measure() {
    const cs = getComputedStyle(this.content);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const total = this.content.offsetHeight;
    this.maxOffset = Math.max(0, total - this.viewport.clientHeight);
    this.pxPerWord = Math.max(0, total - pad) / this.words;
    this.offset = Math.min(this.offset, this.maxOffset);
    this.apply();
  }

  // Seconds to read the whole script at the current speed.
  duration() { return (this.words / this.wpm) * 60; }

  setWpm(wpm) { this.wpm = wpm; }

  play() {
    if (this.offset >= this.maxOffset) this.offset = 0;
    this.playing = true;
    this.onState(this);
  }
  pause() { this.playing = false; this.onState(this); }
  toggle() { this.playing ? this.pause() : this.play(); }
  restart() { this.offset = 0; this.apply(); this.onState(this); }
  nudge(px) { this.offset = Math.max(0, Math.min(this.maxOffset, this.offset + px)); this.apply(); }

  tick(dt) {
    if (!this.playing) return;
    this.offset += (this.wpm / 60) * this.pxPerWord * dt;
    if (this.offset >= this.maxOffset) {
      this.offset = this.maxOffset;
      this.playing = false;
      this.onState(this);
    }
    this.apply();
  }

  apply() {
    this.content.style.transform = `translateY(${-this.offset}px)`;
  }
}
