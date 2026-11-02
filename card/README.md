# Business Card Maker

Pick a template, add a logo or photo and your details, then download a
high-resolution business card. Double-click `index.html` — no server, no build
step, no internet connection needed.

## How it works

1. **Template.** Filter with the buttons (With photo, With logo, Text only) and tap a
   template. Thumbnails show your own details once you've typed
   them, so you can go back and compare.
   Every template has a **Light / Dark** switch under Style; the back follows it.
2. **Details.** Upload a logo or photo (only the slot the template uses is shown),
   fill in name, title, company, phone, email, website and address. Empty fields
   are left off. Photos can be zoomed and moved. No photo or logo? Your initials
   are used instead.
3. **Back side** (on by default, can be switched off). Four designs that take the
   front template's colours: **Centred**, **QR focus**, **Full image** and **Split**.
   The back uses your logo (or company name), a **tagline**, your **website**,
   a **QR code** that opens the website, and an optional **background image**
   (Full image and Split designs, tinted so text stays readable).
4. **Download.**
   - **Front PNG** / **Back PNG** at 600 DPI (85 × 55 mm = 2008 × 1299 px), tagged as 600 DPI.
   - **PDF** at the exact card size: page 1 front, page 2 back.
   - **A4 sheet**: 10 cards with cut marks. With a back side, page 2 holds the backs
     with columns mirrored, so they line up when printed double-sided (flip on long edge).
   - Tick **3 mm bleed** if your print shop asks for it (PNG and PDF).

The QR code has your logo in the middle (or an initials badge if there is no logo).
It uses the highest error correction (H, 30%), and the logo covers under 10% of the
code, so it still scans; tested on all four back designs with short and long URLs.
It is always dark-on-white with a quiet margin.
A website without `http(s)://` gets `https://` added in the code. Scan the
preview with your phone before printing.

Sizes: 85 × 55 mm, 90 × 55 mm, 90 × 50 mm, 3.5 × 2 in. Each template has an
accent colour you can change.

## Templates

| Name | Image | Look |
| --- | --- | --- |
| Navy Band | Logo | Navy header, gold rule, white body |
| Counsel | Photo | Navy, framed photo, gold address strip |
| Graphite | Logo | Charcoal with line pattern, contact icons |
| Blueprint | Logo | White, line-art building if no logo |
| Agent | Photo | White, full-height photo on the right |
| Monogram | Logo | Off-white, gradient initials if no logo |
| Calm | Photo | Soft two-tone panel, rounded photo |
| Portrait | Photo | Colour side panel, round photo, icons |
| Minimal | — | Cream, centred serif |
| Signal | — | Black with acid accent (site style) |

To add one, add an entry to `TEMPLATES` and its colours to `PALS` in `app.js`
(back designs live in `BACKS`). Positions use `u`
(1% of card height) and fractions of `W`, so every size works.

## Privacy

Nothing is uploaded or saved: no network code, no `localStorage`, no cookies, no
data in the address bar, and form autofill is off. A Content-Security-Policy
(`connect-src 'none'`) blocks outgoing requests. Close or reload the tab and
everything is gone.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: markup and styling. Open this one. |
| `app.js` | Front templates, back designs, canvas drawing, preview, PNG/PDF export. |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 (MIT). |
| `qrcode.min.js` | QR encoding, [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). Same file as the QR app. |

Text is drawn with the site's bundled fonts plus Georgia/Arial (or the
device's closest match). Long text shrinks to fit, then is cut with "…" and a
warning is shown.
