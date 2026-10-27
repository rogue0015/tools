/* QR Code Generator - UI logic.
   Encoding comes from qrcode-generator (qrcode.min.js, MIT).
   Everything here turns the module matrix into a coloured canvas / SVG. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    url: $('url'), urlHint: $('urlHint'),
    fg: $('fg'), fgHex: $('fgHex'), fgSwatches: $('fgSwatches'),
    bg: $('bg'), bgHex: $('bgHex'), bgSwatches: $('bgSwatches'),
    transparent: $('transparent'),
    eyeSame: $('eyeSame'), eyeWrap: $('eyeWrap'), eye: $('eye'), eyeHex: $('eyeHex'),
    contrastNote: $('contrastNote'),
    shape: $('shape'),
    size: $('size'), sizeOut: $('sizeOut'),
    margin: $('margin'), marginOut: $('marginOut'),
    ecl: $('ecl'),
    logoOn: $('logoOn'), logoWrap: $('logoWrap'), logoFile: $('logoFile'),
    logoSize: $('logoSize'), logoSizeOut: $('logoSizeOut'),
    logoPad: $('logoPad'),
    canvas: $('canvas'), verdict: $('verdict'), verdictText: $('verdictText'),
    saveImg: $('saveImg'), copySvg: $('copySvg'),
    metaVersion: $('metaVersion'), metaModules: $('metaModules'), metaSize: $('metaSize'),
    dlPng: $('dlPng'), dlSvg: $('dlSvg'), copyBtn: $('copyBtn'), statusNote: $('statusNote')
  };

  var state = {
    shape: 'square',
    logoImg: null,       // HTMLImageElement, ready to draw
    logoSrc: null,       // data: URI, needed for SVG export
    eclBeforeLogo: null,
    plan: null           // last successful render plan
  };

  /* ----------------------------------------------------------- helpers -- */

  function normalizeUrl(raw) {
    var v = raw.trim();
    if (!v) return { text: '', added: false, kind: 'empty' };
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(v)) return { text: v, added: false, kind: 'url' };
    if (/^[^\s/]+\.[a-zA-Z]{2,}(\/|$|\?|#)/.test(v)) return { text: 'https://' + v, added: true, kind: 'url' };
    return { text: v, added: false, kind: 'text' };
  }

  function normHex(v) {
    v = String(v).trim();
    if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  }

  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) {
      var x = parseInt(hex.substr(i, 2), 16) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function n(x) { return Math.round(x * 100) / 100; }

  /* Rounded rectangle as SVG path data. r === w/2 === h/2 gives a circle,
     so every shape below (square, rounded, dot) comes from this one function. */
  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0.01) {
      return 'M' + n(x) + ' ' + n(y) + 'h' + n(w) + 'v' + n(h) + 'h' + n(-w) + 'Z';
    }
    var a = 'a' + n(r) + ' ' + n(r) + ' 0 0 1 ';
    return 'M' + n(x + r) + ' ' + n(y) +
      'h' + n(w - 2 * r) + a + n(r) + ' ' + n(r) +
      'v' + n(h - 2 * r) + a + n(-r) + ' ' + n(r) +
      'h' + n(-(w - 2 * r)) + a + n(-r) + ' ' + n(-r) +
      'v' + n(-(h - 2 * r)) + a + n(r) + ' ' + n(-r) + 'Z';
  }

  function setEnabled(on) {
    [el.dlPng, el.dlSvg, el.copyBtn, el.copySvg].forEach(function (b) {
      if (b) b.disabled = !on;
    });
  }

  function note(node, msg, ok) {
    if (!msg) { node.className = 'note'; node.textContent = ''; return; }
    node.className = 'note show' + (ok ? ' ok' : '');
    node.textContent = msg;
  }

  /* -------------------------------------------------------- the QR plan -- */

  function readOptions() {
    var fg = normHex(el.fg.value) || '#000000';
    return {
      raw: el.url.value,
      fg: fg,
      bg: normHex(el.bg.value) || '#ffffff',
      transparent: el.transparent.checked,
      eye: el.eyeSame.checked ? fg : (normHex(el.eye.value) || fg),
      shape: state.shape,
      size: parseInt(el.size.value, 10),
      margin: parseInt(el.margin.value, 10),
      ecl: el.ecl.value,
      logo: el.logoOn.checked && state.logoImg ? {
        img: state.logoImg, src: state.logoSrc,
        scale: parseInt(el.logoSize.value, 10) / 100,
        pad: el.logoPad.checked
      } : null
    };
  }

  /* Builds a resolution-independent list of fill operations. Both the canvas
     and the SVG exporter consume exactly this, so they cannot drift apart. */
  function buildPlan(opt) {
    var norm = normalizeUrl(opt.raw);
    if (!norm.text) return { error: 'Enter a URL to generate a code.', norm: norm };

    var qr = qrcode(0, opt.ecl);
    qr.addData(norm.text);
    qr.make();

    var count = qr.getModuleCount();
    var total = count + opt.margin * 2;
    // Whole pixels per module keeps every edge crisp, so the export lands on
    // the nearest size that divides evenly rather than exactly what was asked.
    var cell = Math.max(1, Math.round(opt.size / total));
    var dim = cell * total;
    var off = opt.margin * cell;

    var isFinder = function (r, c) {
      return (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
    };

    /* Alignment patterns (version 2 and up) are found by shape rather than by
       carrying a 40-row position table: a 5x5 box of dark ring / light ring /
       dark centre only occurs where one lives. Like the finders they must keep
       their solid outline or scanners lose the perspective grid. */
    var aligns = [], skip = null;
    if (count > 21 && opt.shape !== 'square') {
      for (var ar = 2; ar < count - 2; ar++) {
        for (var ac = 2; ac < count - 2; ac++) {
          if (isFinder(ar, ac)) continue;
          var hit = true;
          for (var dr = -2; dr <= 2 && hit; dr++) {
            for (var dc = -2; dc <= 2 && hit; dc++) {
              var ring = Math.max(Math.abs(dr), Math.abs(dc));
              if (qr.isDark(ar + dr, ac + dc) !== (ring === 0 || ring === 2)) hit = false;
            }
          }
          if (hit) aligns.push([ar, ac]);
        }
      }
      if (aligns.length) {
        skip = {};
        aligns.forEach(function (a) {
          for (var dr2 = -2; dr2 <= 2; dr2++) {
            for (var dc2 = -2; dc2 <= 2; dc2++) skip[(a[0] + dr2) * count + (a[1] + dc2)] = 1;
          }
        });
      }
    }

    // --- data modules -----------------------------------------------------
    var moduleR = opt.shape === 'dots' ? cell / 2 : (opt.shape === 'rounded' ? cell * 0.28 : 0);
    var inset = opt.shape === 'dots' ? cell * 0.03 : 0;   // hair of air between dots
    var d = '';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c) || isFinder(r, c)) continue;
        if (skip && skip[r * count + c]) continue;
        d += rrect(off + c * cell + inset, off + r * cell + inset,
                   cell - 2 * inset, cell - 2 * inset, moduleR);
      }
    }

    var ops = [];
    if (d) ops.push({ d: d, color: opt.fg });

    // --- the three finder patterns, drawn as ring + pupil ------------------
    // The finder patterns stay square-ish on purpose. Scanners look for a
    // 1:1:3:1:1 dark/light run through them, and fully circular eyes break
    // that ratio on every scan line but the middle one - the code stops
    // reading. Rounded corners are as far as this can safely go.
    var outerR, holeR, pupilR;
    if (opt.shape === 'square') { outerR = 0; holeR = 0; pupilR = 0; }
    else { outerR = cell * 2; holeR = cell * 1.25; pupilR = cell * 0.9; }

    var rings = '', pupils = '';
    [[0, 0], [0, count - 7], [count - 7, 0]].forEach(function (p) {
      var x = off + p[1] * cell, y = off + p[0] * cell;
      rings += rrect(x, y, cell * 7, cell * 7, outerR);
      rings += rrect(x + cell, y + cell, cell * 5, cell * 5, holeR);   // punched out
      pupils += rrect(x + cell * 2, y + cell * 2, cell * 3, cell * 3, pupilR);
    });
    ops.push({ d: rings, color: opt.eye, evenodd: true });
    ops.push({ d: pupils, color: opt.eye });

    // --- alignment patterns, kept solid -----------------------------------
    if (aligns.length) {
      var aRing = '', aDot = '';
      aligns.forEach(function (a) {
        var x = off + (a[1] - 2) * cell, y = off + (a[0] - 2) * cell;
        aRing += rrect(x, y, cell * 5, cell * 5, cell * 1.4);
        aRing += rrect(x + cell, y + cell, cell * 3, cell * 3, cell * 0.85);
        aDot += rrect(x + cell * 2, y + cell * 2, cell, cell,
                      opt.shape === 'dots' ? cell / 2 : cell * 0.28);
      });
      ops.push({ d: aRing, color: opt.fg, evenodd: true });
      ops.push({ d: aDot, color: opt.fg });
    }

    // --- logo -------------------------------------------------------------
    var logo = null;
    if (opt.logo) {
      var box = Math.round(dim * opt.logo.scale);
      var lx = Math.round((dim - box) / 2), ly = lx;
      if (opt.logo.pad) {
        var pad = Math.max(cell, Math.round(box * 0.08));
        ops.push({
          d: rrect(lx - pad, ly - pad, box + 2 * pad, box + 2 * pad, Math.round(box * 0.14)),
          color: opt.transparent ? '#ffffff' : opt.bg
        });
      }
      logo = { x: lx, y: ly, w: box, h: box, img: opt.logo.img, src: opt.logo.src };
    }

    return {
      ops: ops, logo: logo, dim: dim, cell: cell, shape: opt.shape, margin: opt.margin,
      bg: opt.transparent ? null : opt.bg,
      version: (count - 17) / 4, count: count, norm: norm
    };
  }

  /* ------------------------------------------------------------ renderers -- */

  function paint(plan) {
    var cv = el.canvas;
    cv.width = plan.dim;
    cv.height = plan.dim;
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, plan.dim, plan.dim);
    if (plan.bg) { ctx.fillStyle = plan.bg; ctx.fillRect(0, 0, plan.dim, plan.dim); }
    plan.ops.forEach(function (op) {
      ctx.fillStyle = op.color;
      ctx.fill(new Path2D(op.d), op.evenodd ? 'evenodd' : 'nonzero');
    });
    if (plan.logo) {
      ctx.drawImage(plan.logo.img, plan.logo.x, plan.logo.y, plan.logo.w, plan.logo.h);
    }
  }

  function toSVG(plan) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + plan.dim + '" height="' + plan.dim +
      '" viewBox="0 0 ' + plan.dim + ' ' + plan.dim + '" shape-rendering="' +
      (plan.shape === 'square' ? 'crispEdges' : 'geometricPrecision') + '">';
    if (plan.bg) s += '<rect width="' + plan.dim + '" height="' + plan.dim + '" fill="' + plan.bg + '"/>';
    plan.ops.forEach(function (op) {
      s += '<path d="' + op.d + '" fill="' + op.color + '"' +
        (op.evenodd ? ' fill-rule="evenodd"' : '') + '/>';
    });
    if (plan.logo && plan.logo.src) {
      s += '<image href="' + plan.logo.src + '" x="' + plan.logo.x + '" y="' + plan.logo.y +
        '" width="' + plan.logo.w + '" height="' + plan.logo.h + '"/>';
    }
    return s + '</svg>';
  }

  /* ------------------------------------------------------- self-checking -- */

  /* Reads the code back with a real decoder (jsQR) at roughly the resolution a
     phone camera sees, so the verdict is a measurement rather than a guess.
     Anything transparent is flattened onto white first, like paper. */
  var verifyToken = 0;
  function verify(plan) {
    var token = ++verifyToken;
    el.verdict.className = 'verdict';
    el.verdictText.textContent = 'Checking the code is readable…';

    setTimeout(function () {
      if (token !== verifyToken) return;
      if (typeof jsQR !== 'function') { el.verdict.hidden = true; return; }

      var w = Math.min(plan.dim, 512);
      var off = document.createElement('canvas');
      off.width = off.height = w;
      var c = off.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, w);
      c.drawImage(el.canvas, 0, 0, w, w);

      var px = c.getImageData(0, 0, w, w);
      var res = null;
      try { res = jsQR(px.data, w, w); } catch (e) { res = null; }
      if (token !== verifyToken) return;

      if (res && res.data === plan.norm.text) {
        el.verdict.className = 'verdict ok';
        el.verdictText.textContent = 'Scanned back successfully — this code reads correctly.';
      } else {
        el.verdict.className = 'verdict bad';
        el.verdictText.textContent = 'A decoder could not read this code. ' + (
          plan.logo ? 'The logo is covering too much of it — shrink it.'
            : plan.margin === 0 ? 'Add a quiet zone (a margin of 2–4 modules).'
              : 'Raise the contrast between the two colours.');
      }
    }, 30);
  }

  /* ---------------------------------------------------------------- main -- */

  function update() {
    var opt = readOptions();
    var plan;
    try {
      plan = buildPlan(opt);
    } catch (err) {
      plan = { error: 'That is too much data for a QR code. Shorten the URL or lower the error correction level.' };
    }

    if (plan.error) {
      note(el.statusNote, plan.error);
      setEnabled(false);
      el.verdict.className = 'verdict';
      el.verdictText.textContent = 'Nothing to check yet.';
      return;
    }

    state.plan = plan;
    paint(plan);
    verify(plan);
    document.getElementById('stage').className = plan.bg ? 'stage' : 'stage alpha';
    if (el.saveImg) el.saveImg.src = el.canvas.toDataURL('image/png');
    setEnabled(true);
    note(el.statusNote, '');

    el.metaVersion.textContent = plan.version;
    el.metaModules.textContent = plan.count + ' x ' + plan.count + ' modules';
    el.metaSize.textContent = plan.dim;
    el.urlHint.innerHTML = plan.norm.added
      ? 'Encoding <b>' + plan.norm.text.replace(/[<&]/g, '') + '</b> &mdash; https:// was added for you.'
      : (plan.norm.kind === 'text'
        ? 'No scheme detected, so this is encoded as plain text.'
        : 'A bare domain gets <code>https://</code> added automatically.');

    // contrast / scannability warnings
    var bgForCheck = opt.transparent ? '#ffffff' : opt.bg;
    var ratio = contrast(opt.fg, bgForCheck);
    if (ratio < 3) {
      note(el.contrastNote, 'Contrast is only ' + ratio.toFixed(1) + ':1. Most scanners need at least 3:1 - darken the code colour or lighten the background.');
    } else if (luminance(opt.fg) > luminance(bgForCheck)) {
      note(el.contrastNote, 'This is an inverted code (light on dark). Many phone cameras refuse to read those - swapping the two colours is safer.');
    } else if (ratio < 4.5) {
      note(el.contrastNote, 'Contrast is ' + ratio.toFixed(1) + ':1. It should scan, but test it on a phone before printing.');
    } else {
      note(el.contrastNote, '');
    }
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 90); }

  /* ------------------------------------------------------------- exports -- */

  function fileStem() {
    var t = state.plan ? state.plan.norm.text : 'qr';
    var host = t.replace(/^[a-zA-Z][\w+.\-]*:\/\//, '').split(/[/?#]/)[0];
    host = host.replace(/[^a-zA-Z0-9.\-]/g, '').replace(/^www\./, '') || 'code';
    return 'qr-' + host.replace(/\./g, '-').toLowerCase();
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  if (el.dlPng) el.dlPng.addEventListener('click', function () {
    el.canvas.toBlob(function (blob) {
      save(blob, fileStem() + '.png');
      note(el.statusNote, 'Saved ' + fileStem() + '.png (' + state.plan.dim + ' px).', true);
    }, 'image/png');
  });

  if (el.dlSvg) el.dlSvg.addEventListener('click', function () {
    var svg = toSVG(state.plan);
    save(new Blob([svg], { type: 'image/svg+xml' }), fileStem() + '.svg');
    note(el.statusNote, 'Saved ' + fileStem() + '.svg - scales to any size.', true);
  });

  if (el.copySvg) el.copySvg.addEventListener('click', function () {
    var svg = toSVG(state.plan);
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      note(el.statusNote, 'This browser will not let the page reach the clipboard.');
      return;
    }
    navigator.clipboard.writeText(svg).then(function () {
      note(el.statusNote, 'SVG markup copied — paste it into a design tool or save it as a .svg file.', true);
    }, function (e) {
      note(el.statusNote, 'Copy failed (' + e.name + ').');
    });
  });

  el.copyBtn.addEventListener('click', function () {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) {
      note(el.statusNote, 'This browser cannot copy images. Use Download PNG instead.');
      return;
    }
    el.canvas.toBlob(function (blob) {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
        note(el.statusNote, 'PNG copied to the clipboard.', true);
      }, function (e) {
        note(el.statusNote, 'Copy failed (' + e.name + '). Use Download PNG instead.');
      });
    }, 'image/png');
  });

  /* -------------------------------------------------------------- wiring -- */

  function pairColor(picker, hex) {
    picker.addEventListener('input', function () {
      hex.value = picker.value.toUpperCase();
      schedule();
    });
    hex.addEventListener('input', function () {
      var v = normHex(hex.value);
      if (v) { picker.value = v; schedule(); }
    });
    hex.addEventListener('blur', function () {
      hex.value = picker.value.toUpperCase();
    });
  }
  pairColor(el.fg, el.fgHex);
  pairColor(el.bg, el.bgHex);
  pairColor(el.eye, el.eyeHex);

  function swatches(host, colors, picker, hex) {
    colors.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw';
      b.style.background = c;
      b.title = c.toUpperCase();
      b.addEventListener('click', function () {
        picker.value = c;
        hex.value = c.toUpperCase();
        schedule();
      });
      host.appendChild(b);
    });
  }
  swatches(el.fgSwatches, ['#000000', '#1f2937', '#1d4ed8', '#0f766e', '#6d28d9', '#be123c', '#b45309', '#166534'], el.fg, el.fgHex);
  swatches(el.bgSwatches, ['#ffffff', '#f8fafc', '#fef3c7', '#ecfdf5', '#eff6ff', '#fdf2f8', '#f1f5f9'], el.bg, el.bgHex);

  el.url.addEventListener('input', schedule);
  el.transparent.addEventListener('change', schedule);

  el.eyeSame.addEventListener('change', function () {
    el.eyeWrap.hidden = el.eyeSame.checked;
    if (el.eyeSame.checked) {
      el.eye.value = el.fg.value;
      el.eyeHex.value = el.fg.value.toUpperCase();
    }
    schedule();
  });

  el.shape.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-shape]');
    if (!b) return;
    state.shape = b.dataset.shape;
    Array.prototype.forEach.call(el.shape.children, function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
    update();
  });

  el.size.addEventListener('input', function () { el.sizeOut.textContent = el.size.value; schedule(); });
  el.margin.addEventListener('input', function () { el.marginOut.textContent = el.margin.value; schedule(); });
  el.ecl.addEventListener('change', update);

  function applyLogoMode() {
    el.logoWrap.hidden = !el.logoOn.checked;
    if (el.logoOn.checked) {
      state.eclBeforeLogo = el.ecl.value;
      el.ecl.value = 'H';
      el.ecl.disabled = true;
    } else {
      if (state.eclBeforeLogo) el.ecl.value = state.eclBeforeLogo;
      el.ecl.disabled = false;
    }
    update();
  }

  el.logoOn.addEventListener('change', function () {
    applyLogoMode();
    // No logo yet: ask for one straight away.
    if (el.logoOn.checked && !state.logoImg) el.logoFile.click();
  });

  el.logoSize.addEventListener('input', function () { el.logoSizeOut.textContent = el.logoSize.value; schedule(); });
  el.logoPad.addEventListener('change', schedule);

  function loadLogo(src, done) {
    var img = new Image();
    img.onload = function () {
      state.logoImg = img;
      state.logoSrc = src;
      if (done) done();
      update();
    };
    img.onerror = function () { note(el.statusNote, 'That image could not be loaded.'); };
    img.src = src;
  }

  el.logoFile.addEventListener('change', function () {
    var f = el.logoFile.files && el.logoFile.files[0];
    if (!f) return;
    var fr = new FileReader();
    // Read as a data: URI - a file:// image drawn straight onto the canvas
    // would taint it and break PNG export.
    fr.onload = function () { loadLogo(fr.result); };
    fr.readAsDataURL(f);
  });

  // Picker dismissed without choosing anything: turn the option back off.
  el.logoFile.addEventListener('cancel', function () {
    if (!state.logoImg) { el.logoOn.checked = false; applyLogoMode(); }
  });

  /* ---------------------------------------------------------------- boot -- */

  /* Optional presets in the address bar, e.g.
     index.html#url=https://acme.com&fg=%23be123c&shape=dots&ecl=H          */
  function applyHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var p = new URLSearchParams(h);
    var color = function (key, picker, hex) {
      var v = p.get(key) && normHex(p.get(key));
      if (v) { picker.value = v; hex.value = v.toUpperCase(); }
    };
    if (p.get('url')) el.url.value = p.get('url');
    color('fg', el.fg, el.fgHex);
    color('bg', el.bg, el.bgHex);
    if (p.get('eye')) {
      el.eyeSame.checked = false;
      el.eyeWrap.hidden = false;
      color('eye', el.eye, el.eyeHex);
    } else {
      el.eye.value = el.fg.value;
      el.eyeHex.value = el.fg.value.toUpperCase();
    }
    if (/^(square|rounded|dots)$/.test(p.get('shape') || '')) {
      state.shape = p.get('shape');
      Array.prototype.forEach.call(el.shape.children, function (x) {
        x.setAttribute('aria-pressed', String(x.dataset.shape === state.shape));
      });
    }
    if (/^[LMQH]$/.test(p.get('ecl') || '')) el.ecl.value = p.get('ecl');
    if (p.get('size')) { el.size.value = p.get('size'); el.sizeOut.textContent = el.size.value; }
    if (p.get('margin')) { el.margin.value = p.get('margin'); el.marginOut.textContent = el.margin.value; }
    if (p.get('transparent') === '1') el.transparent.checked = true;
  }

  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }
  /* Small handle for scripting / testing from the console. */
  window.qrGenerator = {
    refresh: update,
    plan: function () { return state.plan; },
    svg: function () { return state.plan ? toSVG(state.plan) : null; }
  };

  applyHash();
  window.addEventListener('hashchange', function () { applyHash(); update(); });
  update();
})();
