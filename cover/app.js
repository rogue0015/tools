// Cover Page Maker. No storage, no network: state lives in this closure and dies with the tab.
// Layout follows the university cover-page format: logo, faculty, department, label/value lines, question.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const PAGE_W = 210, PAGE_H = 297, MARGIN = 20, CONTENT_W = PAGE_W - 2 * MARGIN;
  const LABEL_W = 52, FONT_PT = 12, LINE_MM = FONT_PT * (25.4 / 72) * 1.2, ROW_GAP = 4;
  const MAX_MEMBERS = 25;
  const PX_PER_MM = 96 / 25.4;
  const TEXT_IDS = ["faculty", "department", "surname", "name", "regNo", "groupName",
    "programme", "entry", "lecturer", "module", "level", "question"];

  const state = { mode: "one", logo: null, members: [{ s: "", n: "", r: "" }, { s: "", n: "", r: "" }] };

  // ---------- Layout model: one description drives preview, PDF and DOCX ----------
  const val = id => $(id).value.trim().replace(/\s+/g, " ").toUpperCase();

  function buildModel() {
    const m = [];
    if (state.logo) {
      const s = Math.min(60 / state.logo.w, 50 / state.logo.h);
      m.push({ k: "logo", src: state.logo.url, bytes: state.logo.bytes, w: state.logo.w * s, h: state.logo.h * s, after: 8 });
    }
    if (val("faculty")) m.push({ k: "center", text: val("faculty"), after: 5 });
    if (val("department")) m.push({ k: "center", text: val("department"), after: 6 });

    const kv = (label, value) => { if (value) m.push({ k: "kv", label: label + ":", value, after: ROW_GAP }); };
    if (state.mode === "one") {
      kv("SURNAME", val("surname")); kv("NAME", val("name")); kv("REG NUMBER", val("regNo"));
    } else {
      kv("GROUP", val("groupName"));
      let n = 0; // number only the rows that are filled in, so a blank row never leaves a gap
      state.members.forEach(x => {
        const nm = [x.s, x.n].map(t => t.trim().replace(/\s+/g, " ")).filter(Boolean).join(" ").toUpperCase();
        const reg = x.r.trim().toUpperCase();
        const line = [nm, reg && "(" + reg + ")"].filter(Boolean).join(" ");
        if (line) kv("MEMBER " + ++n, line);
      });
    }
    kv("PROGRAMME", val("programme")); kv("MODE OF ENTRY", val("entry")); kv("LECTURER", val("lecturer"));
    kv("MODULE TITLE", val("module")); kv("LEVEL", val("level"));

    if (val("question")) {
      m.push({ k: "gap", mm: 6 });
      m.push({ k: "left", text: "ASSIGNMENT QUESTION", after: 6 });
      m.push({ k: "left", text: $("question").value.trim().replace(/\s+/g, " ").toUpperCase(), after: 0 });
    }
    return { blocks: m };
  }

  // ---------- Preview ----------
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function sheetHTML(model) {
    let h = '<div class="flow">';
    for (const b of model.blocks) {
      const gap = `margin-bottom:${b.after || 0}mm`;
      if (b.k === "logo") h += `<img class="logo" src="${b.src}" alt="" style="width:${b.w}mm;height:${b.h}mm;${gap}">`;
      else if (b.k === "center") h += `<div class="c" style="${gap}">${esc(b.text)}</div>`;
      else if (b.k === "left") h += `<div style="${gap}">${esc(b.text)}</div>`;
      else if (b.k === "gap") h += `<div style="height:${b.mm}mm"></div>`;
      else if (b.k === "kv") h += `<div class="kv" style="${gap}"><div class="k">${esc(b.label)}</div><div class="v">${esc(b.value)}</div></div>`;
    }
    return h + "</div>";
  }

  function fit(wrap, sheet) {
    const scale = wrap.clientWidth / (PAGE_W * PX_PER_MM);
    sheet.style.transform = `scale(${scale})`;
    wrap.style.height = PAGE_H * PX_PER_MM * scale + "px";
  }

  let lastModel = null, blocked = false;
  function render() {
    lastModel = buildModel();
    const html = sheetHTML(lastModel);
    $("sheet").innerHTML = html;
    fit($("wrap"), $("sheet"));
    if ($("dlg").open) { $("dlgSheet").innerHTML = html; fitDialog(); }

    const flow = $("sheet").querySelector(".flow");
    const overflow = flow.offsetTop + flow.offsetHeight > (PAGE_H - 15) * PX_PER_MM;
    const empty = !lastModel.blocks.length;
    setStatus(overflow ? "Too much content for one A4 page. Shorten text or remove members." : empty ? "Fill in some details to see the preview." : "", overflow ? "warn" : "");
    blocked = overflow;
    $("confirm").checked = false; // any edit invalidates the previous confirmation
    updateButtons();
  }

  function fitDialog() {
    $("dlgWrap").style.width = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.8 * (PAGE_W / PAGE_H)) + "px";
    fit($("dlgWrap"), $("dlgSheet"));
  }

  function updateButtons() {
    const ok = $("confirm").checked && !blocked && lastModel && lastModel.blocks.length;
    $("pdfBtn").disabled = $("docxBtn").disabled = !ok;
  }
  function setStatus(msg, cls) { const s = $("status"); s.textContent = msg; s.className = "status " + (cls || ""); }

  // ---------- Form wiring ----------
  function renderMembers() {
    const box = $("members"); box.innerHTML = "";
    state.members.forEach((mem, i) => {
      const row = document.createElement("div"); row.className = "member";
      const mk = (key, ph, label) => {
        const el = document.createElement("input"); el.type = "text"; el.placeholder = ph; el.value = mem[key];
        el.setAttribute("aria-label", `Member ${i + 1} ${label}`);
        el.oninput = () => { mem[key] = el.value; render(); };
        return el;
      };
      const x = document.createElement("button"); x.type = "button"; x.className = "btn"; x.textContent = "×";
      x.setAttribute("aria-label", `Remove member ${i + 1}`);
      x.onclick = () => { state.members.splice(i, 1); renderMembers(); render(); };
      row.append(mk("s", "Surname", "surname"), mk("n", "Name", "name"), mk("r", "Reg no.", "reg number"), x);
      box.append(row);
    });
    $("addMember").disabled = state.members.length >= MAX_MEMBERS;
  }

  function setMode(mode) {
    state.mode = mode;
    $("modeOne").setAttribute("aria-pressed", mode === "one");
    $("modeGroup").setAttribute("aria-pressed", mode === "group");
    $("onePane").hidden = mode !== "one";
    $("groupPane").hidden = mode !== "group";
    render();
  }

  // Downscale the logo in memory; PNG keeps transparency.
  function loadLogo(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL("image/png");
      const bin = atob(data.split(",")[1]); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      state.logo = { url: data, bytes, w: c.width, h: c.height };
      $("logoThumb").src = data; $("logoThumb").hidden = false; $("logoClear").hidden = false;
      render();
    };
    img.onerror = () => { URL.revokeObjectURL(url); setStatus("That image could not be read.", "warn"); };
    img.src = url;
  }
  function clearLogo() {
    state.logo = null; $("logoFile").value = ""; $("logoThumb").hidden = true; $("logoClear").hidden = true; render();
  }

  // ---------- PDF ----------
  // jsPDF's built-in Times only knows WinAnsi; one stray character beyond it corrupts the whole string.
  // Keep what WinAnsi has, drop accents from the rest (Ž -> Z), and use "?" for anything else.
  const WIN_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
  let pdfLossy = 0;
  function pdfSafe(t) {
    let out = "";
    for (const ch of t.normalize("NFC")) {
      if (ch.charCodeAt(0) <= 255 || WIN_EXTRA.includes(ch)) { out += ch; continue; }
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (/^[\x20-\x7e]+$/.test(base)) out += base; else { out += "?"; pdfLossy++; }
    }
    return out;
  }

  function exportPDF() {
    pdfLossy = 0;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.setFont("times", "bold"); doc.setFontSize(FONT_PT);
    const base = FONT_PT * (25.4 / 72) * 0.85; // first-line baseline offset
    let y = MARGIN;
    // splitTextToSize never breaks inside a word, so chop any word wider than the column first.
    const lines = (t, w) => doc.splitTextToSize(pdfSafe(t).split(" ").map(word => {
      if (doc.getTextWidth(word) <= w) return word;
      const parts = []; let cur = "";
      for (const ch of word) {
        if (cur && doc.getTextWidth(cur + ch) > w) { parts.push(cur); cur = ""; }
        cur += ch;
      }
      return parts.concat(cur).join(" ");
    }).join(" "), w);
    for (const b of lastModel.blocks) {
      if (b.k === "logo") { doc.addImage(b.src, "PNG", (PAGE_W - b.w) / 2, y, b.w, b.h); y += b.h + b.after; }
      else if (b.k === "gap") y += b.mm;
      else if (b.k === "center" || b.k === "left") {
        const ls = lines(b.text, CONTENT_W);
        ls.forEach((ln, i) => b.k === "center"
          ? doc.text(ln, PAGE_W / 2, y + base + i * LINE_MM, { align: "center" })
          : doc.text(ln, MARGIN, y + base + i * LINE_MM));
        y += ls.length * LINE_MM + b.after;
      } else if (b.k === "kv") {
        const ls = lines(b.value, CONTENT_W - LABEL_W);
        doc.text(b.label, MARGIN, y + base);
        ls.forEach((ln, i) => doc.text(ln, MARGIN + LABEL_W, y + base + i * LINE_MM));
        y += ls.length * LINE_MM + b.after;
      }
    }
    doc.save(fileName("pdf"));
  }

  // ---------- DOCX ----------
  async function exportDOCX() {
    const D = window.docx;
    const mm2tw = mm => Math.round(mm * 56.6929);
    const run = t => new D.TextRun({ text: t, bold: true, size: FONT_PT * 2, font: "Times New Roman" });
    const kids = [];
    for (const b of lastModel.blocks) {
      const after = mm2tw(b.after || 0);
      if (b.k === "logo") {
        kids.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { after },
          children: [new D.ImageRun({ data: b.bytes, type: "png", transformation: { width: Math.round(b.w * PX_PER_MM), height: Math.round(b.h * PX_PER_MM) } })] }));
      } else if (b.k === "gap") {
        kids.push(new D.Paragraph({ spacing: { after: mm2tw(b.mm) - 280 }, children: [] }));
      } else if (b.k === "center" || b.k === "left") {
        kids.push(new D.Paragraph({ alignment: b.k === "center" ? D.AlignmentType.CENTER : D.AlignmentType.LEFT, spacing: { after }, children: [run(b.text)] }));
      } else if (b.k === "kv") {
        // Label, tab, value; hanging indent keeps wrapped lines in the value column.
        kids.push(new D.Paragraph({
          alignment: D.AlignmentType.JUSTIFIED, spacing: { after },
          indent: { left: mm2tw(LABEL_W), hanging: mm2tw(LABEL_W) },
          tabStops: [{ type: D.TabStopType.LEFT, position: mm2tw(LABEL_W) }],
          children: [run(b.label), new D.TextRun({ children: [new D.Tab()] }), run(b.value)],
        }));
      }
    }
    const m = mm2tw(MARGIN);
    const doc = new D.Document({
      title: "Cover page",
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: m, bottom: m, left: m, right: m } } },
        children: kids.length ? kids : [new D.Paragraph({ children: [] })],
      }],
    });
    download(await D.Packer.toBlob(doc), fileName("docx"));
  }

  // ---------- Helpers ----------
  function fileName(ext) {
    const who = state.mode === "group" ? val("groupName") : [val("surname"), val("name")].filter(Boolean).join(" ");
    const s = ["Cover", val("module"), who].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, "").slice(0, 80);
    return (s || "Cover page") + "." + ext;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function run(fn, label) {
    const ok = () => pdfLossy && label === "PDF"
        ? setStatus(`PDF downloaded, but ${pdfLossy} character(s) it cannot display were replaced with "?". Use the Word file for those.`, "warn")
        : setStatus(label + " downloaded.", "ok"), bad = e => setStatus("Export failed: " + e.message, "warn");
    try { const r = fn(); if (r && r.then) r.then(ok, bad); else ok(); } catch (e) { bad(e); }
  }

  // ---------- Init ----------
  TEXT_IDS.forEach(id => $(id).addEventListener("input", render));
  $("modeOne").onclick = () => setMode("one");
  $("modeGroup").onclick = () => setMode("group");
  $("addMember").onclick = () => { if (state.members.length < MAX_MEMBERS) { state.members.push({ s: "", n: "", r: "" }); renderMembers(); render(); } };
  $("logoFile").onchange = e => loadLogo(e.target.files[0]);
  $("logoClear").onclick = clearLogo;
  $("confirm").onchange = updateButtons;
  $("pdfBtn").onclick = () => run(exportPDF, "PDF");
  $("docxBtn").onclick = () => run(exportDOCX, "Word file");
  $("fullBtn").onclick = () => { $("dlgSheet").innerHTML = sheetHTML(lastModel); $("dlg").showModal(); fitDialog(); };
  $("dlgClose").onclick = () => $("dlg").close();
  $("clearAll").onclick = () => {
    TEXT_IDS.forEach(id => { $(id).value = ""; });
    state.members = [{ s: "", n: "", r: "" }, { s: "", n: "", r: "" }];
    clearLogo(); renderMembers(); render();
  };
  window.addEventListener("resize", () => { fit($("wrap"), $("sheet")); if ($("dlg").open) fitDialog(); });

  renderMembers();
  render();
})();
