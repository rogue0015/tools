/* "Share via" menu shared by all apps.
   Usage: ShareMenu.attach({ after, syncWith, formats, onStatus })
     after     – element the button goes into (the app's .actions row)
     syncWith  – a download button; the share button is enabled/disabled with it
     formats   – [{ label, make: () => Promise<{ blob, name }> | { blob, name }, show?: () => bool }]
     onStatus  – (msg, ok) => void, shows messages in the app's status line
   Phones that support it get the real file through the system share sheet.
   Elsewhere the file is downloaded and the chosen site opens with the caption filled in,
   because WhatsApp, X, LinkedIn and email links cannot carry a file. */
(function () {
  var SITE = "https://rogue0015.github.io/";
  var CAPTION = "Made with Brandon Bande's free tools: " + SITE;

  var TARGETS = [
    { id: "whatsapp", label: "WhatsApp", url: function (t) { return "https://wa.me/?text=" + encodeURIComponent(t); } },
    { id: "x", label: "X", url: function (t) { return "https://x.com/intent/post?text=" + encodeURIComponent(t); } },
    { id: "linkedin", label: "LinkedIn", url: function (t) { return "https://www.linkedin.com/feed/?shareActive=true&text=" + encodeURIComponent(t); } },
    { id: "email", label: "Email", url: function (t, name) {
        return "mailto:?subject=" + encodeURIComponent(name.replace(/\.[^.]+$/, "")) + "&body=" + encodeURIComponent(t);
      } }
  ];

  var css =
    ".share-panel{ margin-top:10px; padding:12px; border:1px solid var(--line-strong); }" +
    ".share-panel[hidden]{ display:none; }" +
    ".share-panel .share-row{ display:flex; gap:8px; align-items:center; margin-bottom:10px; }" +
    ".share-panel .share-row label{ font-family:var(--mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--paper-dim); margin:0; }" +
    ".share-panel select{ flex:1; min-height:var(--tap); }" +
    ".share-panel .share-targets{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }" +
    "@media (min-width:560px){ .share-panel .share-targets{ grid-template-columns:repeat(4,1fr); } }" +
    ".share-panel .share-hint{ margin:10px 0 0; font-size:12.5px; color:var(--paper-dim); }";

  function addStyle() {
    if (document.getElementById("share-css")) return;
    var s = document.createElement("style"); s.id = "share-css"; s.textContent = css;
    document.head.appendChild(s);
  }

  function isPhone() {
    return window.matchMedia && matchMedia("(pointer:coarse)").matches;
  }

  function saveFile(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function attach(opts) {
    addStyle();
    var status = opts.onStatus || function () {};
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn " + (opts.btnClass || ""); btn.textContent = "Share via…";
    btn.setAttribute("aria-expanded", "false");
    opts.after.appendChild(btn);

    var panel = document.createElement("div");
    panel.className = "share-panel"; panel.hidden = true;
    opts.after.parentNode.insertBefore(panel, opts.after.nextSibling);

    var row = document.createElement("div"); row.className = "share-row";
    var lab = document.createElement("label"); lab.textContent = "File";
    var sel = document.createElement("select");
    sel.id = "shareFormat" + Math.random().toString(36).slice(2, 7); lab.htmlFor = sel.id;
    row.appendChild(lab); row.appendChild(sel);
    panel.appendChild(row);

    var grid = document.createElement("div"); grid.className = "share-targets";
    var tBtns = TARGETS.map(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = t.label;
      b.onclick = function () { go(t); };
      grid.appendChild(b);
      return b;
    });
    panel.appendChild(grid);
    var hint = document.createElement("p"); hint.className = "share-hint";
    panel.appendChild(hint);

    var file = null, token = 0;

    function visibleFormats() {
      return opts.formats.filter(function (f) { return !f.show || f.show(); });
    }
    function fillSelect() {
      var keep = sel.value;
      sel.innerHTML = "";
      visibleFormats().forEach(function (f) {
        var o = document.createElement("option"); o.value = f.label; o.textContent = f.label;
        sel.appendChild(o);
      });
      if (keep && [].some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
      row.hidden = sel.options.length < 2;
    }
    function setTargets(on) { tBtns.forEach(function (b) { b.disabled = !on; }); }

    // Build the file as soon as the menu opens, so the share click itself runs straight away
    // (phones only allow the share sheet right after a tap).
    function prepare() {
      var my = ++token, f = opts.formats.filter(function (x) { return x.label === sel.value; })[0];
      file = null; setTargets(false); hint.textContent = "Preparing file…";
      setTimeout(function () {
        Promise.resolve().then(f.make).then(function (r) {
          if (my !== token) return;
          file = new File([r.blob], r.name, { type: r.blob.type || "application/octet-stream" });
          setTargets(true);
          hint.textContent = canNativeShare()
            ? "The file is attached for you. The caption links to " + SITE
            : "The file downloads, then the site opens with a caption linking to " + SITE + " - attach the file there.";
        }, function (e) {
          if (my !== token) return;
          hint.textContent = "Could not prepare the file: " + e.message;
        });
      }, 30);
    }
    function canNativeShare() {
      return !!(file && isPhone() && navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
    }

    function fallback(t) {
      saveFile(file, file.name);
      var url = t.url(CAPTION, file.name);
      if (t.id === "email") location.href = url;
      else window.open(url, "_blank", "noopener");
      status("Saved " + file.name + " - attach it in " + t.label + ".", true);
    }
    function go(t) {
      if (!file) return;
      if (canNativeShare()) {
        navigator.share({ files: [file], title: file.name, text: CAPTION }).then(function () {
          status("Shared " + file.name + ".", true);
        }, function (e) {
          if (e && e.name === "AbortError") return;
          fallback(t);
        });
      } else fallback(t);
    }

    function close() { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); token++; }
    btn.onclick = function () {
      if (!panel.hidden) { close(); return; }
      fillSelect();
      panel.hidden = false; btn.setAttribute("aria-expanded", "true");
      prepare();
    };
    sel.onchange = prepare;

    // Follow the app's download button: disabled together, and close the menu when downloads
    // switch off. Any edit to the design makes the prepared file stale, so it is rebuilt on reopen.
    function sync() {
      btn.disabled = !!(opts.syncWith && opts.syncWith.disabled);
      if (btn.disabled && !panel.hidden) close();
    }
    if (opts.syncWith) new MutationObserver(sync).observe(opts.syncWith, { attributes: true, attributeFilter: ["disabled"] });
    sync();

    // Apps call refresh() after the design changes so the shared file matches the preview.
    var rt = null;
    function refresh() {
      if (panel.hidden) return;
      file = null; setTargets(false); token++;
      clearTimeout(rt);
      rt = setTimeout(function () { if (!panel.hidden) { fillSelect(); prepare(); } }, 400);
    }
    return { close: close, refresh: refresh };
  }

  window.ShareMenu = { attach: attach, SITE: SITE, CAPTION: CAPTION };
})();
