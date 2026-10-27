# QR Code Generator

Type a URL, pick a colour, download the code. Double-click `index.html` — no
server, no build step, no internet connection needed.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: markup and styling. Open this one. |
| `app.js` | All the logic — colouring, shapes, logo, exports, self-check. |
| `qrcode.min.js` | QR encoding, [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). |
| `jsqr.min.js` | QR *decoding*, [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0). Used to check its own output. |

## What it does

- **Any colour.** Code colour defaults to black, background to white. Type a hex
  value, use the picker, or click a preset. The three corner squares can take a
  second colour of their own.
- **Transparent background** for placing the code over artwork.
- **Three module shapes**: square, rounded, dots. The finder squares and the
  alignment patterns deliberately stay solid — scanners hunt for their exact
  outline, and rounding them away stops the code reading.
- **Centre logo**, off by default. Turning it on asks you to pick an image and raises error correction to H.
- **PNG and SVG export**, plus copy-to-clipboard. SVG stays sharp at any size,
  so use it for print.
- **It checks itself.** After every change the page decodes its own output with
  an independent decoder and reports the result under the preview. A red badge
  means it genuinely does not read — usually too large a logo or too little
  contrast.

## Presets in the address bar

Settings can be preset via the URL hash, handy for bookmarks or generating a
house style repeatedly:

```
index.html#url=https%3A%2F%2Fexample.com&fg=%230f766e&bg=%23fef3c7&shape=rounded&ecl=H
```

Keys: `url`, `fg`, `bg`, `eye`, `shape` (`square`/`rounded`/`dots`), `ecl`
(`L`/`M`/`Q`/`H`), `size`, `margin`, `transparent=1`.
Colours may be written `%23rrggbb` or bare `rrggbb`.

## Notes

- A bare domain like `acme.co.zw/apply` gets `https://` added; anything without
  a scheme that is not domain-shaped is encoded as plain text.
- Export size lands on the nearest whole number of pixels per module, so 512 px
  may come out as 528 px. That is what keeps the edges crisp.
- Keep the quiet zone at 4 modules unless something else forces the issue.
