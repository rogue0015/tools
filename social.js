/* Social media icons and links shared by the card and flyer apps.
   Social.form(box, onInput, vals) – builds one text box per platform into box; vals holds what was typed
   Social.items(vals)              – [{ id, text, url }] for the filled-in platforms, in a fixed order
   Social.row(ctx, items, x, y, maxW, size, o) – draws icons + handles, top at y, anchored at x
       o: { align: left|center|right, color, iconColor, font, weight, lines, dry }. Shrinks to fit maxW,
       or wraps onto up to o.lines lines first. With o.dry it only measures.
       Returns { w, h, links: [{ x, y, w, h, url }], small } in the same units as the canvas.
   Nothing is stored or sent anywhere. */
(function () {
  var LIST = [
    { id: "ig", label: "Instagram", hint: "@yourname", base: "https://instagram.com/" },
    { id: "fb", label: "Facebook", hint: "yourpage", base: "https://facebook.com/" },
    { id: "x", label: "X", hint: "@yourname", base: "https://x.com/" },
    { id: "li", label: "LinkedIn", hint: "linkedin.com/in/you", base: "https://linkedin.com/in/" },
    { id: "tt", label: "TikTok", hint: "@yourname", base: "https://tiktok.com/@" },
    { id: "yt", label: "YouTube", hint: "@yourchannel", base: "https://youtube.com/@" },
    { id: "wa", label: "WhatsApp", hint: "Number with country code", base: "https://wa.me/", tel: true }
  ];

  // Simple glyphs on a 24-unit grid. f = filled path, s = stroked path.
  var ICONS = {
    ig: { s: "M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3z M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0z",
          f: "M18.4 6.7a1.1 1.1 0 1 1-2.2 0a1.1 1.1 0 1 1 2.2 0z" },
    fb: { f: "M13.6 21.5v-8h2.7l.4-3.1h-3.1V8.4c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H7.8v3.1h2.7v8z" },
    x: { f: "M3.6 3.5h5l11.8 17h-5z M18.3 3.5h2.1l-6.6 7.6-1.1-1.5z M10.3 13.1l1.1 1.5-5.4 5.9H3.9z" },
    li: { f: "M4 9h3.6v11.5H4z M5.8 3.3a2.1 2.1 0 1 1 0 4.2a2.1 2.1 0 1 1 0-4.2z M10 9h3.4v1.6c.5-.9 1.7-1.9 3.6-1.9 3.6 0 4.2 2.3 4.2 5.3v6.5h-3.6v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3v5.8H10z" },
    tt: { f: "M13.6 3h3.2c.2 2 1.6 3.5 3.7 3.7v3.3c-1.4 0-2.6-.4-3.7-1.1V15a5.6 5.6 0 1 1-5.6-5.6h.6v3.3H11a2.4 2.4 0 1 0 2.6 2.4z" },
    yt: { f: "M2.5 8c0-1.9 1.4-3.3 3.3-3.4C8 4.4 10 4.3 12 4.3s4 .1 6.2.3c1.9.1 3.3 1.5 3.3 3.4v8c0 1.9-1.4 3.3-3.3 3.4-2.2.2-4.2.3-6.2.3s-4-.1-6.2-.3C3.9 19.3 2.5 17.9 2.5 16z M10 8.6v6.8l5.8-3.4z", eo: true },
    wa: { s: "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z",
          f: "M8.6 7.9c.3-.4.8-.4 1.1-.1l1 1.7c.2.3.1.7-.2.9l-.6.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.6c.2-.3.6-.4.9-.2l1.7 1c.3.2.4.8.1 1.1-.7.7-1.7 1-2.6.7-2.4-.9-4.2-2.7-5.1-5.1-.3-.9 0-1.9.6-2.5z" }
  };
  var paths = {};
  function pathOf(d) { return paths[d] || (paths[d] = new Path2D(d)); }

  function icon(ctx, id, x, cy, size, color) {
    var ic = ICONS[id]; if (!ic) return;
    ctx.save();
    ctx.translate(x, cy - size / 2); ctx.scale(size / 24, size / 24);
    ctx.fillStyle = ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = ctx.lineCap = "round";
    ctx.shadowColor = "transparent";
    if (ic.s) ctx.stroke(pathOf(ic.s));
    if (ic.f) ctx.fill(pathOf(ic.f), ic.eo ? "evenodd" : "nonzero");
    ctx.restore();
  }

  var isUrl = function (v) { return /\//.test(v) || /\.[a-z]{2,}(\b|$)/i.test(v); };
  function link(p, v) {
    v = v.trim();
    if (p.tel) return p.base + v.replace(/\D/g, "");
    if (isUrl(v)) return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
    return p.base + v.replace(/^@/, "").replace(/\s+/g, "");
  }
  function text(p, v) {
    v = v.trim();
    if (p.tel) return v;
    if (isUrl(v)) return v.replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
    return "@" + v.replace(/^@/, "").replace(/\s+/g, "");
  }
  function items(vals) {
    return LIST.filter(function (p) { return vals && (vals[p.id] || "").trim(); })
      .map(function (p) { return { id: p.id, text: text(p, vals[p.id]), url: link(p, vals[p.id]) }; });
  }

  function form(box, onInput, vals) {
    box.innerHTML = "";
    LIST.forEach(function (p) {
      var d = document.createElement("div");
      var l = document.createElement("label"); l.htmlFor = "soc_" + p.id; l.textContent = p.label;
      var i = document.createElement("input");
      i.type = "text"; i.id = "soc_" + p.id; i.autocomplete = "off"; i.maxLength = 80; i.placeholder = p.hint;
      i.spellcheck = false; i.setAttribute("autocapitalize", "off");
      if (p.tel) i.inputMode = "tel";
      i.value = vals[p.id] || "";
      i.addEventListener("input", function () { vals[p.id] = i.value; onInput(); });
      d.append(l, i); box.append(d);
    });
    return vals;
  }

  // Icon + handle for each platform. If every handle is the same, the icons are grouped and the
  // handle is written once. With o.lines > 1 the platforms wrap onto more lines (each line is
  // `size` * 1.4 tall) instead of shrinking too far.
  function row(ctx, list, x, y, maxW, size, o) {
    o = o || {};
    var same = list.length > 1 && list.every(function (it) { return it.text === list[0].text; });
    var font = function (sz) { return (o.weight || 600) + " " + sz + "px " + (o.font || "Arial, sans-serif"); };
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    function build(sz, part) {
      ctx.font = font(sz);
      var ic = sz * 1.25, parts = [], w = 0;
      if (same) {
        part.forEach(function (it, i) { parts.push({ i: it.id, x: w, w: ic, url: it.url }); w += ic + (i < part.length - 1 ? sz * 0.4 : 0); });
        w += sz * 0.5;
        var tw = ctx.measureText(part[0].text).width;
        parts.push({ s: part[0].text, x: w, w: tw }); w += tw;
      } else {
        part.forEach(function (it, i) {
          var start = w;
          parts.push({ i: it.id, x: w, w: ic }); w += ic + sz * 0.3;
          var tw = ctx.measureText(it.text).width;
          parts.push({ s: it.text, x: w, w: tw }); w += tw;
          parts.push({ x: start, w: w - start, url: it.url });
          if (i < part.length - 1) w += sz * 1.1;
        });
      }
      return { parts: parts, w: w, ic: ic, sz: sz };
    }
    // Split into k lines, all drawn at the largest size that lets every line fit.
    function layout(k) {
      var per = Math.ceil(list.length / k), groups = [];
      for (var i = 0; i < list.length; i += per) groups.push(list.slice(i, i + per));
      var sz = size, Ls;
      for (;;) {
        Ls = groups.map(function (g) { return build(sz, g); });
        if (Ls.every(function (L) { return L.w <= maxW; }) || sz <= size * 0.3) return Ls;
        sz *= 0.93;
      }
    }
    var maxLines = same ? 1 : Math.min(o.lines || 1, list.length), Ls = layout(1);
    for (var k = 2; k <= maxLines && Ls[0].sz < size * 0.8; k++) Ls = layout(k);
    var links = [], lh = size * 1.4;
    if (o.dry) return { w: Math.max.apply(null, Ls.map(function (L) { return L.w; })), h: lh * Ls.length, links: links, small: Ls[0].sz < size * 0.6 };
    ctx.save();
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = o.color || "#000";
    Ls.forEach(function (L, li) {
      var x0 = o.align === "center" ? x - L.w / 2 : o.align === "right" ? x - L.w : x;
      var cy = y + li * lh + size * 0.7;
      ctx.font = font(L.sz);
      L.parts.forEach(function (p) {
        if (p.i) icon(ctx, p.i, x0 + p.x, cy, L.ic, o.iconColor || o.color || "#000");
        if (p.s) ctx.fillText(p.s, x0 + p.x, cy + L.sz * 0.04);
        if (p.url) links.push({ x: x0 + p.x, y: cy - L.ic * 0.6, w: p.w, h: L.ic * 1.2, url: p.url });
      });
    });
    ctx.restore();
    return { w: Math.max.apply(null, Ls.map(function (L) { return L.w; })), h: lh * Ls.length, links: links, small: Ls[0].sz < size * 0.6 };
  }

  window.Social = { LIST: LIST, icon: icon, items: items, form: form, row: row };
})();
