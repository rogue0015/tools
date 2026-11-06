# Prompter Studio

Record yourself on camera while reading a scrolling teleprompter script. Takes and scripts are stored on your device. After one visit with internet, it works completely offline.

It is built on the same recorder as Avatar Studio. The only difference is that it records your real camera instead of an avatar.

## Run it

It is served from the same GitHub Pages site as the other small apps, at `/teleprompter/`.
The camera and offline mode need `https://` (or `localhost`), so it does **not** work by
double-clicking `index.html`. To test locally, from the repo root:

```
python -m http.server 8080
```

Then open http://localhost:8080/teleprompter/.

## Using it

- **Script**: write, paste or upload a `.txt` script, and export it again. Put cues in square brackets, like `[pause]`, and they show in amber. Save scripts by name and switch between them. Set the speed in words per minute, the text size and position, and mirror the text if you use prompter glass. It starts scrolling when you start recording. It sits over the stage but is never part of the video.
- **Setup**: pick the camera and microphone, mirror the preview and/or the recording, Lite mode, format (16:9, 9:16, 1:1, 4:3, 4:5 or custom), 480p to 4K, 24 to 60 fps, video and audio bitrate, file type and codec, countdown, mic filters, and an option to also download every take as soon as it finishes.
- **Clips**: play, save, share, rename or delete your takes.

Press **Camera**, then the red button. **Flip** switches between the front and back camera.

Keyboard: Space starts or pauses the script, R starts or stops recording.

## How it works

| File | What it does |
| --- | --- |
| `index.html` | Layout and styles (same desk layout as Avatar Studio) |
| `app.js` | Camera, live canvas, recording, saved scripts, clips, settings |
| `prompter.js` | The teleprompter |
| `store.js` | Saves takes in IndexedDB, one second at a time while recording |
| `sw.js` | Service worker that keeps everything available offline |

Each frame from the camera is drawn onto a canvas, cropped from the centre to the chosen format. The recording is that canvas plus your microphone, combined into one stream, so picture and sound stay in sync.

While recording, every second of video is written to storage straight away. If the browser crashes or the tab closes, the Clips tab offers to recover the unfinished take.

## Good to know

- Keep the app on screen while recording. If you switch apps, the recording pauses and carries on when you come back.
- Chrome, Edge and Safari record MP4. Firefox records WebM.
- Takes are stored in this browser on this device. Save the ones you want to keep; clearing the site's data deletes them.
- After you change any app file, raise `VERSION` in `sw.js` so installed copies pick up the update.
