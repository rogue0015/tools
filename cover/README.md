# Cover Page Maker

Fill in the details, check the A4 preview, tick "structure is correct", then
download a PDF or Word (.docx) cover page. Double-click `index.html` — no server,
no build step, no internet connection needed.

## Layout

Follows the university format: logo, faculty and department (centred), then
label/value lines (no tables), then the assignment question. All text is bold
Times, upper case.

- **One person:** surname, name, reg number.
- **Group:** group name plus up to 25 members (surname, name, reg number each).
- **Both:** programme, mode of entry, lecturer, module title, level, question.
  Empty fields are left off the page.

## Privacy

Nothing is uploaded or saved: no network code, no `localStorage`, no cookies, no
data in the address bar. A Content-Security-Policy (`connect-src 'none'`) blocks
outgoing requests. Close or reload the tab and everything is gone.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: markup and styling. Open this one. |
| `app.js` | Form, A4 preview, PDF and DOCX builders. |
| `jspdf.umd.min.js` | [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 (MIT). |
| `docx.min.js` | [docx](https://github.com/dolanmiu/docx) 8.5.0 (MIT). |

Downloads stay disabled until you tick the preview confirmation; any later edit
un-ticks it. A warning shows if the content will not fit on one A4 page.
