# Flyer Maker

Pick a flyer template, fill in its text boxes, and download a PNG, JPG or PDF.
Double-click `index.html`. It needs no server, no build step and no internet connection.

## How it works

1. **Template.** 18 designs, filtered by Events, Sales, Community, Jobs & business, Food.
2. **Edit.** Every section of the flyer is a text box (or image slot) with a **fixed
   position**. You can change what a box says, but not move, resize or copy it.
   Tap a section on the preview to jump to its box. Leave a box empty to remove it.
   Long text shrinks to fit, then is cut with "…" and the box is marked **Too long**.
3. **Download.** JPG (smallest), PNG, or a one-page A4 PDF, at 100, 150 or 300 DPI.
   The file size is shown after each download.

## Bleed and crop marks

- **Bleed** (None, 3 mm, 5 mm, or anywhere from 0 to 10 mm on the slider) runs the background
  past the A4 edge so no white slivers show after trimming. Backgrounds are extended, not
  stretched: any shape that touches the page edge is pushed out by the bleed amount.
  Text and photos stay where they are.
- The preview shows the cut with a dashed pink trim line (never in downloads).
- **Crop marks** add an 8 mm white margin with thin marks in line with the trim edges.
- The PDF page grows by the bleed (and margin) and carries a `TrimBox` (exactly A4) and a
  `BleedBox`, which print software uses to place the cut. Links stay in the right place.
- The status line after a download shows the full size, e.g. "216 × 303 mm incl. 3 mm bleed".

## Optional extras

Both are off by default and sit at fixed spots chosen for each template. Their settings
carry across templates while the tab is open.

- **QR code** from the Website box (or a link typed under QR code, for templates with no
  Website box). Black on a white plate so it scans on any background. The QR library
  (`../qr/qrcode.min.js`) is only downloaded when the box is ticked.
- **Social media icons**: Instagram, Facebook, X, LinkedIn, TikTok, YouTube, WhatsApp.
  Fill in only the ones you use. The same handle everywhere is written once after the icons;
  different handles get one icon + handle each, wrapping onto extra lines where the template
  has room.
- In the **PDF**, the website, QR code and each social icon are clickable links.

Ticked but empty, both count as filler and are flagged before download.

## Logo

Type a brand name, or upload a logo image. An uploaded logo fills a larger fixed area at the
top (up to 56 × 11 units, about 23 mm tall on A4) than the text version.

## Filler tracking

Each template starts with filler text in square brackets, e.g. `[Speaker Name]`.

| Badge | Meaning |
| --- | --- |
| Filler | Box hasn't been edited, or an image slot is still empty |
| Placeholder left | Edited, but still contains `[…]`, "your website", "@yourhandle", "000 000 0000" or "lorem ipsum" |
| Heading | Design text such as "WE ARE HIRING!". Editable, never flagged |
| Too long | Text was cut to fit |
| Hidden | Left empty, so it's removed from the flyer |

Flagged boxes get a dashed amber outline on the preview (never in downloads), a counter
with a **Next filler →** button shows how many are left, and every download first lists
the flagged boxes with **Go back and edit** or **Download anyway**.
An image slot can be ticked "No image" to show a plain block instead.

## Privacy and data use

- Nothing is uploaded or saved: no network code, no `localStorage`, no cookies, nothing
  in the address bar. A Content-Security-Policy (`connect-src 'none'`) blocks outgoing
  requests. Edits are kept in memory per template until the tab is closed or reloaded.
- No "Share via" menu, unlike the other apps. People download the file themselves.
- No libraries: the PDF is written by hand (one JPEG on an A4 page), so the app is about
  70 KB plus the site's shared fonts. Uploaded photos are shrunk on load (2400 px max,
  logos 1200 px) and the original file isn't kept.

## Adding a template

Add an entry to `TEMPLATES` in `app.js`. Coordinates are in units: the flyer is 100 wide
and 141.42 tall (A-series ratio). `bg(g)` paints the background with the drawing kit;
`items` lists boxes in reading order:

- `T(key, label, filler, x, y, w, h, style)` — a tracked text box
- `HD(...)` — same, but a heading (not tracked)
- `I(key, label, x, y, w, h, style)` — an image slot (`sh: "c"` for a circle)
- `LOGO(y)` / `WEB(y)` — the standard logo and website boxes (`ib` sets the logo image area)
- `qr: [x, y, size]` and `soc: [x, y, w, lineHeight, colour, align, lines]` on the template
  place the optional QR code and social row

Text style keys: `f` font (`d` Anton, `s` Space Grotesk, `g` Georgia), `s` max size,
`n` max lines, `a` align, `c` colour, `up` uppercase, `bul` bullets, `cols` columns,
`first` [scale, colour] for a bold first line, `bg`/`r` pill background, `st` stroke,
`gl` glow, `sh` shadow, `rb` per-letter colours, `rot`/`skew` transforms.
