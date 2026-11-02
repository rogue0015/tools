// Business Card Maker. No storage, no network: state lives in this closure and dies with the tab.
// Every card is drawn on a canvas by one function, so thumbnails, preview and 600 DPI exports match.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const DPI = 600, BLEED_MM = 3, PX_PER_MM_EXPORT = DPI / 25.4;
  const SIZES = {
    eu: { w: 85, h: 55, label: "85 × 55 mm" },
    wide: { w: 90, h: 55, label: "90 × 55 mm" },
    us: { w: 88.9, h: 50.8, label: "3.5 × 2 in" },
    slim: { w: 90, h: 50, label: "90 × 50 mm" },
  };
  const FIELDS = ["name", "title", "company", "phone", "email", "website", "address", "tagline"];
  const SAMPLE = {
    name: "Alex Morgan", title: "Marketing Director", company: "Northwind & Co.", phone: "+1 555 0123",
    email: "alex@northwind.co", website: "northwind.co", address: "14 Park Lane, Springfield",
    tagline: "Ideas that move people.",
  };
  const FONTS = {
    sans: '"Space Grotesk", system-ui, sans-serif',
    clean: '"Helvetica Neue", Arial, Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    display: 'Anton, Impact, sans-serif',
    mono: '"IBM Plex Mono", Consolas, monospace',
  };

  // Simple line icons on a 24-unit grid.
  const ICONS = {
    phone: new Path2D("M8 2.5h8a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z M10.5 18.5h3"),
    email: new Path2D("M3 5.5h18v13H3z M3.5 6l8.5 7 8.5-7"),
    website: new Path2D("M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M3 12h18 M12 3c-3.2 3.5-3.2 14.5 0 18 M12 3c3.2 3.5 3.2 14.5 0 18"),
    address: new Path2D("M12 21.5s-6.5-6.2-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11.5-6.5 11.5z M12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z"),
  };

  // ---------- Colour helpers ----------
  const rgb = h => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const mix = (a, b, t) => "#" + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");

  // ---------- Drawing kit handed to each template ----------
  // Units: u = 1% of card height. Origin is the trim corner; bleed (if any) lies outside 0..W, 0..H.
  function kit(ctx, W, H, b) {
    const u = H / 100;
    const g = { ctx, W, H, u, cut: false };

    // Any edge touching the card edge is pushed out into the bleed.
    g.ext = (x, y, w, h) => {
      const e = 0.5; let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (x0 <= e) x0 = -b; if (y0 <= e) y0 = -b; if (x1 >= W - e) x1 = W + b; if (y1 >= H - e) y1 = H + b;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    g.rect = (x, y, w, h, color) => { const r = g.ext(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.w, r.h); };

    const font = o => `${o.italic ? "italic " : ""}${o.weight || 400} ${o.sz}px ${FONTS[o.font || "clean"]}`;
    const spacing = px => { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; };

    // One line of text, top at y. Shrinks to fit maxW, then cuts with "…". Returns the line height.
    g.text = (str, x, y, o) => {
      if (!str) return 0;
      let s = o.upper ? str.toUpperCase() : str, sz = o.size;
      const measure = () => { ctx.font = font({ ...o, sz }); spacing((o.track || 0) * sz); return ctx.measureText(s).width; };
      let w = measure();
      if (o.maxW) {
        while (w > o.maxW && sz > o.size * 0.62) { sz *= 0.95; w = measure(); }
        if (w > o.maxW) { g.cut = true; while (s.length > 1 && measure() > o.maxW) s = s.slice(0, -2) + "…"; }
      }
      ctx.fillStyle = o.color; ctx.textAlign = o.align || "left"; ctx.textBaseline = "middle";
      ctx.fillText(s, x, y + o.size * 0.65);
      spacing(0);
      return o.size * (o.lh || 1.3);
    };

    g.icon = (name, x, cy, size, color) => {
      ctx.save(); ctx.translate(x, cy - size / 2); ctx.scale(size / 24, size / 24);
      ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineJoin = ctx.lineCap = "round";
      ctx.stroke(ICONS[name]); ctx.restore();
    };

    // Vertical stack of items. With o.h the stack is centred in [y, y+h]. Returns {top, bottom}.
    const hOf = it => it.k === "t" ? it.size * (it.lh || 1.3) + (it.gap || 0) : it.k === "r" ? it.thick : it.h;
    const leftOf = (x, w, align) => align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    g.stack = (items, x, y, o = {}) => {
      items = items.filter(it => it && (it.k !== "t" || it.s));
      while (items.length && items[0].k === "s") items.shift();
      while (items.length && items[items.length - 1].k === "s") items.pop();
      const total = items.reduce((a, it) => a + hOf(it), 0);
      let cy = o.h != null ? y + (o.h - total) / 2 : y;
      const top = cy;
      for (const it of items) {
        if (it.k === "t") {
          let tx = x, mw = it.maxW || o.maxW;
          if (it.icon) {
            g.icon(it.icon, x + it.size * 0.5, cy + it.size * 0.65, it.size * 1.05, it.iconColor || it.color);
            tx = x + it.size * 1.7; mw -= it.size * 1.7;
          }
          g.text(it.s, tx, cy, { ...it, align: o.align, maxW: mw });
        } else if (it.k === "r") {
          ctx.fillStyle = it.color; ctx.fillRect(leftOf(x, it.w, o.align), cy, it.w, it.thick);
        } else if (it.k === "b") {
          it.draw(leftOf(x, it.w, o.align), cy);
        }
        cy += hOf(it);
      }
      return { top, bottom: cy };
    };

    const path = (x, y, w, h, o) => {
      ctx.beginPath();
      if (o.circle) ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      else if (o.radius) {
        const r = o.radius;
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      } else ctx.rect(x, y, w, h);
    };

    g.img = (src, x, y, w, h, o = {}) => {
      ctx.save();
      const r = o.ext ? g.ext(x, y, w, h) : { x, y, w, h };
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      const iw = src.width, ih = src.height;
      if (o.fit === "contain") {
        const s = Math.min(w / iw, h / ih);
        ctx.drawImage(src, x + (w - iw * s) * (o.ax ?? 0.5), y + (h - ih * s) / 2, iw * s, ih * s);
      } else {
        path(r.x, r.y, r.w, r.h, o); ctx.clip();
        const s = Math.max(r.w / iw, r.h / ih) * (o.zoom || 1), dw = iw * s, dh = ih * s;
        ctx.drawImage(src, r.x + (r.w - dw) * (o.fx ?? 0.5), r.y + (r.h - dh) * (o.fy ?? 0.3), dw, dh);
      }
      ctx.restore();
    };

    // Photo slot: the user's photo, a silhouette in gallery thumbnails, or initials on a tinted block.
    g.photo = (P, d, x, y, w, h, o) => {
      if (P.photo) return g.img(P.photo, x, y, w, h, { ...o, zoom: P.zoom, fx: P.fx, fy: P.fy });
      ctx.save();
      const r = o.ext ? g.ext(x, y, w, h) : { x, y, w, h };
      path(r.x, r.y, r.w, r.h, o); ctx.clip();
      ctx.fillStyle = o.ph; ctx.fillRect(r.x, r.y, r.w, r.h);
      if (P.sample) {
        const cx = x + w / 2, m = Math.min(w, h);
        ctx.fillStyle = o.ink; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(cx, y + h * 0.4, m * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, y + h * 0.98, m * 0.4, h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      } else if (d.initials) {
        g.text(d.initials, x + w / 2, y + h / 2 - Math.min(w, h) * 0.2, { size: Math.min(w, h) * 0.32, font: "display", color: o.ink, align: "center", lh: 1 });
      }
      ctx.restore();
    };
    g.logo = (P, x, y, w, h, fallback, ax) => P.logo ? g.img(P.logo, x, y, w, h, { fit: "contain", ax }) : fallback();

    // Split text into at most maxLines lines that fit maxW (the last line shrinks or is cut if needed).
    g.wrap = (str, o, maxW, maxLines = 2) => {
      if (!str) return [];
      ctx.font = font({ ...o, sz: o.size }); spacing((o.track || 0) * o.size);
      const out = [];
      let line = "";
      for (const word of str.split(" ")) {
        const test = line ? line + " " + word : word;
        if (line && ctx.measureText(test).width > maxW && out.length < maxLines - 1) { out.push(line); line = word; }
        else line = test;
      }
      spacing(0);
      return out.concat(line);
    };

    // QR code on a white plate (always dark-on-light so phones can scan it). size includes a 2-module margin.
    // With mark(x, y, w), the centre modules are cleared and the mark (logo) is drawn there. The code is
    // made with error correction H (30%), and the cleared square (30% of the width, under 10% of the modules) still scans.
    g.qr = (m, x, y, size, dark, mark) => {
      const q = 2, s = size / (m.n + 2 * q);
      let k = mark ? Math.floor(m.n * 0.3) : 0;
      if (k && k % 2 === 0) k--; // odd, so it sits exactly in the middle (n is always odd)
      const a = (m.n - k) / 2, inHole = (r, c) => r >= a && r < a + k && c >= a && c < a + k;
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x, y, size, size);
      ctx.fillStyle = dark;
      for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) {
        if (!m.dark(r, c) || inHole(r, c)) continue;
        // rounded edges so neighbouring modules touch with no hairline gaps
        const x0 = Math.round(x + (c + q) * s), y0 = Math.round(y + (r + q) * s);
        ctx.fillRect(x0, y0, Math.round(x + (c + q + 1) * s) - x0, Math.round(y + (r + q + 1) * s) - y0);
      }
      if (k) mark(x + (q + a + 0.5) * s, y + (q + a + 0.5) * s, (k - 1) * s); // half-module white border
    };
    return g;
  }

  // Stack item builders: text, rule, space.
  const T = (s, o) => ({ k: "t", s, ...o });
  const R = (w, thick, color) => ({ k: "r", w, thick, color });
  const S = h => ({ k: "s", h });
  const B = (w, h, draw) => ({ k: "b", w, h, draw });
  const contacts = (d, o, keys = ["phone", "email", "website", "address"]) =>
    keys.filter(k => k && d[k]).map(k => T(d[k], { ...o, icon: o.icons ? k : null }));

  // ---------- Templates ----------
  // tags: photo / logo / text and dark / light. Each draws with its accent colour A.
  const TEMPLATES = [
    {
      id: "band", name: "Navy Band", tags: ["logo", "light"], accent: "#C9A55A", uses: { logo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g, navy = "#1B2A4A";
        g.rect(0, 0, W, H, "#FFFFFF");
        g.rect(0, 0, W, 40 * u, navy);
        g.rect(0, 40 * u, W, 1.4 * u, A);
        const head = d.company || d.name;
        const lh = head ? 15 * u : 26 * u, ly = head ? 5 * u : 7 * u;
        g.logo(P, W / 2 - 30 * u, ly, 60 * u, lh, () => {
          const r = lh * 0.46;
          ctx.strokeStyle = A; ctx.lineWidth = 0.5 * u;
          ctx.beginPath(); ctx.arc(W / 2, ly + lh / 2, r, 0, Math.PI * 2); ctx.stroke();
          g.text(d.initials, W / 2, ly + lh / 2 - r * 0.55, { size: r * 0.85, font: "serif", weight: 700, color: A, align: "center", lh: 1 });
        });
        if (head) g.text(head, W / 2, 23 * u, { size: 7.5 * u, weight: 700, color: A, upper: true, track: 0.08, align: "center", maxW: W - 12 * u });
        g.stack([
          T(d.name, { size: 10.5 * u, weight: 700, font: "serif", color: navy }),
          T(d.title, { size: 5.6 * u, color: "#4A5568" }),
          S(2 * u),
          ...contacts(d, { size: 5 * u, color: "#2D3748" }),
        ], W / 2, 41.4 * u, { h: 58.6 * u, align: "center", maxW: W - 12 * u });
      },
    },
    {
      id: "counsel", name: "Counsel", tags: ["photo", "dark"], accent: "#C9A55A", uses: { photo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g, bg = "#14213D";
        g.rect(0, 0, W, H, bg);
        const strip = d.address || d.company || d.website, sh = strip ? 15 * u : 0;
        if (strip) {
          g.rect(0, H - sh, W, sh, A);
          g.text(strip, W / 2, H - sh + (sh - 6.5 * u) / 2, { size: 5 * u, color: bg, align: "center", maxW: W - 8 * u, weight: 600 });
        }
        const top = 8 * u, ph = H - sh - 15 * u, pw = ph * 0.8, px = 0.045 * W;
        g.rect(px + pw * 0.12, 0, pw * 0.22, top - 1.5 * u, A);
        g.photo(P, d, px, top, pw, ph, { ph: "#2A3A5E", ink: A });
        ctx.strokeStyle = A; ctx.lineWidth = 0.7 * u; ctx.strokeRect(px, top, pw, ph);
        const tx = px + pw + 5.5 * u, tw = W - tx - 5 * u;
        g.stack([
          T(d.name, { size: 8.5 * u, weight: 700, color: A, upper: true, track: 0.03 }),
          T(d.title, { size: 4.8 * u, color: mix(A, "#FFFFFF", 0.3), upper: true, track: 0.08 }),
          S(1.5 * u), R(tw, 0.4 * u, A), S(2.5 * u),
          strip !== d.company && T(d.company, { size: 5 * u, weight: 600, color: "#FFFFFF" }),
          ...contacts(d, { size: 4.6 * u, color: "#E2E8F0" }, ["phone", "email", strip !== d.website && "website"]),
        ], tx, top, { h: ph, maxW: tw });
      },
    },
    {
      id: "graphite", name: "Graphite", tags: ["logo", "dark"], accent: "#AEB6BF", uses: { logo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g;
        g.rect(0, 0, W, H, "#2E3134");
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const pts = Array.from({ length: 14 }, () => [W * (0.45 + rnd() * 0.6), H * (-0.1 + rnd() * 1.2)]);
        ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 0.35 * u; ctx.beginPath();
        pts.forEach((p, i) => { for (const j of [3, 5]) { ctx.moveTo(p[0], p[1]); ctx.lineTo(...pts[(i + j) % 14]); } });
        ctx.stroke();
        const cx = 0.79 * W, bw = 0.26 * W;
        g.logo(P, cx - bw / 2, 20 * u, bw, 38 * u, () => {
          const r = 15 * u, cy = 39 * u;
          ctx.strokeStyle = A; ctx.lineWidth = 0.8 * u; ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
          ctx.closePath(); ctx.stroke();
          g.text(d.initials, cx, cy - 7.5 * u, { size: 11 * u, font: "display", color: A, align: "center", lh: 1 });
        });
        g.text(d.company, cx, 63 * u, { size: 4.4 * u, weight: 700, color: A, upper: true, track: 0.12, align: "center", maxW: 0.32 * W });
        g.stack([
          T(d.name, { size: 8.5 * u, weight: 700, color: "#ECEDEE", upper: true, track: 0.03 }),
          T(d.title, { size: 4.6 * u, color: A, upper: true, track: 0.06 }),
          S(4 * u),
          ...contacts(d, { size: 4.5 * u, color: "#D5D8DB", icons: true, iconColor: A }),
        ], 0.06 * W, 0, { h: H, maxW: 0.56 * W });
      },
    },
    {
      id: "blueprint", name: "Blueprint", tags: ["logo", "light"], accent: "#1A1A1A", uses: { logo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g;
        g.rect(0, 0, W, H, "#FFFFFF");
        const bx = 0.04 * W, by = 14 * u, bw = 0.4 * W, bh = 72 * u;
        g.logo(P, bx, by, bw, bh, () => {
          // abstract line-art building
          const s = Math.min(bw, bh) / 100, ox = bx + (bw - 100 * s) / 2, oy = by + (bh - 100 * s) / 2;
          const L = [[0, 95, 100, 95], [15, 20, 55, 5], [20, 15, 20, 95], [45, 6, 45, 95], [20, 15, 45, 15], [30, 15, 30, 95], [38, 15, 38, 95],
            [45, 40, 80, 40], [80, 40, 80, 95], [52, 55, 72, 55], [52, 55, 52, 95], [72, 55, 72, 95], [80, 62, 95, 62], [95, 62, 95, 95],
            [45, 40, 60, 25], [60, 25, 60, 40], [5, 35, 20, 35], [5, 35, 5, 95], [62, 70, 68, 70]];
          ctx.strokeStyle = A; ctx.lineWidth = 0.45 * u; ctx.lineCap = "square"; ctx.beginPath();
          L.forEach(([a, b2, c, e]) => { ctx.moveTo(ox + a * s, oy + b2 * s); ctx.lineTo(ox + c * s, oy + e * s); });
          ctx.stroke();
        });
        g.stack([
          T(d.name, { size: 8 * u, weight: 700, color: "#111111", upper: true }),
          T(d.title, { size: 4.8 * u, color: A, upper: true, track: 0.1 }),
          S(4 * u),
          T(d.company, { size: 5.4 * u, weight: 600, color: "#111111" }),
          ...contacts(d, { size: 4.5 * u, color: "#333333" }),
        ], 0.48 * W, 0, { h: H, maxW: 0.48 * W });
      },
    },
    {
      id: "agent", name: "Agent", tags: ["photo", "light"], accent: "#8E9196", uses: { photo: true },
      draw(g, d, P, A) {
        const { W, H, u } = g, x0 = 0.63 * W;
        g.rect(0, 0, W, H, "#FFFFFF");
        g.photo(P, d, x0, 0, W - x0, H, { ext: true, ph: "#E5E7EB", ink: "#9CA3AF" });
        const st = g.stack([
          T(d.name, { size: 10 * u, weight: 800, color: "#111111", upper: true }),
          S(2 * u),
          T(d.title, { size: 5.4 * u, weight: 600, color: "#222222" }),
          T(d.company, { size: 5 * u, color: "#444444" }),
          S(3 * u),
          ...contacts(d, { size: 4.6 * u, color: "#222222" }),
        ], 7 * u, 0, { h: H, maxW: x0 - 11 * u });
        if (d.name) g.rect(0, st.top, 2.4 * u, 13 * u, A);
      },
    },
    {
      id: "monogram", name: "Monogram", tags: ["logo", "light"], accent: "#6C3BFF", uses: { logo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g;
        g.rect(0, 0, W, H, "#FBFAF7");
        const bx = 0.06 * W, bw = 0.3 * W;
        g.logo(P, bx, 18 * u, bw, 64 * u, () => {
          if (!d.initials) return;
          const cx = bx + bw / 2, sz = Math.min(38 * u, bw * 0.75);
          const grad = ctx.createLinearGradient(cx - sz * 0.6, 0, cx + sz * 0.6, 0);
          grad.addColorStop(0, A); grad.addColorStop(0.5, "#FF3D7F"); grad.addColorStop(1, "#FFB21F");
          g.text(d.initials, cx, 50 * u - sz * 0.65, { size: sz, font: "serif", weight: 700, color: grad, align: "center", lh: 1 });
        });
        g.stack([
          T(d.name, { size: 9.5 * u, font: "serif", color: "#151515" }),
          T(d.title, { size: 5.2 * u, color: "#333333" }),
          S(4 * u),
          T(d.company, { size: 4.8 * u, weight: 600, color: "#222222" }),
          ...contacts(d, { size: 4.6 * u, color: "#333333" }),
        ], 0.42 * W, 0, { h: H, maxW: 0.53 * W });
      },
    },
    {
      id: "calm", name: "Calm", tags: ["photo", "light"], accent: "#2F6F86", uses: { photo: true },
      draw(g, d, P, A) {
        const { W, H, u } = g;
        g.rect(0, 0, W, H, mix(A, "#FFFFFF", 0.9));
        g.rect(0, 0, 0.4 * W, H, mix(A, "#FFFFFF", 0.72));
        g.photo(P, d, 0.05 * W, 12 * u, 0.3 * W, 76 * u, { radius: 2 * u, ph: mix(A, "#FFFFFF", 0.5), ink: "#FFFFFF" });
        const dark = mix(A, "#000000", 0.45);
        g.stack([
          T(d.name, { size: 7.8 * u, weight: 700, color: dark, upper: true }),
          T(d.title, { size: 5 * u, color: A, upper: true, track: 0.06 }),
          S(2.5 * u), R(0.18 * W, 0.4 * u, A), S(3 * u),
          T(d.company, { size: 5 * u, weight: 700, color: dark }),
          ...contacts(d, { size: 4.6 * u, color: "#2B3A42" }),
        ], 0.45 * W, 0, { h: H, maxW: 0.5 * W });
      },
    },
    {
      id: "portrait", name: "Portrait", tags: ["photo", "light"], accent: "#0F766E", uses: { photo: true },
      draw(g, d, P, A) {
        const { W, H, u, ctx } = g;
        g.rect(0, 0, W, H, "#FFFFFF");
        g.rect(0, 0, 0.36 * W, H, A);
        const cx = 0.18 * W, cy = d.company ? 42 * u : 50 * u, r = Math.min(0.13 * W, 25 * u);
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(cx, cy, r + 1.2 * u, 0, Math.PI * 2); ctx.fill();
        g.photo(P, d, cx - r, cy - r, 2 * r, 2 * r, { circle: true, ph: mix(A, "#FFFFFF", 0.75), ink: A });
        g.text(d.company, cx, cy + r + 6 * u, { size: 4.2 * u, weight: 700, color: "#FFFFFF", upper: true, track: 0.12, align: "center", maxW: 0.3 * W });
        g.stack([
          T(d.name, { size: 8.5 * u, weight: 700, color: "#111111" }),
          T(d.title, { size: 5 * u, weight: 600, color: A }),
          S(3.5 * u),
          ...contacts(d, { size: 4.5 * u, color: "#333333", icons: true, iconColor: A }),
        ], 0.42 * W, 0, { h: H, maxW: 0.53 * W });
      },
    },
    {
      id: "minimal", name: "Minimal", tags: ["text", "light"], accent: "#9A7B4F", uses: {},
      draw(g, d, P, A) {
        const { W, H, u } = g;
        g.rect(0, 0, W, H, "#F7F4EE");
        const join = (...a) => a.filter(Boolean).join("  ·  ");
        g.stack([
          T(d.name, { size: 11 * u, font: "serif", color: "#1A1A1A", track: 0.02 }),
          T(d.title, { size: 4.2 * u, weight: 600, color: A, upper: true, track: 0.28 }),
          S(3 * u), R(12 * u, 0.35 * u, A), S(3.5 * u),
          T(join(d.phone, d.email), { size: 4.4 * u, color: "#333333" }),
          T(join(d.website, d.address), { size: 4.4 * u, color: "#333333" }),
        ], W / 2, 0, { h: d.company ? 82 * u : H, align: "center", maxW: W - 12 * u });
        g.text(d.company, W / 2, 85 * u, { size: 3.8 * u, color: "#555555", upper: true, track: 0.3, align: "center", maxW: W - 12 * u });
      },
    },
    {
      id: "signal", name: "Signal", tags: ["text", "dark"], accent: "#D4FF3F", uses: {},
      draw(g, d, P, A) {
        const { W, H, u } = g;
        g.rect(0, 0, W, H, "#08060B");
        g.rect(0, 0, 2.4 * u, H, A);
        g.text(d.company, 9 * u, 7 * u, { size: 3.8 * u, font: "mono", weight: 500, color: "#4DE1FF", upper: true, track: 0.14, maxW: W - 16 * u });
        g.stack([
          T(d.name, { size: 13 * u, font: "display", color: "#F5EFDF", upper: true, track: 0.01, lh: 1.15 }),
          T(d.title, { size: 4.4 * u, font: "mono", weight: 500, color: A, upper: true, track: 0.1 }),
          S(5 * u),
          ...contacts(d, { size: 4.2 * u, font: "mono", color: "rgba(245,239,223,0.72)" }),
        ], 9 * u, 12 * u, { h: 84 * u, maxW: W - 16 * u });
      },
    },
  ];

  // ---------- Back side ----------
  // Each front template hands its colours to the back so both sides match.
  // bg: background, head: headings/brand, ink: body text, acc: accent, dark: QR module colour.
  const PALS = {
    band: A => ({ bg: "#1B2A4A", head: A, ink: "#FFFFFF", acc: A, dark: "#1B2A4A" }),
    counsel: A => ({ bg: "#14213D", head: A, ink: "#E2E8F0", acc: A, dark: "#14213D" }),
    graphite: A => ({ bg: "#2E3134", head: "#ECEDEE", ink: "#D5D8DB", acc: A, dark: "#2E3134" }),
    blueprint: A => ({ bg: "#FFFFFF", head: "#111111", ink: "#333333", acc: A, dark: "#111111" }),
    agent: A => ({ bg: "#FFFFFF", head: "#111111", ink: "#222222", acc: A, dark: "#111111" }),
    monogram: A => ({ bg: "#FBFAF7", head: "#151515", ink: "#333333", acc: A, dark: "#151515" }),
    calm: A => ({ bg: mix(A, "#FFFFFF", 0.72), head: mix(A, "#000000", 0.45), ink: "#2B3A42", acc: A, dark: mix(A, "#000000", 0.45) }),
    portrait: A => ({ bg: A, head: "#FFFFFF", ink: mix(A, "#FFFFFF", 0.85), acc: "#FFFFFF", dark: mix(A, "#000000", 0.45) }),
    minimal: A => ({ bg: "#F7F4EE", head: "#1A1A1A", ink: "#333333", acc: A, dark: "#1A1A1A" }),
    signal: A => ({ bg: "#08060B", head: "#F5EFDF", ink: "rgba(245,239,223,0.72)", acc: A, dark: "#08060B" }),
  };
  const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
  const onColor = hex => { const [r, gr, b] = rgb(hex); return 0.299 * r + 0.587 * gr + 0.114 * b > 150 ? "#111111" : "#FFFFFF"; };
  const urlOf = w => !w ? "" : /^[a-z][a-z0-9+.-]*:/i.test(w) ? w : "https://" + w;

  // Brand mark for the back: logo, else company name, else initials, fitted to a w×h box.
  function brand(g, d, P, x, y, w, h, color) {
    if (P.logo) return g.img(P.logo, x, y, w, h, { fit: "contain" });
    if (d.company) { // one line if it fits, else two smaller lines
      const s = d.company.toUpperCase(), o = { size: h * 0.34, weight: 700, track: 0.06, color, lh: 1.15 };
      let lines = g.wrap(s, o, w, 2);
      if (lines.length > 1) { o.size = h * 0.24; lines = g.wrap(s, o, w, 2); }
      g.stack(lines.map(l => T(l, o)), x + w / 2, y, { h, align: "center", maxW: w });
    } else if (d.initials) g.text(d.initials, x + w / 2, y + h / 2 - h * 0.3575, { size: h * 0.55, font: "display", color, align: "center", lh: 1 });
  }
  const tagItems = (g, d, size, color, maxW) =>
    g.wrap(d.tagline, { size, font: "serif", italic: true }, maxW, 2).map(l => T(l, { size, font: "serif", italic: true, color }));

  // Logo, tagline, website centred; small QR bottom-right.
  function centred(g, d, P, p, qr, ink) {
    const { W, H, u } = g, q = qr ? 30 * u : 0, mw = qr ? W - 2 * (q + 9 * u) : W - 16 * u;
    g.stack([
      B(Math.min(mw, 0.5 * W), 28 * u, (x, y) => brand(g, d, P, x, y, Math.min(mw, 0.5 * W), 28 * u, ink || p.head)),
      S(5 * u), ...tagItems(g, d, 5.4 * u, ink || p.ink, mw),
      S(3.5 * u), R(10 * u, 0.4 * u, p.acc), S(3.5 * u),
      T(d.website, { size: 4.4 * u, weight: 600, color: ink || p.head, track: 0.06 }),
    ], W / 2, 0, { h: H, align: "center", maxW: mw });
    if (qr) g.qr(qr, W - q - 6 * u, H - q - 6 * u, q, p.dark, qr.mark);
  }

  const BACKS = [
    { id: "centre", name: "Centred", draw(g, d, P, p, qr) { g.rect(0, 0, g.W, g.H, p.bg); centred(g, d, P, p, qr); } },
    {
      id: "qr", name: "QR focus",
      draw(g, d, P, p, qr) {
        const { W, H, u } = g;
        g.rect(0, 0, W, H, p.bg);
        if (!qr) return centred(g, d, P, p, null);
        const qs = 64 * u, qx = 9 * u, x0 = qx + qs + 8 * u, cw = W - x0 - 7 * u;
        g.qr(qr, qx, (H - qs) / 2, qs, p.dark, qr.mark);
        g.stack([
          B(cw, 22 * u, (x, y) => P.logo ? g.img(P.logo, x, y, cw, 22 * u, { fit: "contain", ax: 0 })
            : g.text(d.company || d.name, x, y + 11 * u - 5.5 * u, { size: 8.5 * u, weight: 700, color: p.head, upper: true, maxW: cw, lh: 1 })),
          S(4 * u), ...tagItems(g, d, 5 * u, p.ink, cw),
          S(3 * u), R(10 * u, 0.4 * u, p.acc), S(3 * u),
          T(d.website, { size: 4.4 * u, weight: 600, color: p.head }),
          T("Scan to visit", { size: 3.4 * u, font: "mono", color: p.ink, upper: true, track: 0.15 }),
        ], x0, 0, { h: H, maxW: cw });
      },
    },
    {
      id: "image", name: "Full image",
      draw(g, d, P, p, qr) {
        const { W, H, u, ctx } = g;
        g.rect(0, 0, W, H, p.bg);
        if (P.backImg) {
          g.img(P.backImg, 0, 0, W, H, { ext: true, fx: 0.5, fy: 0.5 });
          g.rect(0, 0, W, H, rgba(p.bg.startsWith("#") ? p.bg : "#000000", 0.62));
        } else { // diagonal line texture when there is no image
          ctx.save(); ctx.strokeStyle = p.acc; ctx.globalAlpha = 0.14; ctx.lineWidth = 0.3 * u; ctx.beginPath();
          for (let x = -H - 10 * u; x < W + 10 * u; x += 5 * u) { ctx.moveTo(x, H + 5 * u); ctx.lineTo(x + H + 10 * u, -5 * u); }
          ctx.stroke(); ctx.restore();
        }
        centred(g, d, P, p, qr);
      },
    },
    {
      id: "split", name: "Split",
      draw(g, d, P, p, qr) {
        const { W, H, u } = g, pw = 0.42 * W, panelInk = onColor(p.acc);
        g.rect(0, 0, W, H, p.bg);
        if (P.backImg) { g.img(P.backImg, 0, 0, pw, H, { ext: true, fx: 0.5, fy: 0.5 }); g.rect(0, 0, pw, H, rgba(p.dark, 0.55)); }
        else g.rect(0, 0, pw, H, p.acc);
        brand(g, d, P, 0.06 * W, 28 * u, pw - 0.12 * W, 44 * u, P.backImg ? "#FFFFFF" : panelInk);
        const cw = W - pw - 12 * u, qs = 30 * u;
        g.stack([
          ...tagItems(g, d, 5 * u, p.ink, cw),
          S(3 * u), R(10 * u, 0.4 * u, p.acc === "#FFFFFF" ? p.head : p.acc), S(3 * u),
          T(d.website, { size: 4.4 * u, weight: 600, color: p.head }),
          qr && S(5 * u), qr && B(qs, qs, (x, y) => g.qr(qr, x, y, qs, p.dark, qr.mark)),
        ].filter(Boolean), pw + (W - pw) / 2, 0, { h: H, align: "center", maxW: cw });
      },
    },
  ];

  const qrCache = new Map(); // in-memory only, per text
  function qrFor(text) {
    if (!text || !window.qrcode) return null;
    if (!qrCache.has(text)) {
      let m = null;
      try { const q = qrcode(0, "H"); q.addData(text); q.make(); m = { n: q.getModuleCount(), dark: (r, c) => q.isDark(r, c) }; } catch (e) { /* too long */ }
      qrCache.set(text, m);
    }
    return qrCache.get(text);
  }

  // ---------- State (memory only) ----------
  const state = {
    tpl: null, filter: "all", size: "eu", accents: {}, photo: null, logo: null, backImg: null,
    zoom: 1, fx: 0.5, fy: 0.3, bleed: false, back: true, backId: "centre", qr: true,
  };
  const accentOf = t => state.accents[t.id] || t.accent;

  const clean = s => s.trim().replace(/\s+/g, " ");
  function userData() {
    const d = {}; FIELDS.forEach(f => { d[f] = clean($(f).value); }); return d;
  }
  const withInitials = d => {
    const w = d.name.split(" ").filter(Boolean);
    d.initials = w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase() : "";
    return d;
  };
  const hasAnyData = d => FIELDS.some(f => d[f]);
  const images = extra => ({ photo: state.photo, logo: state.logo, backImg: state.backImg, zoom: state.zoom, fx: state.fx, fy: state.fy, ...extra });

  // Size a canvas for the current card size at pxPerMm and run paint(g). bleedMm adds background beyond the trim.
  function drawCard(canvas, pxPerMm, bleedMm, paint) {
    const sz = SIZES[state.size], b = bleedMm * pxPerMm;
    const W = sz.w * pxPerMm, H = sz.h * pxPerMm;
    canvas.width = Math.round(W + 2 * b); canvas.height = Math.round(H + 2 * b);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, b, b);
    const g = kit(ctx, W, H, b);
    paint(g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return g;
  }
  const paintFront = (tpl, d, P) => g => tpl.draw(g, d, P, accentOf(tpl));
  const paintBack = (back, tpl, d, P) => g =>
    back.draw(g, d, P, PALS[tpl.id](accentOf(tpl)), state.qr ? qrWithMark(g, d, P, PALS[tpl.id](accentOf(tpl))) : null);

  // QR for the website with the logo in the middle (or an initials badge when there is no logo).
  function qrWithMark(g, d, P, p) {
    const m = qrFor(urlOf(d.website));
    if (!m) return null;
    const mark = P.logo ? (x, y, w) => g.img(P.logo, x, y, w, w, { fit: "contain" })
      : d.initials ? (x, y, w) => {
        const ctx = g.ctx;
        ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(x + w / 2, y + w / 2, w / 2, 0, Math.PI * 2); ctx.fill();
        g.text(d.initials, x + w / 2, y + w / 2 - w * 0.42 * 0.65, { size: w * 0.42, font: "display", color: "#FFFFFF", align: "center", lh: 1 });
      } : null;
    return mark ? { ...m, mark } : m;
  }
  const backDesign = () => BACKS.find(b => b.id === state.backId);

  // ---------- Step 1: gallery ----------
  const thumbs = new Map();
  function buildGallery() {
    const box = $("tpls");
    TEMPLATES.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "tpl"; btn.dataset.id = t.id;
      const cv = document.createElement("canvas");
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = t.name;
      const tg = document.createElement("span"); tg.className = "tg";
      tg.textContent = [t.uses.photo ? "Photo" : t.uses.logo ? "Logo" : "Text only", t.tags.includes("dark") ? "Dark" : "Light"].join(" · ");
      btn.setAttribute("aria-label", `${t.name} template, ${tg.textContent}`);
      btn.append(cv, nm, tg);
      btn.onclick = () => chooseTemplate(t);
      box.append(btn);
      thumbs.set(t.id, { btn, cv });
    });
  }
  const previewData = () => { const u = userData(); return withInitials(hasAnyData(u) ? u : { ...SAMPLE }); };
  function drawThumbs() {
    const d = previewData(), P = images({ sample: true });
    const pxPerMm = 520 / SIZES[state.size].w;
    TEMPLATES.forEach(t => drawCard(thumbs.get(t.id).cv, pxPerMm, 0, paintFront(t, d, P)));
  }
  function applyFilter(f) {
    state.filter = f;
    document.querySelectorAll("#filters button").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === f));
    let n = 0;
    TEMPLATES.forEach(t => { const show = f === "all" || t.tags.includes(f); thumbs.get(t.id).btn.hidden = !show; if (show) n++; });
    $("count").textContent = `${n} template${n === 1 ? "" : "s"} · tap one to use it`;
  }

  // Back design picker (thumbnails use the chosen front's colours).
  const backThumbs = new Map();
  function buildBacks() {
    BACKS.forEach(b => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "tpl"; btn.dataset.id = b.id;
      const cv = document.createElement("canvas");
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = b.name;
      btn.setAttribute("aria-label", `${b.name} back design`);
      btn.append(cv, nm);
      btn.onclick = () => { state.backId = b.id; render(); };
      $("backs").append(btn);
      backThumbs.set(b.id, { btn, cv });
    });
  }
  function drawBackThumbs(tpl) {
    const d = previewData();
    if (!d.website) d.website = SAMPLE.website; // so the thumbnails show where the QR goes
    if (!d.tagline) d.tagline = SAMPLE.tagline;
    const P = images(), pxPerMm = 300 / SIZES[state.size].w;
    BACKS.forEach(b => {
      const { btn, cv } = backThumbs.get(b.id);
      btn.setAttribute("aria-current", b.id === state.backId);
      drawCard(cv, pxPerMm, 0, paintBack(b, tpl, d, P));
    });
  }

  function showStep(n) {
    $("step1").hidden = n !== 1; $("step2").hidden = n !== 2;
    $("s1tag").classList.toggle("on", n === 1); $("s2tag").classList.toggle("on", n === 2);
    if (n === 1) drawThumbs();
    window.scrollTo({ top: 0 });
  }

  // Show only the upload fields the chosen front and back actually use.
  function syncFields() {
    const t = state.tpl; if (!t) return;
    const logo = t.uses.logo || state.back;
    $("logoField").hidden = !logo;
    $("photoField").hidden = !t.uses.photo;
    $("imgSet").hidden = !logo && !t.uses.photo;
    $("backOpts").hidden = !state.back;
    $("backSide").hidden = !state.back;
    $("pngBackBtn").hidden = !state.back;
    $("pdfBtn").textContent = state.back ? "PDF · front + back" : "Download PDF";
    $("pngBtn").textContent = state.back ? "Front PNG" : "Download PNG";
  }

  function chooseTemplate(t) {
    state.tpl = t;
    thumbs.forEach(({ btn }, id) => btn.setAttribute("aria-current", id === t.id));
    $("tplName").textContent = t.name;
    $("accent").value = accentOf(t);
    syncFields();
    showStep(2);
    render();
  }

  // ---------- Step 2: preview ----------
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  function drawPreview(cv, pxPerMm, bleed, paint) {
    const g = drawCard(cv, pxPerMm, bleed, paint), sz = SIZES[state.size];
    if (bleed) { // dashed trim line so the user sees where the cut is
      const ctx = cv.getContext("2d"), b = bleed * pxPerMm;
      ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = Math.max(1, pxPerMm * 0.15); ctx.strokeStyle = "#FF3D7F";
      ctx.strokeRect(b, b, sz.w * pxPerMm, sz.h * pxPerMm); ctx.restore();
    }
    return g;
  }

  function render() {
    const t = state.tpl; if (!t) return;
    const d = withInitials(userData()), P = images();
    const sz = SIZES[state.size], bleed = state.bleed ? BLEED_MM : 0;
    const cssW = Math.max(200, $("wrap").clientWidth - 36);
    const pxPerMm = Math.min(2400, cssW * (window.devicePixelRatio || 1)) / (sz.w + 2 * bleed);
    let cut = drawPreview($("preview"), pxPerMm, bleed, paintFront(t, d, P)).cut;
    if (state.back) {
      cut = drawPreview($("previewBack"), pxPerMm, bleed, paintBack(backDesign(), t, d, P)).cut || cut;
      drawBackThumbs(t);
    }
    const out = { w: Math.round((sz.w + 2 * bleed) * PX_PER_MM_EXPORT), h: Math.round((sz.h + 2 * bleed) * PX_PER_MM_EXPORT) };
    $("meta").innerHTML = `<b>${sz.label}</b>${bleed ? " + 3 mm bleed" : ""} · PNG ${out.w} × ${out.h} px · ${DPI} DPI`;

    const notes = [];
    if (t.uses.photo && !state.photo) notes.push("No photo yet: your initials fill the photo space.");
    if (t.uses.logo && !state.logo) notes.push("No logo yet: a monogram of your initials is used.");
    else if (state.back && !state.logo) notes.push("No logo yet: the back shows your company name instead.");
    if (state.back && state.qr && !d.website) notes.push("Add a website to put a QR code on the back.");
    if (state.back && state.qr && d.website && !qrFor(urlOf(d.website))) notes.push("The website is too long for a QR code.");
    if (cut) notes.push("Some text is too long and was cut short (…). Shorten it.");
    const ready = !!d.name;
    if (!ready) notes.unshift("Enter your name to enable downloads.");
    setStatus(notes.join(" "), cut || !ready ? "warn" : "");
    ["pngBtn", "pngBackBtn", "pdfBtn", "sheetBtn"].forEach(id => { $(id).disabled = !ready; });
    if (shareMenu) shareMenu.refresh();
  }
  function setStatus(msg, cls) { const s = $("status"); s.textContent = msg; s.className = "status " + (cls || ""); }

  // ---------- Images (kept in memory, downscaled to a print-friendly size) ----------
  function loadImage(file, key) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 1200, nh = img.naturalHeight || 1200;
      const k = Math.min(1, 2400 / Math.max(nw, nh));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(nw * k)); c.height = Math.max(1, Math.round(nh * k));
      const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      state[key] = c;
      const th = $(key + "Thumb"); th.src = c.toDataURL("image/png"); th.hidden = false;
      $(key + "Clear").hidden = false;
      if (key === "photo") $("photoAdjust").hidden = false;
      // A back image only shows in designs that use one; switch to one if needed.
      if (key === "backImg" && !["image", "split"].includes(state.backId)) state.backId = "image";
      render();
    };
    img.onerror = () => { URL.revokeObjectURL(url); setStatus("That image could not be read. Try a PNG or JPEG.", "warn"); };
    img.src = url;
  }
  function clearImage(key) {
    state[key] = null; $(key + "File").value = ""; $(key + "Thumb").hidden = true; $(key + "Thumb").removeAttribute("src");
    $(key + "Clear").hidden = true;
    if (key === "photo") $("photoAdjust").hidden = true;
    render();
  }

  // ---------- Exports (600 DPI) ----------
  function exportCanvas(side, bleedMm) {
    const c = document.createElement("canvas"), d = withInitials(userData()), P = images();
    drawCard(c, PX_PER_MM_EXPORT, bleedMm, side === "back" ? paintBack(backDesign(), state.tpl, d, P) : paintFront(state.tpl, d, P));
    return c;
  }
  function fileName(ext, extra) {
    const s = ["Business card", clean($("name").value), extra].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, "").slice(0, 80);
    return s + "." + ext;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function setPngDpi(bytes) {
    // Add a pHYs chunk so print software reads the PNG as 600 DPI (not 72).
    const ppm = Math.round(DPI / 0.0254);
    const chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    let crc = -1; for (let i = 4; i < 17; i++) { crc ^= chunk[i]; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }
    dv.setUint32(17, (crc ^ -1) >>> 0);
    const at = 33; // right after the IHDR chunk
    const out = new Uint8Array(bytes.length + 21);
    out.set(bytes.subarray(0, at)); out.set(chunk, at); out.set(bytes.subarray(at), at + 21);
    return out;
  }

  function makePNG(side) {
    const bin = atob(exportCanvas(side, state.bleed ? BLEED_MM : 0).toDataURL("image/png").split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([setPngDpi(bytes)], { type: "image/png" }), name: fileName("png", state.back ? side : "") };
  }
  function exportPNG(side) { const f = makePNG(side); download(f.blob, f.name); }
  function exportPDF() { buildPDF().save(fileName("pdf")); }
  function exportSheet() { buildSheet().save(fileName("pdf", "A4 sheet")); }
  const pdfFile = (doc, name) => ({ blob: doc.output("blob"), name });
  function buildPDF() {
    const sz = SIZES[state.size], b = state.bleed ? BLEED_MM : 0;
    const w = sz.w + 2 * b, h = sz.h + 2 * b;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: [w, h], orientation: "landscape" });
    doc.addImage(exportCanvas("front", b).toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
    if (state.back) {
      doc.addPage([w, h], "landscape");
      doc.addImage(exportCanvas("back", b).toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, w, h);
    }
    return doc;
  }
  // A4, 2 × 5 cards with cut marks. Page 2 holds the backs, columns mirrored so they line up
  // when printed double-sided (flip on long edge).
  function buildSheet() {
    const sz = SIZES[state.size], cols = 2, rows = 5;
    const gx = (210 - cols * sz.w) / 2, gy = (297 - rows * sz.h) / 2;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const marks = () => {
      doc.setDrawColor(120); doc.setLineWidth(0.15);
      const m = 2, len = Math.min(6, gx - m - 1, gy - m - 1);
      for (let c = 0; c <= cols; c++) { const x = gx + c * sz.w; doc.line(x, gy - m - len, x, gy - m); doc.line(x, gy + rows * sz.h + m, x, gy + rows * sz.h + m + len); }
      for (let r = 0; r <= rows; r++) { const y = gy + r * sz.h; doc.line(gx - m - len, y, gx - m, y); doc.line(gx + cols * sz.w + m, y, gx + cols * sz.w + m + len, y); }
    };
    const page = (side, mirror) => {
      const data = exportCanvas(side, 0).toDataURL("image/jpeg", 0.95);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        doc.addImage(data, "JPEG", gx + (mirror ? cols - 1 - c : c) * sz.w, gy + r * sz.h, sz.w, sz.h, side);
      marks();
    };
    page("front", false);
    if (state.back) { doc.addPage("a4", "portrait"); page("back", true); }
    return doc;
  }
  function run(fn, label) {
    setStatus("Preparing " + label + "…");
    setTimeout(() => {
      const ok = () => setStatus(label + " downloaded.", "ok"), bad = e => setStatus("Export failed: " + e.message, "warn");
      try { const r = fn(); if (r && r.then) r.then(ok, bad); else ok(); } catch (e) { bad(e); }
    }, 30);
  }

  // ---------- Init ----------
  if (window.qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  buildGallery();
  buildBacks();
  document.querySelectorAll("#filters button").forEach(b => { b.onclick = () => applyFilter(b.dataset.f); });
  applyFilter("all");
  $("changeTpl").onclick = () => showStep(1);
  FIELDS.forEach(id => $(id).addEventListener("input", schedule));
  ["logo", "photo", "backImg"].forEach(k => {
    $(k + "File").onchange = e => loadImage(e.target.files[0], k);
    $(k + "Clear").onclick = () => clearImage(k);
  });
  ["zoom", "fx", "fy"].forEach(id => $(id).addEventListener("input", () => { state[id] = +$(id).value; schedule(); }));
  $("accent").addEventListener("input", () => { state.accents[state.tpl.id] = $("accent").value; schedule(); });
  $("accentReset").onclick = () => { delete state.accents[state.tpl.id]; $("accent").value = state.tpl.accent; render(); };
  $("size").onchange = () => { state.size = $("size").value; render(); };
  $("bleed").onchange = () => { state.bleed = $("bleed").checked; render(); };
  $("backOn").onchange = () => { state.back = $("backOn").checked; syncFields(); render(); };
  $("qrOn").onchange = () => { state.qr = $("qrOn").checked; render(); };
  $("pngBtn").onclick = () => run(() => exportPNG("front"), state.back ? "Front PNG" : "PNG");
  $("pngBackBtn").onclick = () => run(() => exportPNG("back"), "Back PNG");
  $("pdfBtn").onclick = () => run(exportPDF, "PDF");
  $("sheetBtn").onclick = () => run(exportSheet, "A4 sheet");
  var shareMenu = window.ShareMenu && ShareMenu.attach({
    after: document.querySelector(".stage .actions") || $("pdfBtn").parentNode,
    syncWith: $("pdfBtn"),
    onStatus: (msg, ok) => setStatus(msg, ok ? "ok" : "warn"),
    formats: [
      { label: "PDF · front + back", make: () => pdfFile(buildPDF(), fileName("pdf")), show: () => state.back },
      { label: "PDF", make: () => pdfFile(buildPDF(), fileName("pdf")), show: () => !state.back },
      { label: "Front PNG", make: () => makePNG("front"), show: () => state.back },
      { label: "PNG", make: () => makePNG("front"), show: () => !state.back },
      { label: "Back PNG", make: () => makePNG("back"), show: () => state.back },
      { label: "A4 sheet · 10 cards (PDF)", make: () => pdfFile(buildSheet(), fileName("pdf", "A4 sheet")) },
    ],
  });
  $("clearAll").onclick = () => {
    FIELDS.forEach(id => { $(id).value = ""; });
    state.zoom = 1; state.fx = 0.5; state.fy = 0.3; $("zoom").value = 1; $("fx").value = 0.5; $("fy").value = 0.3;
    state.accents = {}; if (state.tpl) $("accent").value = state.tpl.accent;
    clearImage("logo"); clearImage("photo"); clearImage("backImg");
  };
  window.addEventListener("resize", schedule);

  // Canvas text needs the web fonts loaded first.
  drawThumbs();
  const want = ['400 20px Anton', '400 20px "Space Grotesk"', '700 20px "Space Grotesk"', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"'];
  Promise.all(want.map(f => document.fonts.load(f).catch(() => null))).then(() => { drawThumbs(); render(); });
})();
