// Flyer Maker. Runs entirely in the browser: no network, no storage, no libraries.
// State lives in this closure and is gone when the tab closes.
// A flyer is 100 units wide and 141.42 tall (A-series ratio). Every text box and image slot
// has a fixed position in those units; people edit what a box says, never where it sits.
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const H = 141.42;
  const F = {
    d: 'Anton, Impact, "Arial Narrow", sans-serif',
    s: '"Space Grotesk", Arial, sans-serif',
    g: 'Georgia, "Times New Roman", serif',
  };
  const DEF = { f: "s", wt: 700, c: "#fff", a: "center", n: 1, lh: 1.15 };
  // Text that still looks like a placeholder after someone has edited the box.
  const PH_RX = /\[[^\]]*\]|lorem ipsum|your\s*logo|your\s*website|yourwebsite|@yourhandle|000 000 0000/i;

  // ---------- Template building blocks ----------
  const T = (k, label, fill, x, y, w, h, o = {}) => ({ k, label, fill, x, y, w, h, ...o, type: "t" });
  const I = (k, label, x, y, w, h, o = {}) => ({ k, label, x, y, w, h, ...o, type: "i" });
  // Headings are editable but are design text, so they are never flagged as filler.
  const HD = (k, label, text, x, y, w, h, o = {}) => T(k, label, text, x, y, w, h, { ...o, hdg: 1 });
  // ib: the larger fixed area an uploaded logo image fills (the text version stays in the slim box).
  const LOGO = (y, c = "#fff", o = {}) => T("logo", "Logo or brand name", "[YOUR LOGO HERE]", 20, y, 60, 5.5,
    { s: 4.2, wt: 600, tr: 0.1, c, logo: 1, ib: { x: 22, y: 1.2, w: 56, h: 11 }, ...o });
  const WEB = (y, c = "#fff", o = {}) => T("web", "Website", "[www.yourwebsite.com]", 10, y, 80, 5, { s: 3.2, wt: 500, c, ...o });
  const BOLD = { f: "d", wt: 400 };

  const TEMPLATES = [
    {
      id: "speaker", name: "Speaker Announcement", cat: "event",
      qr: [76, 56, 17], soc: [8, 125.5, 84, 4.5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, g.lin(0, 0, 100, H, "#FF9A1F", "#FF3D6E", "#8A2BE2", "#4B1FA8"));
        g.curve("rgba(40,0,90,.28)", 0, 72, 30, 56, 70, 102, 100, 82);
        g.circ(50, 64, 19.6, "#FF9A1F");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading", "SPEAKER", 6, 12, 88, 16, { ...BOLD, s: 16 }),
        HD("h2", "Sub-heading", "ANNOUNCEMENT", 6, 28, 88, 10, { ...BOLD, s: 10 }),
        I("photo", "Speaker photo", 32, 46, 36, 36, { sh: "c", lbl: "SPEAKER PHOTO" }),
        T("name", "Speaker name", "[Speaker Name]", 6, 85, 88, 8, { s: 6.4, up: 1 }),
        T("role", "Title / organisation", "[Title / Organisation]", 6, 93, 88, 5, { s: 3.2, wt: 500, up: 1, tr: 0.06 }),
        T("topic", "Topic", "Topic: [Presentation Title]", 6, 99, 88, 10, { s: 4.4, n: 2, c: "#FFD84D" }),
        T("when", "Date, time & location", "[Date & Time]\n[Location]", 8, 112, 46, 13, { s: 4.4, n: 2, a: "left" }),
        HD("cta", "Button", "REGISTER NOW", 58, 114, 34, 9, { s: 4, bg: "#FF9A1F", r: 4.5 }),
        WEB(130),
      ],
    },
    {
      id: "event", name: "Event Announcement", cat: "event",
      qr: [81, 90, 14], soc: [10, 128, 80, 5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#0A1A55");
        [["#FFD400", -12, 24, 34, 6, -22], ["#00C2FF", 58, 3, 52, 6, 28], ["#FF2E88", -6, 46, 42, 5, 32],
         ["#FF7A00", 68, 42, 46, 6, -28], ["#7CFF4F", 78, 92, 32, 4, 18], ["#00C2FF", -8, 96, 36, 5, -18]]
          .forEach(([c, x, y, w, h, r]) => g.rot(x + w / 2, y + h / 2, r, () => g.rr(x, y, w, h, h / 2, c, 0.85)));
        g.rect(0, 116, 100, H - 116, "#071040");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading", "EVENT", 6, 12, 88, 17, { ...BOLD, s: 17, c: "#FFD400" }),
        HD("h2", "Sub-heading", "ANNOUNCEMENT", 6, 29, 88, 10, { ...BOLD, s: 10, c: "#FFD400" }),
        T("name", "Event name", "[EVENT NAME]", 6, 40, 88, 10, { s: 8, sh: ["rgba(0,0,0,.5)", 0.4, 0.6] }),
        I("art", "Event artwork", 12, 53, 76, 34, { r: 2, bd: ["#fff", 0.8], lbl: "EVENT ARTWORK" }),
        T("when", "Date / time", "[Date / Time]", 6, 90, 88, 7, { ...BOLD, s: 6.4, c: "#FFD400" }),
        T("venue", "Location / venue", "[Location / Venue]", 6, 97, 88, 7, { ...BOLD, s: 6.4, c: "#FFD400" }),
        T("feat", "Featuring", "Featuring: [Highlights]", 6, 105, 88, 9, { s: 4, n: 2, wt: 600 }),
        HD("cta", "Call to action", "GET TICKETS NOW / LEARN MORE", 6, 120, 88, 7, { s: 4, c: "#3FD0FF" }),
        WEB(134, "#fff", { s: 2.8 }),
      ],
    },
    {
      id: "tip", name: "Tip of the Day", cat: "biz",
      qr: [83, 129.5, 11], soc: [6, 126, 44, 4.5, "#163F45", "left", 3],
      bg(g) {
        const ink = "#163F45";
        g.rect(0, 0, 100, H, "#C4EEE8");
        g.poly("#7ED6CC", 0, 0, 100, 0, 100, 46, 0, 54);
        const bx = 85, by = 20;
        for (let i = 0; i < 7; i++) {
          const a = (-180 + i * 30) * Math.PI / 180;
          g.line(bx + Math.cos(a) * 9.5, by + Math.sin(a) * 9.5, bx + Math.cos(a) * 12.5, by + Math.sin(a) * 12.5, 0.9, ink);
        }
        g.circ(bx, by, 7, "#FFD84D"); g.ring(bx, by, 7, 0.9, ink);
        g.rr(bx - 3.5, by + 6.6, 7, 4.2, 1, ink);
        [[-1.6, "-"], [0.6, "-"], [2.8, "-"]].forEach(([dy]) => g.line(bx - 2.6, by + dy - 1, bx + 2.6, by + dy - 1, 0.7, ink));
        g.shadow(() => g.rr(8, 52, 84, 52, 3, "#fff"));
        g.poly("#fff", 20, 103, 32, 103, 17, 113);
        g.rr(8, 52, 84, 9, 3, "#FFD84D"); g.rect(8, 57, 84, 4, "#FFD84D");
        g.poly("#FFD84D", 54, 114, 100, 110, 100, H, 50, H);
      },
      items: [
        HD("h1", "Heading line 1", "TIP OF", 6, 5, 70, 22, { ...BOLD, s: 22, a: "left", c: "#FFD84D", st: ["#163F45", 1.1] }),
        HD("h2", "Heading line 2", "THE DAY", 6, 27, 88, 22, { ...BOLD, s: 22, a: "left", c: "#FFD84D", st: ["#163F45", 1.1] }),
        T("head", "Tip headline", "Today's tip: [Tip Headline]", 11, 52, 78, 9, { s: 3.8, c: "#163F45", a: "left" }),
        T("body", "Tip", "[Write a helpful tip or piece of advice here. Keep it short and practical so people can use it today.]", 12, 64, 76, 37, { s: 4, n: 9, wt: 400, c: "#163F45", a: "left", va: "top", lh: 1.3 }),
        HD("share", "Footer line", "SHARE THIS TIP", 6, 118, 42, 7, { s: 4, c: "#163F45", a: "left" }),
        LOGO(116.5, "#163F45", { x: 56, w: 38, s: 3.6, ib: { x: 56, y: 111.5, w: 38, h: 11.5 } }),
        WEB(123.5, "#163F45", { x: 56, w: 38, s: 2.8 }),
      ],
    },
    {
      id: "hiring", name: "We Are Hiring", cat: "biz",
      qr: [84, 114, 12], soc: [6, 134, 88, 5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#0E1E3F");
        g.rect(0, 60, 100, 14, "#BDEFF8");
        g.rect(0, 74, 100, 38, "#fff");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading line 1", "WE ARE", 6, 12, 88, 19, { ...BOLD, s: 19 }),
        HD("h2", "Heading line 2", "HIRING!", 6, 31, 88, 26, { ...BOLD, s: 26, c: "#1CC8E8" }),
        HD("band", "Band text", "COMPANIES ATTENDING & POSITIONS AVAILABLE", 8, 61, 84, 12, { s: 3.8, n: 2, c: "#0E1E3F" }),
        T("when", "Date, time & location", "[Date]  [Time]  [Location]", 6, 77, 88, 8, { s: 4.6, c: "#0E1E3F" }),
        T("roles", "Industries or roles (one per line)", "[Industry]\n[Industry]\n[Position]\n[Position]", 12, 88, 76, 20, { s: 4, n: 3, cols: 2, bul: 1, a: "left", wt: 600, c: "#0E1E3F" }),
        HD("cta", "Call to action", "BRING YOUR RESUME!", 6, 117, 88, 9, { s: 5.6, c: "#1CC8E8" }),
        T("reg", "Register line", "Register at [website.com]", 6, 127, 88, 6, { s: 3.6, wt: 500 }),
      ],
    },
    {
      id: "jobfair", name: "Job Fair", cat: "biz",
      qr: [84, 118, 12], soc: [6, 135.5, 88, 4.5, "#13254A"],
      bg(g) {
        g.rect(0, 0, 100, H, "#13254A");
        g.poly("#1CC8E8", 0, 0, 24, 0, 0, 16);
        g.line(28, 48.5, 72, 48.5, 0.6, "#1CC8E8");
        g.rect(0, 116, 100, H - 116, "#1CC8E8");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading line 1", "WE ARE", 6, 12, 88, 14, { ...BOLD, s: 14 }),
        HD("h2", "Heading line 2", "HIRING!", 6, 26, 88, 20, { ...BOLD, s: 20, c: "#1CC8E8" }),
        HD("h3", "Event type", "JOB FAIR", 6, 51, 88, 17, { ...BOLD, s: 17 }),
        T("sub", "Sub-line", "[Companies attending & positions available]", 6, 69, 88, 6, { s: 3.2, up: 1, c: "#1CC8E8" }),
        T("when", "Date, time & location", "[Date]  [Time]  [Location]", 6, 79, 88, 8, { s: 4.6 }),
        T("roles", "Industries or roles (one per line)", "[Industry]\n[Industry]\n[Position]\n[Position]", 12, 90, 76, 20, { s: 4, n: 3, cols: 2, bul: 1, a: "left", wt: 600 }),
        HD("cta", "Call to action", "BRING YOUR RESUME!", 6, 119, 88, 9, { s: 5.6, c: "#13254A" }),
        T("reg", "Register line", "Register at [website.com]", 6, 129, 88, 6, { s: 3.6, wt: 500, c: "#13254A" }),
      ],
    },
    {
      id: "flash", name: "Flash Sale", cat: "sale",
      qr: [87, 2.5, 10], soc: [56, 122, 40, 4.5, "#111", "left", 4],
      bg(g) {
        g.rect(0, 0, 100, H, "#E3171E");
        for (let i = 0; i < 24; i += 2) {
          const a0 = i * Math.PI / 12, a1 = (i + 1) * Math.PI / 12;
          g.poly("#F23A2F", 50, 45, 50 + Math.cos(a0) * 150, 45 + Math.sin(a0) * 150, 50 + Math.cos(a1) * 150, 45 + Math.sin(a1) * 150);
        }
        g.poly("#111", 0, 85, 100, 67, 100, 71, 0, 89);
        g.poly("#FFD21F", 0, 89, 100, 71, 100, H, 0, H);
        g.star(23, 99, 16, 12.5, 14, "#111");
        g.line(10, 124.5, 48, 124.5, 0.5, "#111");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading line 1", "FLASH", 4, 12, 92, 28, { ...BOLD, s: 28, skew: -0.2, st: ["#111", 1.8] }),
        HD("h2", "Heading line 2", "SALE!", 4, 38, 92, 32, { ...BOLD, s: 32, skew: -0.2, c: "#FFD21F", st: ["#111", 1.8] }),
        HD("upto", "Badge top", "UP TO", 8, 89.5, 30, 5, { s: 3.6 }),
        T("pct", "Discount", "[50%]", 8, 94, 30, 11, { ...BOLD, s: 11 }),
        HD("off", "Badge bottom", "OFF", 8, 104.5, 30, 5, { s: 3.6 }),
        I("product", "Product image", 56, 82, 38, 38, { r: 3, bd: ["#111", 1], lbl: "PRODUCT IMAGE", ph: "#F2F2F2" }),
        HD("limited", "Small print", "LIMITED TIME ONLY", 4, 118, 50, 6, { s: 3.4, c: "#111" }),
        HD("cta", "Call to action", "SHOP NOW", 4, 125, 50, 8, { ...BOLD, s: 8, c: "#111" }),
        WEB(133, "#111", { x: 4, w: 50, s: 3 }),
      ],
    },
    {
      id: "arrivals", name: "New Arrivals", cat: "sale",
      qr: [84, 124, 12], soc: [6, 136, 88, 4.5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#F9E3D8");
        g.circ(0, 0, 22, "#D98B74");
        g.poly("#EDBFAA", 62, 26, 100, 18, 100, 112, 74, 118);
        g.rect(0, 122, 100, H - 122, "#C9705A");
      },
      items: [
        LOGO(4, "#5A3328"),
        HD("h1", "Heading", "NEW ARRIVALS", 6, 12, 88, 12, { ...BOLD, s: 12, c: "#C25F48" }),
        HD("h2", "Sub-heading", "INTRODUCING", 6, 24, 88, 7, { s: 6, c: "#3A2620" }),
        T("name", "Product name", "[PRODUCT NAME]", 6, 31, 88, 7, { s: 5.4, up: 1, c: "#3A2620" }),
        I("product", "Product image", 12, 41, 76, 50, { lbl: "IMAGE OF PRODUCT" }),
        HD("line", "Tagline", "SHOP THE NEW COLLECTION", 6, 95, 88, 7, { s: 4.4, c: "#3A2620" }),
        T("feat", "Features", "Features: [100% quality, unique design]", 8, 103, 84, 10, { s: 3.6, n: 2, wt: 500, c: "#3A2620" }),
        HD("cta", "Call to action", "SHOP ONLINE", 6, 124, 88, 7, { s: 4.8 }),
        WEB(131),
      ],
    },
    {
      id: "charity", name: "Charity Fundraiser", cat: "community",
      qr: [84, 123.5, 12.5], soc: [6, 133.5, 88, 5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#3C7A2E");
        g.rr(6, 55, 88, 55, 2, "#fff");
        g.line(50, 92, 50, 107, 0.5, "#F07A1E");
        g.rect(0, 113, 100, 9, "#F07A1E");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading line 1", "CHARITY", 6, 12, 88, 17, { ...BOLD, s: 17 }),
        HD("h2", "Heading line 2", "FUNDRAISER", 6, 29, 88, 14, { ...BOLD, s: 14, c: "#F79A2E" }),
        T("cause", "Cause", "Support [Cause Name]", 6, 44, 88, 8, { s: 4.8, up: 1 }),
        I("p1", "Cause photo", 9, 58, 40, 31, { lbl: "CAUSE PHOTO" }),
        I("p2", "Team photo", 51, 58, 40, 31, { lbl: "TEAM PHOTO" }),
        T("goal", "Goal", "Goal:\n[Target]", 9, 91, 39, 17, { s: 4.6, n: 2, c: "#2C2C2C" }),
        T("when", "Date, time & location", "[Date & Time]\n[Location]", 52, 91, 39, 17, { s: 4.4, n: 2, c: "#2C2C2C" }),
        HD("cta", "Call to action", "DONATE OR VOLUNTEER TODAY", 6, 113, 88, 9, { s: 4.4 }),
        WEB(127),
      ],
    },
    {
      id: "cause", name: "Support a Cause", cat: "community",
      qr: [84, 124, 12.5], soc: [6, 134, 88, 5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#E06A1B");
        g.poly("#13513A", 0, 72, 100, 60, 100, H, 0, H);
      },
      items: [
        LOGO(4),
        HD("h1", "Heading", "SUPPORT", 6, 12, 88, 16, { ...BOLD, s: 16 }),
        T("cause", "Cause name", "[CAUSE NAME]", 6, 28, 88, 9, { s: 7, up: 1 }),
        I("p1", "Photo 1", 8, 42, 41, 31, { rot: -6, fr: 1.6, lbl: "COMMUNITY PHOTO" }),
        I("p2", "Photo 2", 51, 45, 41, 31, { rot: 5, fr: 1.6, lbl: "CAUSE PHOTO" }),
        HD("h2", "Section heading", "GET INVOLVED", 6, 86, 88, 9, { ...BOLD, s: 8, c: "#F7943A" }),
        T("body", "About the cause", "[Tell people about the cause in a sentence or two: who it helps and how they can join in.]", 8, 96, 84, 17, { s: 3.6, n: 4, wt: 400 }),
        T("extra", "Helpful note", "[Drop-off point, volunteer hours or another helpful note]", 8, 114, 84, 9, { s: 3.2, n: 2, wt: 600, c: "#F7943A" }),
        WEB(128),
      ],
    },
    {
      id: "meet", name: "Meet & Greet", cat: "event",
      qr: [84, 97, 11], soc: [8, 125.5, 84, 4.5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, g.lin(0, 0, 100, H, "#2B0A8C", "#6A0DAD", "#B5179E"));
        g.circ(92, 18, 30, "rgba(247,37,133,.35)");
        g.circ(4, 112, 28, "rgba(76,201,240,.18)");
        g.circ(82, 124, 22, "rgba(247,37,133,.25)");
      },
      items: [
        LOGO(4),
        HD("h1", "Heading line 1", "MEET &", 6, 12, 88, 17, { ...BOLD, s: 17 }),
        HD("h2", "Heading line 2", "GREET", 6, 29, 88, 21, { ...BOLD, s: 21 }),
        T("who", "Who", "[PERSON / BAND] LIVE!", 6, 51, 88, 7, { s: 5, up: 1 }),
        I("guest", "Guest photo", 8, 62, 42, 48, { r: 2, bd: ["#F72585", 1.4], lbl: "GUEST PHOTO" }),
        T("details", "Venue, date & time", "[Venue]\n[Date / Time]", 54, 62, 40, 16, { s: 4.4, n: 3, a: "left" }),
        HD("hl", "List heading", "Highlights:", 54, 80, 40, 6, { s: 4.4, a: "left" }),
        T("list", "Highlights (one per line)", "[Autographs]\n[Photos]\n[Q&A]", 54, 86, 40, 22, { s: 3.8, n: 5, bul: 1, a: "left", wt: 500 }),
        HD("cta", "Button", "BOOK NOW", 8, 115, 42, 9, { s: 4.6, bg: "#F72585", r: 4.5 }),
        HD("free", "Small print", "FREE ENTRY\nWITH RSVP", 54, 113.5, 40, 12, { s: 4.2, n: 2, a: "left" }),
        WEB(130),
      ],
    },
    {
      id: "mega", name: "Mega Sale", cat: "sale",
      qr: [82, 110, 12], soc: [20, 130, 60, 5, "#222"],
      bg(g) {
        g.rect(0, 0, 100, H, "#fff");
        g.path("#E01B24", c => { c.moveTo(0, 0); c.lineTo(100, 0); c.lineTo(100, 96); c.quadraticCurveTo(50, 118, 0, 96); });
        g.poly("#FFD21F", 0, 2, 52, 0, 54, 11, 0, 15);
        g.circ(50, 76, 27.5, "#FFD21F");
        g.circ(82, 62, 12, "#111");
        [[16, 100, -28], [84, 100, 28]].forEach(([x, y, r]) => g.rot(x, y, r, () => {
          g.rr(x - 12, y - 4.5, 24, 9, 1.4, "#C0141B"); g.circ(x - 10, y, 0.8, "#fff");
        }));
        g.star(10, 48, 3.2, 0.7, 4, "#fff"); g.star(93, 40, 2.4, 0.6, 4, "#FFD21F"); g.star(7, 82, 2, 0.5, 4, "#FFD21F");
        g.poly("#FFD21F", 0, H, 0, 124, 16, H); g.poly("#FFD21F", 100, H, 100, 124, 84, H);
      },
      items: [
        HD("tag", "Corner tag", "SPECIAL SALE", 2, 2, 50, 11, { ...BOLD, s: 6.4, rot: -4, c: "#B3121A" }),
        HD("h1", "Heading line 1", "MEGA", 6, 14, 88, 20, { ...BOLD, s: 22, skew: -0.15, sh: ["rgba(0,0,0,.3)", 0.4, 0.6] }),
        HD("h2", "Heading line 2", "SALE!", 6, 32, 88, 20, { ...BOLD, s: 22, skew: -0.15, c: "#FFD21F", sh: ["rgba(0,0,0,.3)", 0.4, 0.6] }),
        I("photo", "Product photo", 25, 51, 50, 50, { sh: "c", lbl: "PRODUCT PHOTO" }),
        HD("upto", "Badge top", "UP TO", 71, 52, 22, 4.5, { s: 2.8 }),
        T("pct", "Discount", "[50%]", 73, 56, 18, 10, { ...BOLD, s: 8 }),
        HD("off", "Badge bottom", "OFF", 71, 66, 22, 4.5, { s: 2.8 }),
        T("price1", "Price tag (left)", "[$2.99]", 4, 95.5, 24, 9, { s: 4.4, rot: -28, p: 3.5 }),
        T("price2", "Price tag (right)", "[$2.99]", 72, 95.5, 24, 9, { s: 4.4, rot: 28, p: 3.5 }),
        HD("cta", "Button", "SHOP NOW", 30, 112, 40, 9, { s: 4.4, bg: "#C0141B", r: 4.5 }),
        WEB(124, "#222", { x: 20, w: 60 }),
      ],
    },
    {
      id: "launch", name: "Product Launch", cat: "sale",
      qr: [74, 116, 20], soc: [6, 132, 62, 5, "#ccc", "left"],
      bg(g) {
        g.rect(0, 0, 100, H, g.rad(50, 55, 85, "#30353D", "#0A0B0D"));
        g.circ(50, 60, 32, "rgba(61,224,210,.07)");
        g.rect(0, 112, 100, H - 112, "#15171B");
        g.rect(0, 112, 100, 0.5, "#3DE0D2");
      },
      items: [
        LOGO(5, "#ddd"),
        HD("h1", "Heading", "INTRODUCING", 6, 12, 88, 10, { ...BOLD, s: 10, c: "#C9CED6" }),
        T("name", "Product name", "THE NEW [PRODUCT]", 6, 22, 88, 14, { ...BOLD, s: 13, c: "#3DE0D2", gl: ["rgba(61,224,210,.6)", 2] }),
        I("product", "Product image", 16, 40, 68, 40, { r: 2, bd: ["#555", 0.6], lbl: "PRODUCT IMAGE", ph: "#2A2E34" }),
        HD("kf", "List heading", "Key Features", 6, 84, 88, 6, { s: 4.6, c: "#7CD957" }),
        T("feat", "Features (one per line)", "[Feature]\n[Feature]\n[Feature]\n[Feature]\n[Feature]\n[Feature]", 8, 91, 84, 18, { s: 3.4, n: 3, cols: 2, bul: 1, a: "left", wt: 500, c: "#ddd" }),
        HD("cta", "Call to action", "PRE-ORDER TODAY", 6, 116, 62, 9, { s: 6.4, c: "#3DE0D2", a: "left" }),
        T("subline", "Short line", "[Short product line here]", 6, 125, 62, 6, { s: 3.4, wt: 500, c: "#ccc", a: "left" }),
      ],
    },
    {
      id: "service", name: "Professional Services", cat: "biz",
      qr: [84, 13, 11], soc: [5, 136.5, 90, 4.2, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, "#F4F7F9");
        g.poly("#0F4C6E", 42, 0, 100, 0, 100, 9, 36, 9);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
          const x = 5 + c * 30.5, y = 40 + r * 22;
          g.rr(x, y, 28.5, 20, 1.2, "#D3ECF1");
          g.circ(x + 14.25, y + 4.6, 3.2, "#0F6E8C");
          g.path(null, p => { p.moveTo(x + 12.7, y + 4.7); p.lineTo(x + 13.9, y + 5.9); p.lineTo(x + 16, y + 3.4); }, "#fff", 0.6);
        }
        g.poly("#0F4C6E", 0, 127, 100, 120, 100, H, 0, H);
      },
      items: [
        LOGO(2, "#0F4C6E", { x: 5, w: 33, s: 3.8, a: "left", ib: { x: 5, y: 1.5, w: 30, h: 10 } }),
        WEB(1.5, "#fff", { x: 44, w: 52, s: 2.6, a: "right", h: 6 }),
        HD("h1", "Heading", "PROFESSIONAL", 5, 13, 90, 13, { ...BOLD, s: 13, a: "left", c: "#1C8FA8" }),
        T("type", "Service type", "[SERVICE TYPE]", 5, 26, 90, 12, { ...BOLD, s: 12, a: "left", c: "#0F2D45" }),
        ...[0, 1, 2, 3, 4, 5].map(i => T("s" + (i + 1), "Service tile " + (i + 1), "[Service]\n[One-line benefit]",
          6 + (i % 3) * 30.5, 49 + Math.floor(i / 3) * 22, 26.5, 10.5, { s: 2.6, n: 4, wt: 400, c: "#33505F", first: [1.3, "#0F2D45"] })),
        HD("why", "Section heading", "Why Choose Us?", 5, 86, 50, 6, { s: 4.4, a: "left", c: "#0F4C6E" }),
        T("whyBody", "Why choose us", "[Two or three lines on what makes you different from everyone else.]", 5, 92, 51, 15, { s: 3, n: 4, wt: 400, a: "left", va: "top", c: "#33505F", lh: 1.3 }),
        I("team", "Team photo", 60, 86, 35, 26, { r: 1, lbl: "TEAM PHOTO" }),
        T("caption", "Photo caption", "[Happy clients / Our team]", 60, 113, 35, 5, { s: 2.8, c: "#0F2D45" }),
        T("contact", "Contact details", "[+000 000 0000]\n[email@yourbusiness.com]", 5, 108, 51, 11, { s: 3, n: 2, wt: 500, a: "left", c: "#0F2D45" }),
        HD("foot", "Footer line", "CALL TODAY FOR A FREE QUOTE", 5, 129, 90, 8, { s: 4.4 }),
      ],
    },
    {
      id: "community", name: "Community Event", cat: "community",
      qr: [83, 124, 12], soc: [8, 134.5, 84, 4.5, "#fff"],
      bg(g) {
        g.rect(0, 0, 100, H, g.lin(0, 0, 0, 110, "#AEE0FF", "#EAF7FF"));
        g.ellipse(18, 126, 70, 28, "#86C95F");
        g.ellipse(86, 128, 60, 26, "#6DB84B");
        g.rect(0, 118, 100, H - 118, "#4F9A36");
        const tree = (x, y) => { g.rect(x - 1, y, 2, 16, "#7A4B2A"); g.circ(x, y - 2, 6, "#3E8E2F"); g.circ(x - 4, y + 2, 4.5, "#4BA23A"); g.circ(x + 4, y + 2, 4.5, "#4BA23A"); };
        tree(7, 100); tree(93, 102);
        g.path(null, p => { p.moveTo(0, 3); p.quadraticCurveTo(50, 17, 100, 3); }, "#555", 0.3);
        const cols = ["#E63946", "#F4A261", "#E9C46A", "#2A9D8F", "#457B9D", "#8E44AD"];
        for (let i = 0; i < 10; i++) {
          const x = 5 + i * 10, t = x / 100, y = 3 + 14 * t * (1 - t);
          g.poly(cols[i % cols.length], x - 3.6, y, x + 3.6, y, x, y + 7);
        }
      },
      items: [
        LOGO(13, "#334", { ib: { x: 30, y: 11.5, w: 40, h: 7 } }),
        HD("h1", "Heading", "COMMUNITY", 6, 18.5, 88, 16, { ...BOLD, s: 16, rb: ["#E63946", "#F4A261", "#E9C46A", "#2A9D8F", "#457B9D", "#8E44AD"] }),
        T("name", "Event name", "[EVENT NAME]", 6, 34.5, 88, 11, { ...BOLD, s: 11, c: "#1D2B3A" }),
        I("photo", "Event photo", 14, 48, 72, 34, { r: 2, lbl: "EVENT PHOTO" }),
        T("when", "Date, time & location", "[Date] • [Time] • [Location]", 14, 85, 72, 7, { ...BOLD, s: 6, c: "#1D2B3A" }),
        HD("free", "Highlight line", "Free Admission", 14, 93, 72, 6, { s: 4.6, c: "#E63946" }),
        T("act", "Activities", "Activities include:\n[Games, food stalls, live music]", 15, 99, 70, 14, { s: 3.4, n: 3, wt: 500, c: "#1D2B3A", first: [1.2] }),
        T("contact", "Contact details", "Contact: [+000 000 0000]\n[www.yourwebsite.com]", 8, 122, 84, 14, { s: 3.4, n: 2, wt: 600 }),
      ],
    },
    {
      id: "music", name: "Live Music Night", cat: "event",
      qr: [84, 123, 12], soc: [6, 137, 88, 4.2, "#ccc"],
      bg(g) {
        g.rect(0, 0, 100, H, g.lin(0, 0, 0, H, "#0B0425", "#2A0E5C", "#0B0425"));
        g.poly("rgba(255,43,214,.16)", 0, 0, 12, 0, 62, 100, 32, 100);
        g.poly("rgba(43,182,255,.16)", 100, 0, 88, 0, 38, 100, 68, 100);
        const eq = g.lin(0, 72, 0, 96, "#2BB6FF", "#FF2BD6");
        for (let i = 0; i < 50; i++) { const h = 4 + 18 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)); g.rect(0.6 + i * 2, 96 - h, 1.2, h, eq); }
        const crowd = "#05020F";
        g.rect(0, 100, 100, 8, crowd);
        for (let i = 0; i < 14; i++) {
          const x = 3 + i * 7.3 + (i % 2) * 1.5, y = 96.5 + (i % 3) * 1.4;
          g.circ(x, y, 2.6, crowd); g.rr(x - 3.6, y + 2, 7.2, 6, 2.5, crowd);
          if (i % 3 === 1) g.line(x + 2.6, y + 3, x + 4.8, y - 7, 1.3, crowd);
          if (i % 4 === 2) g.line(x - 2.6, y + 3, x - 4.6, y - 6, 1.3, crowd);
        }
        g.line(50, 110, 50, 120, 0.35, "rgba(255,255,255,.6)");
      },
      items: [
        LOGO(4, "#ccc"),
        HD("h1", "Heading line 1", "LIVE", 6, 12, 88, 19, { ...BOLD, s: 19, c: "#FFE3F8", gl: ["#FF2BD6", 2.6] }),
        HD("h2", "Heading line 2", "MUSIC", 6, 31, 88, 22, { ...BOLD, s: 22, c: "#DDF6FF", gl: ["#2BB6FF", 2.6] }),
        HD("sub", "Sub-heading", "NIGHT / FESTIVAL", 6, 54, 88, 7, { s: 5.2 }),
        T("a1", "Artists (left)", "[Artist]\n[Artist]", 6, 109, 42, 12, { s: 4.4, n: 3, up: 1 }),
        T("a2", "Artists (right)", "[Artist]\n[Artist]", 52, 109, 42, 12, { s: 4.4, n: 3, up: 1 }),
        HD("cta", "Call to action", "GET YOUR TICKETS", 6, 123, 88, 7, { s: 5, c: "#47E3FF" }),
        T("vendors", "Where to buy", "[Ticket vendor]  ·  [www.tickets.com]", 6, 131, 88, 6, { s: 3, wt: 500, c: "#ccc" }),
      ],
    },
    {
      id: "workshop", name: "Upcoming Workshop", cat: "event",
      qr: [84, 126, 12], soc: [6, 135, 70, 4.5, "#fff", "left"],
      bg(g) {
        g.rect(0, 0, 100, H, "#fff");
        g.poly("#10294A", 0, 0, 100, 0, 100, 38, 0, 52);
        g.poly("#3FB8D1", 0, 52, 100, 38, 100, 43, 0, 57);
        g.rect(0, 124, 100, H - 124, "#10294A");
        g.rect(0, 124, 100, 0.8, "#3FB8D1");
      },
      items: [
        LOGO(4, "#fff", { x: 6, w: 44, a: "left", ib: { x: 6, y: 1.5, w: 44, h: 9 } }),
        HD("h1", "Heading line 1", "UPCOMING", 6, 11, 88, 12, { ...BOLD, s: 12, a: "left" }),
        HD("h2", "Heading line 2", "WORKSHOP", 6, 23, 88, 14, { ...BOLD, s: 14, a: "left", c: "#5FD0E6" }),
        I("photo", "Speaker photo", 6, 42, 32, 32, { sh: "c", bd: ["#fff", 1.4], lbl: "SPEAKER" }),
        T("speaker", "Speaker name & bio", "[Speaker Name]\n[Short speaker bio, one or two lines.]", 42, 60, 52, 20, { s: 3.2, n: 5, wt: 400, a: "left", va: "top", c: "#444", first: [1.45, "#10294A"] }),
        HD("lh", "List heading", "WHAT YOU WILL LEARN", 6, 84, 88, 6, { s: 4, a: "left", c: "#10294A" }),
        T("learn", "What people learn (one per line)", "[Lesson]\n[Lesson]\n[Lesson]", 6, 90, 88, 18, { s: 3.4, n: 4, bul: 1, wt: 500, a: "left", va: "top", c: "#333", lh: 1.35 }),
        T("when", "Date & time", "[Date & Time]", 6, 110, 50, 9, { ...BOLD, s: 7, a: "left", c: "#10294A" }),
        HD("tag", "Tag", "Limited spots available", 58, 110.5, 36, 8, { s: 3, wt: 600, bg: "#10294A" }),
        T("reg", "Register line", "Register at: [www.website.com]", 6, 127, 88, 9, { s: 3.8, wt: 600, a: "left" }),
      ],
    },
    {
      id: "feast", name: "Weekend Feast", cat: "food",
      qr: [84, 108, 12], soc: [6, 124, 88, 5, "#F2B45A"],
      bg(g) {
        g.rect(0, 0, 100, H, "#3A2416");
        for (let i = 0; i < 14; i++) g.rect(0, i * 10.2 + (i % 3), 100, 0.35, "rgba(0,0,0,.25)");
        g.rect(0, 0, 100, H, g.rad(50, 60, 95, "rgba(0,0,0,0)", "rgba(0,0,0,.55)"));
        g.line(3, 33, 9, 33, 0.6, "#F2B45A"); g.line(91, 33, 97, 33, 0.6, "#F2B45A");
        g.circ(27, 71, 24.5, "#151515"); g.circ(73, 73, 24.5, "#151515");
      },
      items: [
        HD("h1", "Heading line 1", "Weekend", 10, 6, 80, 15, { f: "g", it: 1, s: 15, c: "#F2B45A" }),
        HD("h2", "Heading line 2", "Feast", 10, 20, 80, 25, { f: "g", it: 1, s: 25, c: "#F2B45A" }),
        I("p1", "Food photo 1", 4.5, 48.5, 45, 45, { sh: "c", lbl: "FOOD PHOTO", ph: "#5A4636" }),
        I("p2", "Food photo 2", 50.5, 50.5, 45, 45, { sh: "c", lbl: "FOOD PHOTO", ph: "#5A4636" }),
        HD("h3", "Section heading", "Special Offers", 6, 98, 88, 10, { f: "g", it: 1, s: 8.5, c: "#F2B45A" }),
        T("where", "Location", "Join us at [Location]", 6, 109, 88, 6, { s: 4.2, wt: 600 }),
        T("dates", "Dates", "Dates: [Day, Month 00]", 6, 115, 88, 5, { s: 3.4, wt: 500, c: "#ddd" }),
        WEB(130, "#fff", { s: 3 }),
      ],
    },
    {
      id: "grand", name: "Grand Opening", cat: "food",
      qr: [6, 106.5, 10.5], soc: [6, 117.5, 36, 4.5, "#E9C9A0", "left", 3],
      bg(g) {
        g.rect(0, 0, 100, H, g.rad(20, 20, 130, "#4A2E1C", "#1E120A"));
        g.circ(76, 98, 34, "#0F0F0F");
      },
      items: [
        LOGO(4, "#E9C9A0"),
        HD("h1", "Heading line 1", "Grand", 6, 12, 88, 16, { f: "g", it: 1, s: 19, c: "#F2B45A" }),
        HD("h2", "Heading line 2", "Opening", 6, 27, 88, 19, { f: "g", it: 1, s: 19, c: "#F2B45A" }),
        HD("h3", "Section heading", "Special Offers", 6, 52, 50, 10, { f: "g", it: 1, s: 7.5, c: "#F2B45A", a: "left" }),
        T("offer", "Offer", "[Opening-day deal, e.g. 20% off all meals]", 6, 63, 36, 18, { s: 3.4, n: 4, wt: 400, a: "left", va: "top", c: "#EBDCCB", lh: 1.3 }),
        T("where", "Location", "Join us at\n[Location]", 6, 85, 36, 14, { s: 4.8, n: 2, a: "left", c: "#F2B45A" }),
        T("date", "Date & time", "[Opening date & time]", 6, 100, 36, 6, { s: 3.4, wt: 600, a: "left" }),
        I("dish", "Dish photo", 44, 66, 64, 64, { sh: "c", lbl: "DISH PHOTO", ph: "#5A4636" }),
        WEB(132, "#E9C9A0", { x: 6, w: 36, s: 3, a: "left" }),
      ],
    },
  ];
  const CATS = [["all", "All"], ["event", "Events"], ["sale", "Sales"], ["community", "Community"], ["biz", "Jobs & business"], ["food", "Food"]];
  const CAT_NAME = Object.fromEntries(CATS);

  // ---------- Drawing kit (unit space: 100 wide) ----------
  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // e = bleed in units. Any edge of a rect, polygon or path that sits exactly on the page edge
  // is pushed out by e, so backgrounds run past the trim line instead of stopping at it.
  function kit(c, k, e = 0) {
    const g = { c, k };
    const ex = v => !e ? v : Math.abs(v) < 1e-3 ? -e : Math.abs(v - 100) < 1e-3 ? 100 + e : v;
    const ey = v => !e ? v : Math.abs(v) < 1e-3 ? -e : Math.abs(v - H) < 1e-3 ? H + e : v;
    const edgePath = {
      moveTo: (x, y) => c.moveTo(ex(x), ey(y)),
      lineTo: (x, y) => c.lineTo(ex(x), ey(y)),
      quadraticCurveTo: (a, b, x, y) => c.quadraticCurveTo(a, b, ex(x), ey(y)),
      bezierCurveTo: (a, b, d, f, x, y) => c.bezierCurveTo(a, b, d, f, ex(x), ey(y)),
    };
    const stops = (gr, cs) => { cs.forEach((col, i) => gr.addColorStop(i / (cs.length - 1), col)); return gr; };
    g.lin = (x0, y0, x1, y1, ...cs) => stops(c.createLinearGradient(x0, y0, x1, y1), cs);
    g.rad = (x, y, r, ...cs) => stops(c.createRadialGradient(x, y, 0, x, y, r), cs);
    g.rect = (x, y, w, h, col) => { const x0 = ex(x), y0 = ey(y); c.fillStyle = col; c.fillRect(x0, y0, ex(x + w) - x0, ey(y + h) - y0); };
    g.poly = (col, ...p) => { c.beginPath(); for (let i = 0; i < p.length; i += 2) c.lineTo(ex(p[i]), ey(p[i + 1])); c.closePath(); c.fillStyle = col; c.fill(); };
    g.circ = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); };
    g.ellipse = (x, y, rx, ry, col) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fillStyle = col; c.fill(); };
    g.ring = (x, y, r, w, col) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    g.line = (x0, y0, x1, y1, w, col) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = w; c.lineCap = "round"; c.strokeStyle = col; c.stroke(); };
    g.rr = (x, y, w, h, r, col, alpha = 1) => { c.globalAlpha = alpha; rrPath(c, x, y, w, h, r); c.fillStyle = col; c.fill(); c.globalAlpha = 1; };
    g.path = (fill, build, stroke, w) => {
      c.beginPath(); build(edgePath);
      if (fill) { c.closePath(); c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = w; c.lineCap = c.lineJoin = "round"; c.strokeStyle = stroke; c.stroke(); }
    };
    g.curve = (col, x0, y0, c1x, c1y, c2x, c2y, x1, y1) => g.path(col, p => { p.moveTo(x0, y0); p.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1); p.lineTo(100, H); p.lineTo(0, H); });
    g.star = (x, y, r1, r2, n, col) => {
      const p = [];
      for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? r2 : r1; p.push(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.poly(col, ...p);
    };
    g.rot = (x, y, deg, fn) => { c.save(); c.translate(x, y); c.rotate(deg * Math.PI / 180); c.translate(-x, -y); fn(); c.restore(); };
    g.shadow = fn => { c.save(); c.shadowColor = "rgba(0,0,0,.18)"; c.shadowBlur = 2 * k; c.shadowOffsetY = 0.5 * k; fn(); c.restore(); };
    return g;
  }

  // Rotate/skew around the item's centre. Pixel space.
  function xf(c, it, K) {
    if (!it.rot && !it.skew) return;
    const cx = (it.x + it.w / 2) * K, cy = (it.y + it.h / 2) * K;
    c.translate(cx, cy);
    if (it.rot) c.rotate(it.rot * Math.PI / 180);
    if (it.skew) c.transform(1, 0, it.skew, 1, 0, 0);
    c.translate(-cx, -cy);
  }

  // ---------- Text boxes (drawn in pixel space so small text stays crisp) ----------
  const setFont = (c, o, sz, first) => {
    c.font = `${o.it ? "italic " : ""}${first ? 700 : o.wt} ${sz}px ${F[o.f]}`;
    if ("letterSpacing" in c) c.letterSpacing = (o.tr || 0) * sz + "px";
  };
  function layout(c, o, paras, cw, sz, firstCol) {
    const lines = []; let wide = false;
    paras.forEach((p, pi) => {
      const first = !!(o.first && firstCol && pi === 0);
      const lsz = first ? sz * o.first[0] : sz;
      setFont(c, o, lsz, first);
      const words = p.split(/\s+/).filter(Boolean);
      let line = words[0] || "";
      for (let i = 1; i < words.length; i++) {
        const t = line + " " + words[i];
        if (c.measureText(t).width <= cw) line = t; else { lines.push({ t: line, sz: lsz, first }); line = words[i]; }
      }
      lines.push({ t: line, sz: lsz, first });
    });
    for (const ln of lines) { setFont(c, o, ln.sz, ln.first); if (c.measureText(ln.t).width > cw + 0.5) wide = true; }
    return { lines, wide, hgt: lines.reduce((a, l) => a + l.sz * o.lh, 0) };
  }
  function trim(c, o, L, bh, cw) {
    const keep = []; let h = 0, cut = false;
    for (const ln of L.lines) {
      const lh = ln.sz * o.lh;
      if (keep.length >= o.n || (keep.length && h + lh > bh + 0.5)) { cut = true; break; }
      keep.push(ln); h += lh;
    }
    if (cut) keep[keep.length - 1].t += "…";
    for (const ln of keep) {
      setFont(c, o, ln.sz, ln.first);
      while (ln.t.length > 1 && c.measureText(ln.t).width > cw) ln.t = ln.t.slice(0, -2) + "…";
    }
    L.lines = keep; L.hgt = h;
  }
  function paintLine(c, o, s, x, y, w) {
    const ax = o.a === "left" ? x : o.a === "right" ? x + w : x + w / 2;
    if (o.rb) {
      const tw = c.measureText(s).width;
      let cx = o.a === "left" ? x : o.a === "right" ? x + w - tw : x + (w - tw) / 2;
      c.textAlign = "left";
      [...s].forEach((ch, i) => { c.fillStyle = o.rb[i % o.rb.length]; c.fillText(ch, cx, y); cx += c.measureText(ch).width; });
      return;
    }
    c.textAlign = o.a;
    if (o.st) { c.lineJoin = "round"; c.lineWidth = o.st[1]; c.strokeStyle = o.st[0]; c.strokeText(s, ax, y); }
    c.fillText(s, ax, y);
    if (o.gl) { c.shadowBlur = o.gl[1] * 0.4; c.fillText(s, ax, y); }
  }
  // Returns false if the text had to be cut to fit its box.
  function drawText(g, b, val, logo) {
    const c = g.c, K = g.k;
    const o = { ...DEF, ...b };
    ["x", "y", "w", "h", "s", "r", "p"].forEach(key => { if (o[key] != null) o[key] *= K; });
    if (o.st) o.st = [o.st[0], o.st[1] * K];
    if (o.gl) o.gl = [o.gl[0], o.gl[1] * K];
    xf(c, b, K);
    if (o.bg) { rrPath(c, o.x, o.y, o.w, o.h, o.r || 0); c.fillStyle = o.bg; c.fill(); }
    if (logo) {
      const r = b.ib || b, bx = r.x * K, by = r.y * K, bw = r.w * K, bh = r.h * K;
      const iw = logo.c.width, ih = logo.c.height, sc = Math.min(bw / iw, bh / ih);
      const dw = iw * sc, dh = ih * sc;
      const dx = o.a === "left" ? bx : o.a === "right" ? bx + bw - dw : bx + (bw - dw) / 2;
      c.drawImage(logo.c, dx, by + (bh - dh) / 2, dw, dh);
      return true;
    }
    let paras = String(val || "").split("\n").map(s => s.trim()).filter(Boolean);
    if (!paras.length) return true;
    if (o.up) paras = paras.map(p => p.toUpperCase());
    if (o.bul) paras = paras.map(p => "• " + p.replace(/^[•\-*]\s*/, ""));
    const px = o.bg ? (o.p != null ? o.p : Math.min(o.r || 1.5 * K, o.w * 0.1)) : (o.p || 0);
    const bx = o.x + px, bw = o.w - 2 * px, bh = o.h;
    const cols = o.cols || 1, gap = cols > 1 ? 4 * K : 0, cw = (bw - gap * (cols - 1)) / cols;
    const per = Math.ceil(paras.length / cols);
    const groups = Array.from({ length: cols }, (_, i) => paras.slice(i * per, (i + 1) * per));
    let sz = o.s, lay, ok;
    for (;;) {
      lay = groups.map((ps, ci) => layout(c, o, ps, cw, sz, ci === 0));
      ok = lay.every(L => L.lines.length <= o.n && L.hgt <= bh + 0.5 && !L.wide);
      if (ok || sz <= o.s * 0.4) break;
      sz *= 0.94;
    }
    if (!ok) lay.forEach(L => trim(c, o, L, bh, cw));
    c.textBaseline = "middle";
    if (o.sh) { c.shadowColor = o.sh[0]; c.shadowOffsetX = o.sh[1] * K; c.shadowOffsetY = o.sh[2] * K; }
    if (o.gl) { c.shadowColor = o.gl[0]; c.shadowBlur = o.gl[1]; }
    lay.forEach((L, ci) => {
      const x0 = bx + ci * (cw + gap);
      let y = o.va === "top" ? o.y : o.y + (bh - L.hgt) / 2;
      for (const ln of L.lines) {
        const lh = ln.sz * o.lh;
        setFont(c, o, ln.sz, ln.first);
        c.fillStyle = (ln.first && o.first[1]) || o.c;
        if (o.gl) c.shadowBlur = o.gl[1];
        paintLine(c, o, ln.t, x0, y + lh / 2 + ln.sz * 0.04, cw);
        y += lh;
      }
    });
    return ok;
  }

  // ---------- Image slots ----------
  function slotPath(c, s, K) {
    const x = s.x * K, y = s.y * K, w = s.w * K, h = s.h * K;
    if (s.sh === "c") { c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); }
    else rrPath(c, x, y, w, h, (s.r || 0) * K);
  }
  function drawImg(g, s, im, plain) {
    const c = g.c, K = g.k, x = s.x * K, y = s.y * K, w = s.w * K, h = s.h * K;
    xf(c, s, K);
    if (s.fr) {
      const p = s.fr * K;
      c.save(); c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 2 * K; c.shadowOffsetY = 0.6 * K;
      c.fillStyle = "#fff"; c.fillRect(x - p, y - p, w + 2 * p, h + p * 3.5); c.restore();
    }
    c.save(); slotPath(c, s, K); c.clip();
    const ph = s.ph || "#D3D7DC";
    if (im) {
      const iw = im.c.width, ih = im.c.height, sc = Math.max(w / iw, h / ih) * im.z;
      const dw = iw * sc, dh = ih * sc;
      c.drawImage(im.c, x + (w - dw) * im.fx, y + (h - dh) * im.fy, dw, dh);
    } else {
      c.fillStyle = ph; c.fillRect(x, y, w, h);
      if (!plain) {
        const ink = lumOf(ph) > 0.5 ? "rgba(0,0,0,.32)" : "rgba(255,255,255,.4)";
        const m = Math.min(w, h) * 0.13, cx = x + w / 2, cy = y + h / 2 - m * 0.6;
        c.fillStyle = ink;
        rrPath(c, cx - m, cy - m * 0.65, 2 * m, 1.35 * m, m * 0.2); c.fill();
        c.fillRect(cx - m * 0.35, cy - m * 0.9, m * 0.7, m * 0.3);
        c.beginPath(); c.arc(cx, cy + m * 0.02, m * 0.42, 0, 7); c.fillStyle = ph; c.fill();
        c.beginPath(); c.arc(cx, cy + m * 0.02, m * 0.24, 0, 7); c.fillStyle = ink; c.fill();
        let sz = Math.min(h * 0.075, w * 0.075, 4 * K);
        c.font = `700 ${sz}px ${F.s}`;
        while (c.measureText(s.lbl).width > w * 0.8 && sz > 4) { sz *= 0.92; c.font = `700 ${sz}px ${F.s}`; }
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(s.lbl, cx, cy + m * 1.35);
      }
    }
    c.restore();
    if (s.bd) { slotPath(c, s, K); c.lineWidth = s.bd[1] * K; c.strokeStyle = s.bd[0]; c.stroke(); }
  }
  const lumOf = hex => { let h = hex.slice(1); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };

  // ---------- Filler tracking ----------
  // filler: unchanged template text · ph: edited but still has a [placeholder] · empty: removed · ok
  function status(it, st) {
    if (it.type === "qr") return it.m ? "ok" : "filler";
    if (it.type === "soc") return it.list.length ? "ok" : "filler";
    if (it.type === "i") return st.imgs[it.k] || st.plain[it.k] ? "ok" : "filler";
    if (it.logo && st.imgs.logo) return "ok";
    const v = st.vals[it.k];
    if (!v.trim()) return "empty";
    if (it.hdg) return "ok";
    if (v === it.fill) return "filler";
    return PH_RX.test(v) ? "ph" : "ok";
  }
  const isFlag = (it, st) => /filler|ph/.test(status(it, st));
  const flagged = st => allItems(cur, st).filter(it => isFlag(it, st));

  // ---------- Optional extras: QR code and social media (app-wide, memory only) ----------
  const X = { qr: false, qrLink: "", soc: false, socVals: {} };
  const urlOf = w => /^[a-z][a-z0-9+.-]*:/i.test(w) ? w : "https://" + w.replace(/\s+/g, "");
  const hasWeb = tpl => tpl.items.some(i => i.k === "web");
  function qrUrl(tpl, st) {
    const own = X.qrLink.trim();
    if (own) return urlOf(own);
    const web = tpl.items.find(i => i.k === "web");
    return web && status(web, st) === "ok" ? urlOf(st.vals.web.trim()) : "";
  }
  // The QR library is only downloaded once someone ticks "Add a QR code".
  let qrLib = null;
  const loadQr = () => qrLib || (qrLib = new Promise((res, rej) => {
    if (window.qrcode) return res();
    const s = document.createElement("script"); s.src = "../qr/qrcode.min.js";
    s.onload = () => { if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"]; res(); };
    s.onerror = () => { qrLib = null; rej(); };
    document.head.append(s);
  }));
  const qrCache = new Map();
  function qrMatrix(text) {
    if (!text || !window.qrcode) return null;
    if (!qrCache.has(text)) {
      let m = null;
      try { const q = qrcode(0, "M"); q.addData(text); q.make(); m = { n: q.getModuleCount(), dark: (r, c) => q.isDark(r, c) }; } catch { /* too long */ }
      qrCache.set(text, m);
    }
    return qrCache.get(text);
  }
  function extras(tpl, st) {
    const out = [];
    if (X.qr && tpl.qr) {
      const [x, y, s] = tpl.qr, url = qrUrl(tpl, st);
      out.push({ k: "_qr", type: "qr", label: "QR code", x, y, w: s, h: s, url, m: qrMatrix(url) });
    }
    if (X.soc && tpl.soc) {
      const [x, y, w, lh, c, a, n = 1] = tpl.soc; // lh: height of one line; n: lines it may wrap onto
      out.push({ k: "_soc", type: "soc", label: "Social media", x, y, w, h: lh * n, lh, n, c, a: a || "center", list: Social.items(X.socVals) });
    }
    return out;
  }
  const allItems = (tpl, st) => tpl.items.concat(extras(tpl, st));
  const rectOf = (it, st) => it.logo && it.ib && st.imgs.logo ? it.ib : it;
  const SOC_SAMPLE = [{ id: "ig", text: "@yourhandle" }, { id: "fb", text: "@yourhandle" }, { id: "x", text: "@yourhandle" }];

  // QR on a white plate with a quiet margin, so it scans on any background. Pixel space.
  function drawQr(c, it, K) {
    const x = it.x * K, y = it.y * K, s = it.w * K;
    c.fillStyle = "#fff"; rrPath(c, x, y, s, s, 0.6 * K); c.fill();
    if (!it.m) {
      c.fillStyle = "#C9CDD2";
      [[0.12, 0.12], [0.58, 0.12], [0.12, 0.58]].forEach(([a, b]) => c.fillRect(x + a * s, y + b * s, s * 0.3, s * 0.3));
      c.fillStyle = "#6B7280"; c.font = `700 ${s * 0.16}px ${F.s}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("QR", x + s * 0.73, y + s * 0.73);
      return;
    }
    const q = 2, n = it.m.n, m = s / (n + 2 * q);
    c.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (!it.m.dark(r, col)) continue;
      const x0 = Math.round(x + (col + q) * m), y0 = Math.round(y + (r + q) * m);
      c.fillRect(x0, y0, Math.round(x + (col + q + 1) * m) - x0, Math.round(y + (r + q + 1) * m) - y0);
    }
  }

  // ---------- Render ----------
  // opt.bleed / opt.slug: extra units around the page (bleed = background past the trim line,
  // slug = white margin that holds the crop marks). Item coordinates stay relative to the trim corner.
  function draw(canvas, tpl, st, opt = {}) {
    const b = opt.bleed || 0, sl = opt.slug || 0, m = b + sl;
    const c = canvas.getContext("2d"), k = canvas.width / (100 + 2 * m), o = m * k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (m) { c.fillStyle = "#fff"; c.fillRect(0, 0, canvas.width, canvas.height); }
    c.setTransform(k, 0, 0, k, o, o);
    c.save();
    if (sl) { c.beginPath(); c.rect(-b, -b, 100 + 2 * b, H + 2 * b); c.clip(); }
    const g = kit(c, k, b);
    c.save(); tpl.bg(g); c.restore();
    const cut = new Set(), links = [], items = allItems(tpl, st);
    for (const it of items) {
      c.save(); c.setTransform(1, 0, 0, 1, o, o);
      if (it.type === "i") drawImg(g, it, st.imgs[it.k], st.plain[it.k]);
      else if (it.type === "qr") { drawQr(c, it, k); if (it.m) links.push({ x: it.x, y: it.y, w: it.w, h: it.h, url: it.url }); }
      else if (it.type === "soc") {
        const ax = it.a === "left" ? it.x : it.a === "right" ? it.x + it.w : it.x + it.w / 2;
        const r = Social.row(c, it.list.length ? it.list : SOC_SAMPLE, ax * k, it.y * k, it.w * k, it.lh * k / 1.4,
          { align: it.a, color: it.c, font: F.s, weight: 600, lines: it.n });
        if (r.small) cut.add(it.k);
        if (it.list.length) r.links.forEach(l => links.push({ x: l.x / k, y: l.y / k, w: l.w / k, h: l.h / k, url: l.url }));
      }
      else if (!drawText(g, it, st.vals[it.k], it.logo && st.imgs.logo)) cut.add(it.k);
      else if (it.k === "web" && status(it, st) === "ok") links.push({ x: it.x, y: it.y, w: it.w, h: it.h, url: urlOf(st.vals.web.trim()) });
      c.restore();
    }
    c.restore(); // end bleed clip
    if (opt.marks && sl) {
      // Crop marks in the white margin, in line with the trim edges, starting just outside the bleed.
      c.setTransform(k, 0, 0, k, o, o);
      c.strokeStyle = "#000"; c.lineWidth = 0.12; c.setLineDash([]);
      const g0 = b + 0.5, g1 = m - 0.4;
      c.beginPath();
      [[0, 0], [100, 0], [0, H], [100, H]].forEach(([x, y]) => {
        const sx = x ? 1 : -1, sy = y ? 1 : -1;
        c.moveTo(x + sx * g0, y); c.lineTo(x + sx * g1, y);
        c.moveTo(x, y + sy * g0); c.lineTo(x, y + sy * g1);
      });
      c.stroke();
    }
    if (opt.trim && b) { // dashed trim line on the preview only
      c.setTransform(1, 0, 0, 1, o, o);
      c.setLineDash([1.2 * k, 0.8 * k]); c.lineWidth = Math.max(1, 0.25 * k); c.strokeStyle = "#FF3D7F";
      c.strokeRect(0, 0, 100 * k, H * k); c.setLineDash([]);
    }
    if (opt.guides || opt.active) {
      c.setTransform(1, 0, 0, 1, o, o);
      for (const it of items) {
        const on = it.k === opt.active, flag = opt.guides && isFlag(it, st);
        if (!on && !flag) continue;
        c.save(); xf(c, it, k);
        const R = rectOf(it, st), p = 0.7 * k, args = [R.x * k - p, R.y * k - p, R.w * k + 2 * p, R.h * k + 2 * p];
        c.setLineDash(on ? [] : [1.4 * k, 0.9 * k]);
        c.lineWidth = (on ? 1.1 : 0.8) * k; c.strokeStyle = "rgba(0,0,0,.55)"; c.strokeRect(...args);
        c.lineWidth = (on ? 0.6 : 0.4) * k; c.strokeStyle = on ? "#D4FF3F" : "#FFB000"; c.strokeRect(...args);
        c.restore();
      }
    }
    return { cut, links };
  }

  // ---------- State (memory only) ----------
  const store = {};
  const stateFor = tpl => store[tpl.id] || (store[tpl.id] = {
    vals: Object.fromEntries(tpl.items.filter(i => i.type === "t").map(i => [i.k, i.fill])),
    imgs: {}, plain: {},
  });
  let cur = null, st = null, active = null, lastCut = new Set(), filter = "all";

  // ---------- Step 1: gallery ----------
  const thumbs = {};
  function buildGallery() {
    $("filters").innerHTML = "";
    CATS.forEach(([id, label]) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", id === filter);
      b.onclick = () => { filter = id; buildGallery(); };
      $("filters").append(b);
    });
    const list = TEMPLATES.filter(t => filter === "all" || t.cat === filter);
    $("count").textContent = list.length + (list.length === 1 ? " template" : " templates");
    const wrap = $("tpls"); wrap.innerHTML = "";
    list.forEach(t => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tpl"; b.setAttribute("aria-current", cur === t);
      b.setAttribute("aria-label", "Use the " + t.name + " template");
      const cv = thumbs[t.id] || (thumbs[t.id] = document.createElement("canvas"));
      const w = Math.round(220 * Math.min(2, devicePixelRatio || 1));
      cv.width = w; cv.height = Math.round(w * H / 100);
      draw(cv, t, stateFor(t));
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = t.name;
      const tg = document.createElement("span"); tg.className = "tg";
      const left = flaggedFor(t).length;
      tg.textContent = CAT_NAME[t.cat] + (store[t.id] && left < t.items.filter(i => !i.hdg).length ? ` · ${left} filler left` : "");
      b.append(cv, nm, tg);
      b.onclick = () => openTemplate(t);
      wrap.append(b);
    });
  }
  const flaggedFor = t => allItems(t, stateFor(t)).filter(it => isFlag(it, stateFor(t)));

  // ---------- Step 2: text boxes ----------
  function openTemplate(t) {
    cur = t; st = stateFor(t); active = null;
    $("tplName").textContent = t.name;
    buildFields();
    $("step1").hidden = true; $("step2").hidden = false;
    $("s1tag").classList.remove("on"); $("s2tag").classList.add("on");
    setStatus("");
    window.scrollTo(0, 0);
    render();
  }
  function backToGallery() {
    $("step2").hidden = true; $("step1").hidden = false;
    $("s2tag").classList.remove("on"); $("s1tag").classList.add("on");
    buildGallery();
  }

  function buildFields() {
    const box = $("fields"); box.innerHTML = "";
    cur.items.forEach(it => {
      const f = document.createElement("div");
      f.className = "fld"; f.dataset.k = it.k;
      const head = document.createElement("div"); head.className = "fhead";
      const badge = document.createElement("span"); badge.className = "badge";
      const id = "f_" + it.k;
      if (it.type === "t") {
        const lab = document.createElement("label"); lab.htmlFor = id; lab.textContent = it.label;
        head.append(lab, badge); f.append(head);
        const multi = it.n > 1 || it.fill.includes("\n");
        const inp = document.createElement(multi ? "textarea" : "input");
        if (!multi) inp.type = "text";
        else inp.rows = Math.min(6, Math.max(2, it.fill.split("\n").length));
        inp.id = id; inp.value = st.vals[it.k];
        inp.autocomplete = "off"; inp.maxLength = multi ? 400 : 80;
        inp.setAttribute("autocapitalize", "sentences");
        inp.addEventListener("input", () => { st.vals[it.k] = inp.value; render(); });
        inp.addEventListener("focus", () => { if (inp.value === it.fill && !it.hdg) inp.select(); setActive(it.k); });
        inp.addEventListener("blur", () => setActive(null));
        f.append(inp);
        if (it.logo) f.append(fileRow(it, "logo", 1200));
      } else {
        const lab = document.createElement("span"); lab.className = "lbl"; lab.textContent = it.label;
        head.append(lab, badge); f.append(head, fileRow(it, it.k, 2400));
        const plain = document.createElement("label"); plain.className = "check";
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!st.plain[it.k];
        cb.onchange = () => { st.plain[it.k] = cb.checked; render(); };
        plain.append(cb, document.createTextNode(" No image: show a plain block"));
        f.append(plain);
      }
      f.addEventListener("focusin", () => setActive(it.k));
      box.append(f);
    });
    buildExtras(box);
  }

  // Optional QR code and social media row. Off by default; their settings carry across templates.
  function buildExtras(box) {
    const h = document.createElement("p"); h.className = "extras-h"; h.textContent = "Optional extras";
    box.append(h);
    const block = (k, label, onLabel, on, setOn) => {
      const f = document.createElement("div"); f.className = "fld"; f.dataset.k = k;
      const head = document.createElement("div"); head.className = "fhead";
      const lab = document.createElement("span"); lab.className = "lbl"; lab.textContent = label;
      const badge = document.createElement("span"); badge.className = "badge";
      head.append(lab, badge);
      const chk = document.createElement("label"); chk.className = "check";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "x" + k; cb.checked = on;
      chk.append(cb, document.createTextNode(" " + onLabel));
      const body = document.createElement("div"); body.hidden = !on;
      cb.onchange = () => { body.hidden = !cb.checked; setOn(cb.checked); render(); };
      f.append(head, chk, body);
      f.addEventListener("focusin", () => setActive(k));
      box.append(f);
      return body;
    };
    const qb = block("_qr", "QR code", "Add a QR code", X.qr, v => { X.qr = v; if (v) loadQr().then(render, () => setStatus("The QR code tool could not load.", "warn")); });
    const ql = document.createElement("label"); ql.htmlFor = "f__qr"; ql.className = "sublbl"; ql.textContent = "Link for the QR code";
    const qi = document.createElement("input"); qi.type = "text"; qi.id = "f__qr"; qi.autocomplete = "off"; qi.maxLength = 300;
    qi.inputMode = "url"; qi.spellcheck = false; qi.setAttribute("autocapitalize", "off"); qi.value = X.qrLink;
    qi.placeholder = hasWeb(cur) ? "Leave empty to use the Website box" : "e.g. www.yoursite.com";
    qi.addEventListener("input", () => { X.qrLink = qi.value; render(); });
    const qh = document.createElement("p"); qh.className = "hint";
    qh.textContent = (hasWeb(cur) ? "Uses your Website box unless you type a different link. " : "") + "Black on white so it scans on any background. Scan it with your phone before printing.";
    qb.append(ql, qi, qh);
    if (X.qr) loadQr().then(render, () => {});

    const sb = block("_soc", "Social media", "Add social media icons", X.soc, v => { X.soc = v; });
    const grid = document.createElement("div"); grid.className = "row2";
    Social.form(grid, render, X.socVals);
    const sh = document.createElement("p"); sh.className = "hint";
    sh.textContent = "Fill in only the ones you use. If the handles are the same, the icons share one handle. In the PDF, each icon opens the profile.";
    sb.append(grid, sh);
  }

  function fileRow(it, key, maxPx) {
    const wrap = document.createElement("div");
    const row = document.createElement("div"); row.className = "img-row";
    const inp = document.createElement("input"); inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/webp,image/gif" + (key === "logo" ? ",image/svg+xml" : "");
    inp.id = it.type === "i" ? "f_" + it.k : "f_logoimg";
    inp.setAttribute("aria-label", key === "logo" ? "Upload a logo instead of text" : "Upload " + it.label);
    const th = document.createElement("canvas"); th.width = th.height = 88; th.hidden = true;
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "btn"; rm.textContent = "Remove"; rm.hidden = true;
    const sl = document.createElement("div"); sl.className = "sliders"; sl.hidden = true;
    const sliders = [["z", "Zoom", 1, 3, 1], ["fx", "Left ↔ right", 0, 1, 0.5], ["fy", "Up ↕ down", 0, 1, 0.5]].map(([p, label, min, max, v]) => {
      const d = document.createElement("div");
      const l = document.createElement("label"); l.textContent = label;
      const r = document.createElement("input"); r.type = "range"; r.min = min; r.max = max; r.step = 0.01; r.value = v;
      r.oninput = () => { if (st.imgs[key]) { st.imgs[key][p] = +r.value; render(); } };
      l.append(r); d.append(l); sl.append(d);
      return [p, r];
    });
    const show = () => {
      const im = st.imgs[key];
      th.hidden = rm.hidden = !im; sl.hidden = !im || key === "logo";
      if (im) {
        const t = th.getContext("2d"); t.clearRect(0, 0, 88, 88);
        const sc = Math.max(88 / im.c.width, 88 / im.c.height);
        t.drawImage(im.c, (88 - im.c.width * sc) / 2, (88 - im.c.height * sc) / 2, im.c.width * sc, im.c.height * sc);
        sliders.forEach(([p, r]) => { r.value = im[p]; });
      }
    };
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        st.imgs[key] = { c: await loadImage(file, maxPx), z: 1, fx: 0.5, fy: 0.5 };
        show(); render();
      } catch { setStatus("That image could not be opened. Try a PNG or JPG.", "warn"); }
      inp.value = "";
    };
    rm.onclick = () => { delete st.imgs[key]; show(); render(); };
    row.append(inp, th, rm); wrap.append(row, sl);
    if (key === "logo") { const h = document.createElement("p"); h.className = "hint"; h.textContent = "Or upload a logo; it replaces the text."; wrap.append(h); }
    show();
    return wrap;
  }

  // Shrink big photos once on upload so memory and export work stay small. The file itself is never kept.
  async function loadImage(file, maxPx) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const iw = img.naturalWidth || 600, ih = img.naturalHeight || 600;
      const sc = Math.min(1, maxPx / Math.max(iw, ih));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(iw * sc)); c.height = Math.max(1, Math.round(ih * sc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  function setActive(k) { if (active !== k) { active = k; render(); } }

  // ---------- Preview ----------
  let raf = 0;
  function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderNow(); }); }
  function renderNow() {
    if (!cur) return;
    const cv = $("preview");
    const css = cv.clientWidth || 520;
    const w = Math.min(1400, Math.round(css * Math.min(2, devicePixelRatio || 1)));
    const P = pageBox(), h = Math.round(w * P.th / P.tw);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    lastCut = draw(cv, cur, st, { guides: $("guides").checked, active, ...P.opt, trim: true }).cut;
    $("bleedVal").textContent = BL.mm ? BL.mm + " mm" : "none";
    updateBadges();
  }

  const BADGE = { filler: "Filler", ph: "Placeholder left", empty: "Hidden", ok: "✓ Done", cut: "Too long", hdg: "Heading", off: "Off" };
  function updateBadges() {
    let left = 0;
    ["_qr", "_soc"].forEach(k => {
      const f = document.querySelector(`.fld[data-k="${k}"]`);
      if (f) { f.dataset.st = "off"; f.querySelector(".badge").textContent = BADGE.off; }
    });
    allItems(cur, st).forEach(it => {
      const f = document.querySelector(`.fld[data-k="${it.k}"]`); if (!f) return;
      let s = status(it, st);
      if (/filler|ph/.test(s)) left++;
      if (lastCut.has(it.k)) s = "cut";
      const shown = s === "ok" && it.hdg && st.vals[it.k] === it.fill ? "hdg" : s;
      f.dataset.st = shown;
      f.querySelector(".badge").textContent = BADGE[shown];
    });
    const bar = $("fillbar");
    bar.className = "fillbar " + (left ? "warn" : "ok");
    $("fillMsg").textContent = left
      ? `⚠ ${left} section${left === 1 ? "" : "s"} still ${left === 1 ? "has" : "have"} filler`
      : "✓ No filler left";
    $("nextFill").hidden = !left;
    if (lastCut.size) setStatus("Some text was too long and has been cut (marked “Too long”). Shorten it.", "warn");
    else if ($("status").dataset.cut) setStatus("");
    $("status").dataset.cut = lastCut.size ? "1" : "";
  }

  function focusItem(k) {
    const f = document.querySelector(`.fld[data-k="${k}"]`); if (!f) return;
    const el = f.querySelector("input[type=text], textarea, input[type=file]");
    f.scrollIntoView({ block: "center", behavior: "smooth" });
    if (el) el.focus({ preventScroll: true });
    f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
  }

  // Tap the preview to jump to the box under your finger. Nothing on the flyer can be dragged.
  $("preview").addEventListener("click", e => {
    const r = e.currentTarget.getBoundingClientRect();
    const P = pageBox();
    const ux = (e.clientX - r.left) / r.width * P.tw - P.m, uy = (e.clientY - r.top) / r.height * P.th - P.m;
    const hit = allItems(cur, st).reverse().find(it => { const R = rectOf(it, st); return ux >= R.x && ux <= R.x + R.w && uy >= R.y && uy <= R.y + R.h; });
    if (hit) focusItem(hit.k);
  });
  ["dragstart", "contextmenu"].forEach(ev => $("preview").addEventListener(ev, e => e.preventDefault()));

  $("nextFill").onclick = () => {
    const list = flagged(st); if (!list.length) return;
    const i = list.findIndex(it => it.k === active);
    focusItem(list[(i + 1) % list.length].k);
  };

  // ---------- Download ----------
  function setStatus(msg, kind) { const s = $("status"); s.textContent = msg; s.className = "status" + (kind ? " " + kind : ""); }
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";

  function askAboutFiller(list) {
    return new Promise(resolve => {
      const d = $("dlg"), ul = $("dlgList");
      $("dlgText").textContent = `${list.length} section${list.length === 1 ? "" : "s"} will print with template filler:`;
      ul.innerHTML = "";
      list.forEach(it => {
        const li = document.createElement("li");
        const t = document.createElement("span");
        const why = document.createElement("small");
        why.textContent = status(it, st) === "ph" ? "Placeholder left" : it.type === "i" ? "No image yet"
          : it.type === "qr" ? (it.url ? "Link too long for a QR code" : "No website for it yet")
          : it.type === "soc" ? "No handles yet" : "Not edited";
        t.append(document.createTextNode(it.label), why);
        const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "Edit";
        b.onclick = () => { done(false); focusItem(it.k); };
        li.append(t, b); ul.append(li);
      });
      const done = v => { d.onclose = null; if (d.open) d.close(); resolve(v); };
      $("dlgFix").onclick = () => { done(false); focusItem(list[0].k); };
      $("dlgGo").onclick = () => done(true);
      d.onclose = () => done(false);
      d.showModal();
      $("dlgFix").focus();
    });
  }

  // ---------- Bleed and crop marks ----------
  // 1 unit = 2.1 mm (A4 is 210 mm wide). Crop marks need a white margin (slug) outside the bleed.
  const MM = 2.1, SLUG_MM = 8;
  const BL = { mm: 0, marks: false };
  function pageBox() {
    const b = BL.mm / MM, s = BL.marks ? SLUG_MM / MM : 0, m = b + s;
    return { b, s, m, tw: 100 + 2 * m, th: H + 2 * m, opt: { bleed: b, slug: s, marks: BL.marks } };
  }

  function exportCanvas() {
    const P = pageBox(), dpi = +$("res").value, w = Math.round(P.tw * MM / 25.4 * dpi);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = Math.round(w * P.th / P.tw);
    const { links } = draw(cv, cur, st, P.opt);
    return { cv, dpi, links, P };
  }
  const toBlob = (cv, type, q) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("export")), type, q));

  async function download(kind) {
    const list = flagged(st);
    if (list.length && !(await askAboutFiller(list))) return;
    setStatus("Preparing…");
    try {
      const { cv, dpi, links, P } = exportCanvas();
      let blob, ext;
      if (kind === "png") { blob = await withPngDpi(await toBlob(cv, "image/png"), dpi); ext = "png"; }
      else {
        const jpg = await withJpgDpi(await toBlob(cv, "image/jpeg", kind === "pdf" ? 0.9 : 0.85), dpi);
        if (kind === "pdf") { blob = makePdf(new Uint8Array(await jpg.arrayBuffer()), cv.width, cv.height, links, P); ext = "pdf"; }
        else { blob = jpg; ext = "jpg"; }
      }
      const name = `flyer-${cur.id}.${ext}`;
      save(blob, name);
      const mm = v => Math.round(v * MM * 10) / 10;
      setStatus(`Saved ${name} · ${mm(P.tw)} × ${mm(P.th)} mm${BL.mm ? ` incl. ${BL.mm} mm bleed` : ""} · ${cv.width} × ${cv.height} px · ${kb(blob.size)}`, "ok");
    } catch { setStatus("Export failed. Try a smaller size.", "warn"); }
  }
  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // DPI tags so print dialogs pick the right physical size.
  let crcT;
  function crc32(bytes) {
    if (!crcT) { crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (const b of bytes) c = crcT[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  async function withPngDpi(blob, dpi) {
    const src = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([112, 72, 89, 115], 4); // "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    return new Blob([src.subarray(0, 33), chunk, src.subarray(33)], { type: "image/png" });
  }
  async function withJpgDpi(blob, dpi) {
    const b = new Uint8Array(await blob.arrayBuffer());
    if (b[2] === 0xFF && b[3] === 0xE0 && String.fromCharCode(b[6], b[7], b[8], b[9]) === "JFIF") {
      b[13] = 1; b[14] = dpi >> 8; b[15] = dpi & 255; b[16] = dpi >> 8; b[17] = dpi & 255;
    }
    return new Blob([b], { type: "image/jpeg" });
  }

  // A one-page A4 PDF holding the flyer as a JPEG, plus clickable areas for the website, QR code
  // and social icons. Written by hand so no PDF library has to load.
  // With bleed, the page is larger than A4 and carries a TrimBox (the A4 cut size) and a
  // BleedBox, which print software reads to place the cut.
  function makePdf(jpg, w, h, links = [], P = { tw: 100, th: H, m: 0, s: 0 }) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const push = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, ...body) => { offs[n] = len; push(n + " 0 obj\n"); body.forEach(push); push("\nendobj\n"); };
    const U = 595.28 / 100, pt = v => +v.toFixed(2);
    const PW = pt(P.tw * U), PH = pt(P.th * U);
    const box = (name, inset) => inset ? ` /${name} [${pt(inset * U)} ${pt(inset * U)} ${pt(PW - inset * U)} ${pt(PH - inset * U)}]` : "";
    const boxes = P.m ? box("BleedBox", P.s) + box("TrimBox", P.m) : "";
    push("%PDF-1.4\n%âãÏÓ\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    const annots = links.map((_, i) => `${6 + i} 0 R`).join(" ");
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}]${boxes} /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R${annots ? ` /Annots [${annots}]` : ""} >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, "\nendstream");
    const cs = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    const esc = u => { try { u = encodeURI(decodeURI(u)); } catch { u = encodeURI(u); } return u.replace(/[()\\]/g, "\\$&"); };
    links.forEach((l, i) => {
      const X = v => pt((v + P.m) * U), Y = v => pt(PH - (v + P.m) * U);
      const x0 = X(l.x), x1 = X(l.x + l.w), y1 = Y(l.y), y0 = Y(l.y + l.h);
      obj(6 + i, `<< /Type /Annot /Subtype /Link /Rect [${x0} ${y0} ${x1} ${y1}] /Border [0 0 0] /A << /S /URI /URI (${esc(l.url)}) >> >>`);
    });
    const n = 6 + links.length, xref = len;
    let x = `xref\n0 ${n}\n0000000000 65535 f \n`;
    for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    push(x + `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: "application/pdf" });
  }

  // ---------- Wire up ----------
  $("changeTpl").onclick = backToGallery;
  $("resetTpl").onclick = () => {
    if (!confirm("Clear your text and images on this template and go back to the filler?")) return;
    delete store[cur.id]; openTemplate(cur);
  };
  $("guides").onchange = render;
  const setBleed = v => {
    BL.mm = v; $("bleed").value = v;
    document.querySelectorAll("#bleedPresets button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.mm === v));
    render();
  };
  $("bleed").addEventListener("input", () => setBleed(+$("bleed").value));
  document.querySelectorAll("#bleedPresets button").forEach(b => { b.onclick = () => setBleed(+b.dataset.mm); });
  $("marks").onchange = () => { BL.marks = $("marks").checked; render(); };
  $("jpgBtn").onclick = () => download("jpg");
  $("pngBtn").onclick = () => download("png");
  $("pdfBtn").onclick = () => download("pdf");
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 120); });

  // Canvas text needs the bundled fonts loaded first.
  const want = ["400 20px Anton", '700 20px "Space Grotesk"', '500 20px "Space Grotesk"', '400 20px "Space Grotesk"'];
  Promise.all(want.map(f => document.fonts.load(f).catch(() => null))).then(buildGallery);
})();
